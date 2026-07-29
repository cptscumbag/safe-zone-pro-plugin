# Safe Zone Pro

Premiere Pro plugin: one click adds a safe-zone overlay to the timeline
for the selected platform (TikTok / Instagram Reels / YouTube Shorts /
VK Clips / Likee / Facebook Reels), stretched to the full sequence length
and placed on a dedicated video track. "Remove all zones" clears
everything — the timeline clip and the project bin item.

## How to run and test

1. Install **UXP Developer Tool** (UDT) via Creative Cloud Desktop, or
   directly from developer.adobe.com/uxp.
2. In Premiere Pro: Settings → Plugins → Enable Developer Mode → restart
   Premiere.
3. In UDT: Add Plugin → select `manifest.json` from this folder → Load
   (or Load & Watch for auto-reload on code changes).
4. In Premiere: Window → UXP Extensions → Safe Zone Pro.
5. Open a project with an active sequence and click a platform button.

## Confirmed working API (verified through live debugging on Premiere 26.3.0)

- `project.importFiles(paths, suppressUI, targetBin, asNumberedStills)` —
  positional args, returns `Promise<boolean>`, NOT a list of imported items
- `insertionBin` from `getInsertionBin()` must be cast via
  `premierepro.FolderItem.cast()` before `.getItems()` works
- `ProjectItem.createSetNameAction()` must be called **inside**
  `project.lockedAccess()`, not before it
- `SequenceEditor.createOverwriteItemAction()` — also must be created
  inside `lockedAccess`; use `-1` for `audioTrackIndex` when the media
  has no audio (`0` targets a real existing audio track and can conflict)
- `sequence.getVideoTrackCount()` — a method, not a `.videoTracks.numTracks`
  property
- `sequence.getOutPoint()` is the work area, NOT the sequence length —
  by default unset, returns a sentinel value. Real sequence length is
  computed as max `getEndTime()` across all clips on all tracks
- `TrackItemSelection.createEmptySelection(callback)` — a static factory
  with a callback, there is no `new TrackItemSelection()` constructor
- SVG is NOT a supported Premiere import format ("File format not
  supported") — overlays must be PNG

## Known unsupported (Adobe API gaps, not bugs here)

- **Track locking** (setLocked/isLocked) — not available in UXP as of
  this writing (confirmed via an open Adobe community feature request)
- **Track deletion** — no API to remove a track; the plugin works around
  this by reusing an empty top track on the next insert instead of
  creating a new one every time

## Updating overlays / adding platforms

Edit `zones-config.json` (safe zone coordinates, UI element positions,
colors, filenames), then regenerate:

```
node generate-overlays.js
python3 svg-to-png.py
```

Requires `pip install cairosvg --break-system-packages`.

Note: exact UI element coordinates for TikTok, Instagram Reels and
YouTube Shorts were placed from memory of typical layouts, not pixel-
perfect published specs — verify against a real exported video before
relying on them. VK Clips, Likee and Facebook Reels currently only have
a generic safe-zone box (`elementsVerified: false` in the config) since
their UI layouts weren't confidently known — calibrate against real
screenshots before shipping.

## Licensing (sketch for a paid version)

Standard approach used by most small Premiere plugins (MassRename,
AutoSortBinsPro, etc.):

- **Free tier**: only one platform available, others shown as "🔒 Pro"
  in the UI
- **No-server key activation**: pre-generate keys (e.g. HMAC signature
  of email+seed), validate the checksum locally in the plugin — no
  backend needed for an MVP. Downside: a key can be copied across
  machines; fine for launch, not for scale.
- **Where to sell**: aescripts.com or Adobe Exchange — both take a cut
  but bring an audience of editors already buying this kind of plugin.

No licensing code included yet — validate the core functionality across
Premiere versions first, then invest in protection.
