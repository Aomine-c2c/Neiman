# NEIMAN OS — Official Releases

Official pre-built binary releases for **NEIMAN Autonomous Organization OS** across Linux Desktop, Android, and Native Rust TUI.

## Latest Release (`v1.2.0`)

Download compiled installers from the [Releases](https://github.com/Aomine-c2c/Neiman/releases/latest) page:

- **Linux Desktop (`.deb`)**: `NEIMAN-desktop_1.2.0_amd64.deb`
- **Linux Desktop (`.AppImage`)**: `NEIMAN-desktop_1.2.0_amd64.AppImage`
- **Android APK (`aarch64` universal)**: `NEIMAN-android-v1.2.0-universal.apk`
- **Linux Native TUI**: `neiman-tui-linux-x86_64`

## Remote Android Pairing
1. Start the NEIMAN API on your workstation (`uvicorn nexora.main:app --host 0.0.0.0 --port 8000`).
2. Open **Settings → Workspace → Remote Workstation & Android APK Link** to generate a 5-minute single-use pairing code.
3. Enter your workstation LAN/Tailscale URL and pairing code in the Android app.
