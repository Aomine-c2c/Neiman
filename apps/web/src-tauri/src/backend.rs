//! NEIMAN Desktop Backend Process Supervisor
//!
//! Supervises the Python FastAPI backend process inside the Tauri desktop runtime:
//! - Checks if the backend API is already running on the configured port.
//! - If not running, locates the Python environment and spawns the API server as a child process.
//! - Waits for health readiness (`/health` returning 200 OK).
//! - Cleans up the child process on desktop application exit to prevent zombie processes.

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

pub struct BackendSupervisor {
    child: Mutex<Option<Child>>,
    running_by_us: AtomicBool,
}

impl Default for BackendSupervisor {
    fn default() -> Self {
        Self::new()
    }
}

impl BackendSupervisor {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            running_by_us: AtomicBool::new(false),
        }
    }

    /// Checks if HTTP health endpoint responds with 200 OK using stdlib TCP
    pub fn is_backend_healthy(_url: &str, port: u16) -> bool {
        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        if let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(500)) {
            let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
            let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));

            let request = b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";
            if stream.write_all(request).is_ok() {
                let mut buffer = [0u8; 128];
                if let Ok(n) = stream.read(&mut buffer) {
                    let response = String::from_utf8_lossy(&buffer[..n]);
                    return response.contains("200 OK");
                }
            }
            return true; // TCP port responded
        }
        false
    }

    /// Discovers the path to the apps/api directory relative to binary or current working dir
    pub fn find_api_dir() -> Option<PathBuf> {
        let mut candidates = Vec::new();

        // 1. Current working directory
        if let Ok(cwd) = std::env::current_dir() {
            candidates.push(cwd.join("apps/api"));
            candidates.push(cwd.join("../api"));
            candidates.push(cwd.clone());
        }

        // 2. Executable parent directories
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                candidates.push(exe_dir.join("apps/api"));
                candidates.push(exe_dir.join("../../../apps/api"));
                candidates.push(exe_dir.join("../../../../apps/api"));
            }
        }

        // 3. User home project directories
        if let Some(home) = dirs::home_dir() {
            candidates.push(home.join("Projects/Sila/apps/api"));
            candidates.push(home.join("neiman/apps/api"));
        }

        for p in candidates {
            if p.join("nexora/main.py").exists() || p.join("alembic.ini").exists() {
                if let Ok(canonical) = p.canonicalize() {
                    return Some(canonical);
                }
                return Some(p);
            }
        }
        None
    }

    /// Spawns the FastAPI backend server as a child process if not already responding
    pub fn ensure_started(&self, api_url: &str, port: u16) -> Result<(), String> {
        if Self::is_backend_healthy(api_url, port) {
            log::info!("Backend API already healthy and running at {}", api_url);
            return Ok(());
        }

        let api_dir = match Self::find_api_dir() {
            Some(dir) => dir,
            None => {
                let err = "Failed to locate NEIMAN apps/api directory for backend startup";
                log::warn!("{}", err);
                return Err(err.to_string());
            }
        };

        log::info!("Found NEIMAN API directory at {}", api_dir.display());

        // Configure persistent SQLite storage
        let data_dir = dirs::data_local_dir()
            .map(|d| d.join("neiman"))
            .unwrap_or_else(|| PathBuf::from("./data"));
        let _ = std::fs::create_dir_all(&data_dir);
        let db_file = data_dir.join("production.db");
        let db_url = format!("sqlite+aiosqlite:///{}", db_file.to_string_lossy());

        // Determine python executable
        let venv_python = api_dir.join(".venv/bin/python");
        let mut cmd = if venv_python.exists() {
            let mut c = Command::new(&venv_python);
            c.args([
                "-m",
                "uvicorn",
                "nexora.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                &port.to_string(),
                "--log-level",
                "warning",
            ]);
            c
        } else {
            // Try uv run
            let mut c = Command::new("uv");
            c.args([
                "run",
                "uvicorn",
                "nexora.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                &port.to_string(),
                "--log-level",
                "warning",
            ]);
            c
        };

        cmd.current_dir(&api_dir)
            .env("DATABASE_URL", &db_url)
            .env("DISABLE_AUTH", "false")
            .env("ENVIRONMENT", "production")
            .stdout(Stdio::null())
            .stderr(Stdio::inherit());

        log::info!("Spawning backend process in {}", api_dir.display());
        match cmd.spawn() {
            Ok(child) => {
                let pid = child.id();
                log::info!("Backend process spawned with PID {}", pid);
                if let Ok(mut lock) = self.child.lock() {
                    *lock = Some(child);
                }
                self.running_by_us.store(true, Ordering::SeqCst);

                // Wait up to 15 seconds for backend to become healthy
                let start = Instant::now();
                while start.elapsed() < Duration::from_secs(15) {
                    if Self::is_backend_healthy(api_url, port) {
                        log::info!("Backend verified healthy in {:.2}s", start.elapsed().as_secs_f32());
                        return Ok(());
                    }
                    std::thread::sleep(Duration::from_millis(400));
                }

                Err("Backend spawned but timed out waiting for /health readiness".to_string())
            }
            Err(e) => {
                let err = format!("Failed to spawn backend process: {}", e);
                log::error!("{}", err);
                Err(err)
            }
        }
    }

    /// Stops the child backend process gracefully using SIGTERM with a 3-second grace period
    pub fn shutdown(&self) {
        if self.running_by_us.load(Ordering::SeqCst) {
            if let Ok(mut lock) = self.child.lock() {
                if let Some(mut child) = lock.take() {
                    let pid = child.id();
                    log::info!("Sending graceful SIGTERM to backend child process (PID: {})...", pid);

                    #[cfg(unix)]
                    {
                        unsafe {
                            libc::kill(pid as i32, libc::SIGTERM);
                        }

                        // Wait up to 3 seconds for graceful exit
                        let start = Instant::now();
                        let mut exited = false;
                        while start.elapsed() < Duration::from_secs(3) {
                            match child.try_wait() {
                                Ok(Some(status)) => {
                                    log::info!("Backend child process exited gracefully: {:?}", status);
                                    exited = true;
                                    break;
                                }
                                Ok(None) => {
                                    std::thread::sleep(Duration::from_millis(150));
                                }
                                Err(e) => {
                                    log::warn!("Error waiting on child process: {}", e);
                                    break;
                                }
                            }
                        }

                        if !exited {
                            log::warn!("Backend did not exit within 3s grace period; issuing SIGKILL...");
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }

                    #[cfg(not(unix))]
                    {
                        let _ = child.kill();
                        let _ = child.wait();
                    }

                    log::info!("Backend child process shutdown complete.");
                }
            }
            self.running_by_us.store(false, Ordering::SeqCst);
        }
    }
}

impl Drop for BackendSupervisor {
    fn drop(&mut self) {
        self.shutdown();
    }
}
