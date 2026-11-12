/**
 * NEIMAN Desktop Native Bridge
 *
 * Provides a unified API surface that seamlessly toggles between:
 * 1. Tauri Native Runtime (System Tray, AES-256-GCM Authenticated Vault, Window State Persistence, Deep Links, Native Notifications, Sandbox File Export)
 * 2. Standard Web Browser Environment (Graceful Web Fallbacks: LocalStorage, Web Notifications, Web Blob Downloads)
 *
 * Strictly adheres to zero-trust principles: Never assumes raw shell or unrestricted fs access.
 */

import { isValidDeepLink, isSafeExportFilename } from '@neiman/validation';
import { NEIMAN_CONFIG, getApiBaseUrl } from '@neiman/config';

export interface SystemTelemetrySnapshot {
  os: string;
  arch: string;
  app_version: string;
  memory_rss_mb: number;
  is_desktop: boolean;
}

export interface DesktopConfig {
  api_endpoint: string;
  theme: string;
  launch_at_startup: boolean;
  minimize_to_tray: boolean;
  notifications_enabled: boolean;
  offline_cache_enabled: boolean;
  telemetry_consent: boolean;
}

export interface WindowStateData {
  width: number;
  height: number;
  x: number;
  y: number;
  is_maximized: boolean;
}

export interface UpdateCheckResult {
  update_available: boolean;
  current_version: string;
  latest_version: string;
  release_notes: string;
  download_url?: string | null;
}

/**
 * Checks if running inside the native Tauri container
 */
export function isTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ||
    (window as unknown as { __TAURI__?: unknown }).__TAURI__
  );
}

// Dynamically invoke Tauri core IPC
async function invokeTauri<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

// =========================================================================
// 1. SECURE CREDENTIAL VAULT (Native Memory/Obfuscated Disk vs In-Memory/Storage)
// =========================================================================
export const desktopVault = {
  async setCredential(key: string, value: string): Promise<void> {
    if (isTauriDesktop()) {
      await invokeTauri('set_secure_credential', { key, value });
    } else {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`${NEIMAN_CONFIG.STORAGE_KEYS.SESSION_SEC_PREFIX}${key}`, btoa(value));
      }
    }
  },

  async getCredential(key: string): Promise<string | null> {
    if (isTauriDesktop()) {
      return await invokeTauri<string | null>('get_secure_credential', { key });
    } else {
      if (typeof window === 'undefined') return null;
      const val = sessionStorage.getItem(`${NEIMAN_CONFIG.STORAGE_KEYS.SESSION_SEC_PREFIX}${key}`);
      return val ? atob(val) : null;
    }
  },

  async removeCredential(key: string): Promise<void> {
    if (isTauriDesktop()) {
      await invokeTauri('remove_secure_credential', { key });
    } else {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`${NEIMAN_CONFIG.STORAGE_KEYS.SESSION_SEC_PREFIX}${key}`);
      }
    }
  }
};

// =========================================================================
// 2. DESKTOP LOCAL CONFIGURATION
// =========================================================================
export const desktopConfig = {
  async load(): Promise<DesktopConfig> {
    if (isTauriDesktop()) {
      return await invokeTauri<DesktopConfig>('load_desktop_config');
    }
    return {
      api_endpoint: getApiBaseUrl(),
      theme: 'dark',
      launch_at_startup: false,
      minimize_to_tray: true,
      notifications_enabled: true,
      offline_cache_enabled: true,
      telemetry_consent: false,
    };
  },

  async save(config: DesktopConfig): Promise<void> {
    if (isTauriDesktop()) {
      await invokeTauri('save_desktop_config', { config });
    } else {
      if (typeof window !== 'undefined') {
        localStorage.setItem(NEIMAN_CONFIG.STORAGE_KEYS.DESKTOP_CONFIG, JSON.stringify(config));
      }
    }
  }
};

// =========================================================================
// 3. WINDOW STATE PERSISTENCE
// =========================================================================
export const desktopWindowState = {
  async save(state: WindowStateData): Promise<void> {
    if (isTauriDesktop()) {
      await invokeTauri('save_window_state', { windowState: state });
    } else {
      if (typeof window !== 'undefined') {
        localStorage.setItem(NEIMAN_CONFIG.STORAGE_KEYS.DESKTOP_WINDOW_STATE, JSON.stringify(state));
      }
    }
  },

  async load(): Promise<WindowStateData | null> {
    if (isTauriDesktop()) {
      return await invokeTauri<WindowStateData | null>('load_window_state');
    }
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(NEIMAN_CONFIG.STORAGE_KEYS.DESKTOP_WINDOW_STATE);
    return raw ? JSON.parse(raw) : null;
  }
};

// =========================================================================
// 3.5 SYSTEM TELEMETRY
// =========================================================================
export const desktopTelemetry = {
  async getSnapshot(): Promise<SystemTelemetrySnapshot> {
    if (isTauriDesktop()) {
      return await invokeTauri<SystemTelemetrySnapshot>('get_desktop_telemetry');
    }
    return {
      os: typeof navigator !== 'undefined' ? navigator.platform : 'Linux',
      arch: 'x86_64',
      app_version: '0.1.0-web',
      memory_rss_mb: 48,
      is_desktop: false,
    };
  }
};

// =========================================================================
// 4. DESKTOP NOTIFICATIONS (Cross-Platform Native & Browser fallback)
// =========================================================================
export const desktopNotify = {
  async send(title: string, body: string): Promise<void> {
    if (isTauriDesktop()) {
      await invokeTauri('send_desktop_notification', { title, body });
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body, icon: '/favicon.ico' });
        }
      }
    }
  }
};

// =========================================================================
// 5. UPDATE ARCHITECTURE (Tauri v2 Native Auto-Updater & Fallback)
// =========================================================================
export interface NativeUpdateInfo {
  available: boolean;
  version?: string;
  currentVersion?: string;
  body?: string;
  date?: string;
}

export const desktopUpdates = {
  /**
   * Check for an update from GitHub Releases.
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    if (isTauriDesktop()) {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (update?.available) {
          return {
            update_available: true,
            current_version: update.currentVersion || '0.1.0',
            latest_version: update.version || '0.1.0',
            release_notes: update.body || 'New operational release available on GitHub.',
            download_url: null,
          };
        }
      } catch (err) {
        console.warn('Native update check encountered non-fatal error:', err);
      }
      return await invokeTauri<UpdateCheckResult>('check_app_updates');
    }
    return {
      update_available: false,
      current_version: '0.1.0-web',
      latest_version: '0.1.0-web',
      release_notes: 'Web edition running latest production bundle.',
      download_url: null,
    };
  },

  /**
   * Silently downloads and installs the update in the background, then signals ready to restart.
   */
  async downloadAndInstall(onProgress?: (progress: number) => void): Promise<boolean> {
    if (!isTauriDesktop()) return false;
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update?.available) {
        let downloaded = 0;
        let contentLength = 0;
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0;
              break;
            case 'Progress':
              downloaded += event.data.chunkLength;
              if (contentLength > 0 && onProgress) {
                onProgress(Math.round((downloaded / contentLength) * 100));
              }
              break;
            case 'Finished':
              if (onProgress) onProgress(100);
              break;
          }
        });
        return true;
      }
    } catch (err) {
      console.error('Silent update installation failed:', err);
    }
    return false;
  },

  /**
   * Restarts the application to apply the downloaded update.
   */
  async restartToApply(): Promise<void> {
    if (isTauriDesktop()) {
      try {
        // Try @tauri-apps/plugin-process relaunch if available
        const processPlugin = await import('@tauri-apps/plugin-process' as any).catch(() => null);
        if (processPlugin && typeof processPlugin.relaunch === 'function') {
          await processPlugin.relaunch();
          return;
        }
      } catch {
        // Fall back to window reload
      }
      window.location.reload();
    } else {
      window.location.reload();
    }
  }
};

// =========================================================================
// 6. SECURE SANDBOX FILE EXPORT
// =========================================================================
export const desktopExport = {
  async exportReport(filename: string, content: string): Promise<string> {
    if (!isSafeExportFilename(filename)) {
      throw new Error('Security policy violation: Only .json, .csv, .txt, and .md report exports are allowed');
    }
    if (isTauriDesktop()) {
      return await invokeTauri<string>('export_report_file', { filename, content });
    } else {
      // Browser File Blob Download fallback
      if (typeof window !== 'undefined') {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return `Downloaded via browser: ${filename}`;
      }
      return 'Export triggered';
    }
  }
};

// =========================================================================
// 7. DEEP LINKING & EVENTS
// =========================================================================
export const desktopEvents = {
  async listenDeepLink(handler: (url: string) => void): Promise<() => void> {
    if (isTauriDesktop()) {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<{ url: string }>('deep-link-received', (event) => {
        if (isValidDeepLink(event.payload.url)) {
          handler(event.payload.url);
        } else {
          console.warn('Blocked invalid deep link payload:', event.payload.url);
        }
      });
      return unlisten;
    }
    return () => {};
  }
};

// =========================================================================
// 9. LOCAL PROJECT & REPOSITORY INSPECTION
// =========================================================================
export interface LocalProjectInspection {
  exists: boolean;
  path: string;
  is_git_repo: boolean;
  current_branch?: string | null;
  head_commit?: string | null;
  remote_origin?: string | null;
  file_count: number;
}

export const desktopLocalProject = {
  async inspect(path: string): Promise<LocalProjectInspection> {
    if (isTauriDesktop()) {
      return await invokeTauri<LocalProjectInspection>('inspect_local_project', { path });
    }
    throw new Error('Local repository inspection is available only in the native desktop app. The browser cannot inspect files on the API host.');
  }
};
