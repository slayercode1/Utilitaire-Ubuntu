# Classic confinement request — finder

To post in https://forum.snapcraft.io/c/store-requests/classic-confinement/26
once the name is registered and a first revision is uploaded.

---

**Title:** Classic confinement request for `finder`

- **name:** finder
- **description:** Finder is a Spotlight-style launcher for Linux. Pressing
  Alt+Space opens a search bar that finds and launches installed applications
  (deb, snap and Flatpak alike), finds files and folders in the user's home
  directory, toggles Wi-Fi, Bluetooth and sound, and can run a shell command
  in the user's terminal after an explicit native confirmation dialog. Nothing
  leaves the machine: no account, no telemetry.
- **snapcraft:** https://github.com/slayercode1/Utilitaire-Ubuntu/blob/main/scripts/build-snap.sh
  (the snap is assembled from the hardened electron-builder output and packed
  with `snap pack`; the generated `meta/snap.yaml` is in that script)
- **upstream:** https://github.com/slayercode1/Utilitaire-Ubuntu
- **upstream-relation:** I am the upstream author and sole maintainer.
- **supported-category:** none of the listed categories matches exactly; see
  reasoning.
- **reasoning:**

  Finder's core function is launching whatever the user has installed,
  which strict confinement cannot provide:

  1. It executes the `Exec=` line of host `.desktop` entries from
     `/usr/share/applications`, `/var/lib/flatpak/exports/share/applications`
     and `~/.local/share/applications`. A strictly confined snap cannot exec
     host binaries, and `desktop-launch` only launches other snaps from
     `/var/lib/snapd/desktop/applications` (and is reserved), so apt and
     Flatpak applications would be unreachable.
  2. It opens the user's terminal emulator (`x-terminal-emulator`) with a
     command the user typed, after a native confirmation dialog showing the
     full command, and opens system settings panels (`gnome-control-center`,
     with XFCE/KDE fallbacks). These are host programs not known at build
     time.
  3. It indexes the user's home directory (non-hidden entries only, depth 4)
     and writes its XDG autostart entry to `~/.config/autostart`.

  - [x] I have tried the existing interfaces (`home`, `desktop`, `x11`,
    `network-manager`, `bluetooth-control`, `audio-playback`,
    `desktop-launch`). The application runs, but it cannot launch any non-snap
    application, which is its purpose.

  Security posture, since classic removes the snap sandbox:

  - The renderer loads only bundled local content through a custom protocol,
    with a strict CSP, `contextIsolation`, `sandbox: true` in
    `webPreferences`, no remote content and no navigation.
  - Every IPC message is checked for sender, type and membership in an index
    owned by the main process. The renderer passes identifiers, never
    commands.
  - Electron fuses are hardened: RunAsNode, NODE_OPTIONS and inspect are off;
    asar integrity and OnlyLoadAppFromAsar are on.
  - Chromium's sandbox relies on unprivileged user namespaces. On Ubuntu
    23.10+ these are restricted by AppArmor and a snap cannot ship the setuid
    helper, so in that case only the launcher passes `--no-sandbox`.
  - Processes are spawned without a shell. Snap-specific environment
    variables are stripped before launching host applications.
  - Self-update is disabled inside the snap. Updates come from the store only.
