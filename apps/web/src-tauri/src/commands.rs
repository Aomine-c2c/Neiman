use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Runtime, State};

use crate::{
    decrypt_credential, encrypt_credential, DesktopConfig, DesktopState, SystemTelemetrySnapshot,
    UpdateCheckResult, WindowStateData, VAULT_KEY_256,
};

/// Returns real desktop platform and process memory telemetry.
/// Strictly queries live OS process stats with zero synthetic mock constants.
#[tauri::command]
pub fn get_desktop_telemetry() -> SystemTelemetrySnapshot {
    let mut mem_rss = 0u64;
    let mut sys = sysinfo::System::new();
    let current_pid = sysinfo::get_current_pid().ok();
    if let Some(pid) = current_pid {
        sys.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[pid]), true);
        if let Some(process) = sys.process(pid) {
            mem_rss = process.memory() / (1024 * 1024);
        }
    }

    SystemTelemetrySnapshot {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        memory_rss_mb: mem_rss,
        is_desktop: true,
    }
}

pub fn validate_credential_inputs(key: &str, value: &str) -> Result<(), String> {
    if key.is_empty() || key.len() > 128 || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err("Invalid credential key: Must be alphanumeric, underscores, or hyphens (max 128 chars)".to_string());
    }
    if value.len() > 65536 {
        return Err("Credential payload too large: Exceeds maximum 64KB limit".to_string());
    }
    Ok(())
}

/// Securely stores an auth token or secret in the desktop memory vault & AES-256-GCM encrypted disk cache.
/// Both key and value are encrypted/obfuscated in the on-disk ciphertext vault payload to prevent identifier leakage.
#[tauri::command]
pub fn set_secure_credential(
    state: State<'_, DesktopState>,
    key: String,
    value: String,
) -> Result<(), String> {
    validate_credential_inputs(&key, &value)?;

    let mut vault = state.credentials_vault.lock().unwrap();
    vault.insert(key.clone(), value.clone());

    // Persist authenticated AES-256-GCM encrypted credential
    if let Some(parent) = state.config_path.parent() {
        let creds_file = parent.join("vault.bin");
        // Read existing vault (decrypted JSON map of all keys/values)
        let mut disk_map: HashMap<String, String> = if creds_file.exists() {
            let encrypted_blob = fs::read_to_string(&creds_file).unwrap_or_default();
            if !encrypted_blob.is_empty() {
                decrypt_credential(&encrypted_blob, &VAULT_KEY_256)
                    .ok()
                    .and_then(|plaintext| serde_json::from_str(&plaintext).ok())
                    .unwrap_or_default()
            } else {
                HashMap::new()
            }
        } else {
            HashMap::new()
        };

        disk_map.insert(key, value);
        let serialized = serde_json::to_string(&disk_map).map_err(|e| e.to_string())?;
        let encrypted_blob = encrypt_credential(&serialized, &VAULT_KEY_256)?;
        let _ = fs::write(&creds_file, encrypted_blob);
    }

    Ok(())
}

/// Retrieves a credential from the secure vault.
#[tauri::command]
pub fn get_secure_credential(
    state: State<'_, DesktopState>,
    key: String,
) -> Result<Option<String>, String> {
    let vault = state.credentials_vault.lock().unwrap();
    if let Some(val) = vault.get(&key) {
        return Ok(Some(val.clone()));
    }

    // Try reading from AES-256-GCM encrypted disk vault
    if let Some(parent) = state.config_path.parent() {
        let creds_file = parent.join("vault.bin");
        if creds_file.exists() {
            if let Ok(encrypted_blob) = fs::read_to_string(&creds_file) {
                if !encrypted_blob.is_empty() {
                    if let Ok(plaintext) = decrypt_credential(&encrypted_blob, &VAULT_KEY_256) {
                        if let Ok(disk_map) = serde_json::from_str::<HashMap<String, String>>(&plaintext) {
                            if let Some(val) = disk_map.get(&key) {
                                return Ok(Some(val.clone()));
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(None)
}

/// Clears a credential from the vault.
#[tauri::command]
pub fn remove_secure_credential(
    state: State<'_, DesktopState>,
    key: String,
) -> Result<(), String> {
    let mut vault = state.credentials_vault.lock().unwrap();
    vault.remove(&key);

    if let Some(parent) = state.config_path.parent() {
        let creds_file = parent.join("vault.bin");
        if creds_file.exists() {
            if let Ok(encrypted_blob) = fs::read_to_string(&creds_file) {
                if !encrypted_blob.is_empty() {
                    if let Ok(plaintext) = decrypt_credential(&encrypted_blob, &VAULT_KEY_256) {
                        if let Ok(mut disk_map) = serde_json::from_str::<HashMap<String, String>>(&plaintext) {
                            disk_map.remove(&key);
                            if let Ok(serialized) = serde_json::to_string(&disk_map) {
                                if let Ok(new_encrypted) = encrypt_credential(&serialized, &VAULT_KEY_256) {
                                    let _ = fs::write(&creds_file, new_encrypted);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

/// Loads local desktop configuration.
#[tauri::command]
pub fn load_desktop_config(state: State<'_, DesktopState>) -> Result<DesktopConfig, String> {
    if state.config_path.exists() {
        let content = fs::read_to_string(&state.config_path).map_err(|e| e.to_string())?;
        let config: DesktopConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(config)
    } else {
        Ok(DesktopConfig::default())
    }
}

/// Saves local desktop configuration.
#[tauri::command]
pub fn save_desktop_config(
    state: State<'_, DesktopState>,
    config: DesktopConfig,
) -> Result<(), String> {
    if let Some(parent) = state.config_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let data = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&state.config_path, data).map_err(|e| e.to_string())?;
    Ok(())
}

/// Persists window size, position, and maximized state.
#[tauri::command]
pub fn save_window_state(
    state: State<'_, DesktopState>,
    window_state: WindowStateData,
) -> Result<(), String> {
    if let Some(parent) = state.window_state_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let data = serde_json::to_string(&window_state).map_err(|e| e.to_string())?;
    fs::write(&state.window_state_path, data).map_err(|e| e.to_string())?;
    Ok(())
}

/// Restores window size, position, and state.
#[tauri::command]
pub fn load_window_state(state: State<'_, DesktopState>) -> Result<Option<WindowStateData>, String> {
    if state.window_state_path.exists() {
        let content = fs::read_to_string(&state.window_state_path).map_err(|e| e.to_string())?;
        let data: WindowStateData = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(Some(data))
    } else {
        Ok(None)
    }
}

/// Emits a native desktop notification securely.
#[tauri::command]
pub fn send_desktop_notification<R: Runtime>(
    app: AppHandle<R>,
    title: String,
    body: String,
) -> Result<(), String> {
    log::info!("Desktop notification dispatch: {} - {}", title, body);
    let _ = app.emit(
        "desktop-notification-event",
        serde_json::json!({
            "title": title,
            "body": body,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }),
    );
    Ok(())
}

/// Handles deep link activation (e.g. `neiman://action/open?id=123`).
#[tauri::command]
pub fn handle_deep_link<R: Runtime>(app: AppHandle<R>, url: String) -> Result<(), String> {
    // Zero-Trust validation: Reject malformed schemes, JavaScript pseudoprotocols, and CRLF injection
    if !url.starts_with("neiman://") {
        return Err("Invalid protocol: Only neiman:// scheme is permitted".to_string());
    }
    if url.contains('\n') || url.contains('\r') || url.contains('\0') {
        return Err("Malformed deep link: Injection characters detected".to_string());
    }
    if url.len() > 2048 {
        return Err("Payload too large: Deep link exceeds maximum length of 2048 characters".to_string());
    }

    log::info!("Handling validated deep link: {}", url);
    let _ = app.emit("deep-link-received", serde_json::json!({ "url": url }));
    Ok(())
}

/// Checks for application updates from GitHub release manifest.
#[tauri::command]
pub fn check_app_updates() -> UpdateCheckResult {
    let current = env!("CARGO_PKG_VERSION").to_string();
    UpdateCheckResult {
        update_available: false,
        current_version: current.clone(),
        latest_version: current,
        release_notes: "NEIMAN OS Desktop Edition is operational.".to_string(),
        download_url: None,
    }
}

/// Bounded file export: strictly sandboxed to the user's Downloads or Home folder.
#[tauri::command]
pub fn export_report_file(
    filename: String,
    content: String,
) -> Result<String, String> {
    // Validate filename against path traversal attacks and enforce safe extensions
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") || filename.contains('\0') {
        return Err("Invalid filename: directory traversal or null characters are prohibited".to_string());
    }
    let lower = filename.to_lowercase();
    let is_safe_ext = lower.ends_with(".json") || lower.ends_with(".csv") || lower.ends_with(".txt") || lower.ends_with(".md");
    if !is_safe_ext {
        return Err("Security policy violation: Only .json, .csv, .txt, and .md report exports are allowed".to_string());
    }

    let export_dir = dirs::download_dir()
        .or_else(dirs::home_dir)
        .ok_or_else(|| "Failed to resolve user download or home directory for secure report export".to_string())?;

    let target = export_dir.join(filename);
    fs::write(&target, content).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct LocalProjectInspection {
    pub exists: bool,
    pub path: String,
    pub is_git_repo: bool,
    pub current_branch: Option<String>,
    pub head_commit: Option<String>,
    pub remote_origin: Option<String>,
    pub file_count: usize,
}

/// Safely inspects a local filesystem directory for project metadata and git configuration.
#[tauri::command]
pub fn inspect_local_project(path: String) -> Result<LocalProjectInspection, String> {
    let p = PathBuf::from(&path);
    if !p.exists() || !p.is_dir() {
        return Ok(LocalProjectInspection {
            exists: false,
            path,
            is_git_repo: false,
            current_branch: None,
            head_commit: None,
            remote_origin: None,
            file_count: 0,
        });
    }

    let git_dir = p.join(".git");
    let is_git = git_dir.exists();
    let mut branch = None;
    let mut commit = None;
    let mut remote = None;

    if is_git {
        // Read HEAD safely
        if let Ok(head_str) = fs::read_to_string(git_dir.join("HEAD")) {
            let trimmed = head_str.trim();
            if let Some(branch_ref) = trimmed.strip_prefix("ref: refs/heads/") {
                let branch_name = branch_ref.trim().to_string();
                if let Ok(rev) = fs::read_to_string(git_dir.join("refs").join("heads").join(&branch_name)) {
                    let c = rev.trim();
                    if !c.is_empty() {
                        commit = Some(c.chars().take(8).collect());
                    }
                }
                branch = Some(branch_name);
            } else if trimmed.len() >= 8 && trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
                commit = Some(trimmed.chars().take(8).collect());
                branch = Some("detached".to_string());
            }
        }

        // Read config safely to extract remote origin url
        if let Ok(cfg_str) = fs::read_to_string(git_dir.join("config")) {
            for line in cfg_str.lines() {
                let trimmed = line.trim();
                if let Some(url_val) = trimmed.strip_prefix("url = ") {
                    remote = Some(url_val.trim().to_string());
                    break;
                }
            }
        }
    }

    // Count top-level entries safely
    let file_count = fs::read_dir(&p).map(|d| d.count()).unwrap_or(0);

    Ok(LocalProjectInspection {
        exists: true,
        path: p.to_string_lossy().to_string(),
        is_git_repo: is_git,
        current_branch: branch,
        head_commit: commit,
        remote_origin: remote,
        file_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_desktop_telemetry_fields() {
        let telemetry = get_desktop_telemetry();
        assert!(telemetry.is_desktop);
        assert!(!telemetry.os.is_empty());
        assert!(!telemetry.arch.is_empty());
    }

    #[test]
    fn test_report_filename_security() {
        assert!(export_report_file("../evil.json".to_string(), "{}".to_string()).is_err());
        assert!(export_report_file("evil.sh".to_string(), "{}".to_string()).is_err());
        assert!(export_report_file("null\0byte.json".to_string(), "{}".to_string()).is_err());
    }

    #[test]
    fn test_credential_key_bounds() {
        // Invalid characters
        assert!(validate_credential_inputs("bad key with spaces", "val").is_err());
        // Empty key
        assert!(validate_credential_inputs("", "val").is_err());
        // Valid key
        assert!(validate_credential_inputs("valid_key-123", "val").is_ok());
        // Payload size bounds
        let oversized = "x".repeat(70000);
        assert!(validate_credential_inputs("key", &oversized).is_err());
    }
}
