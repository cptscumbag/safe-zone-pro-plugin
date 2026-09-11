# Installing Safe Zone Pro

## Requirements

- Adobe Premiere Pro **25.6.0** or newer
- **Creative Cloud Desktop** installed and running (it performs the install;
  Premiere cannot load UXP plugins from a folder)

## Install

1. Download `SafeZonePro.ccx`.
2. Double-click the file. Creative Cloud Desktop opens.
3. A dialog warns that the plugin is not from the Adobe Marketplace.
   **This is expected** for any plugin distributed directly by its author.
   Click **Install**.
4. Restart Premiere Pro.
5. Open the panel: **Window -> UXP Plugins -> Safe Zone Pro**.

Works the same on macOS and Windows -- one file for both.

## Use

1. Open a project with an active sequence.
2. Click **SAFE ZONE**. The overlay is placed on its own video track,
   stretched to the full sequence length.
3. Click **REMOVE ZONE** before export. This clears both the timeline clip
   and the project bin item.

## Uninstall

Uninstall from the plugin management screen in Creative Cloud Desktop
(the same place it lists your other installed plugins).

Remove the overlay from any open sequence first: the imported overlay clip
points at the file inside the plugin folder, so uninstalling while it is
still on a timeline leaves offline media behind.

## Troubleshooting

**The panel is not under Window -> UXP Plugins.** Restart Premiere. If it is
still missing, confirm Premiere is 25.6.0 or newer.

**Double-clicking the .ccx does nothing.** Creative Cloud Desktop is not
installed or not running. Install it, then double-click again.

**"SAFE ZONE" reports no active sequence.** Open a sequence in the timeline
and give it focus, then click again.
