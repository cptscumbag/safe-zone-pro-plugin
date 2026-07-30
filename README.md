# Safe Zone Pro

Premiere Pro plugin: one click drops a hazard-tape safe-zone overlay onto
the timeline, stretched to the full sequence length and placed on a
dedicated video track. "Remove zone" clears everything — the timeline
clip and the project bin item.

A single universal overlay covers every vertical platform (TikTok,
Instagram Reels, YouTube Shorts, VK Clips, Likee, Facebook Reels): their
safe areas differ by only a few dozen pixels, so the overlay uses the
tightest of them (Instagram Reels) and clears the rest by construction.

## How to run and test

1. Install **UXP Developer Tool** (UDT) via Creative Cloud Desktop, or
   directly from developer.adobe.com/uxp.
2. In Premiere Pro: Settings → Plugins → Enable Developer Mode → restart
   Premiere.
3. In UDT: Add Plugin → select `manifest.json` from this folder → Load
   (or Load & Watch for auto-reload on code changes).
4. In Premiere: Window → UXP Extensions → Safe Zone Pro.
5. Open a project with an active sequence and click the SAFE ZONE button.

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

## Updating the overlay

Edit `zones-config.json` (zone coordinates and tape style), check it, then
regenerate:

```
node validate-zones.js
node generate-overlays.js
python3 svg-to-png.py
```

Requires `pip install cairosvg --break-system-packages`.

`validate-zones.js` renders nothing — it checks the zone geometry and
reports how much margin survives the horizontal crop on real devices, so
zone tweaks don't need a visual round-trip.

### Why the zone is L-shaped

Players cover-fit the 1080×1920 canvas, so a screen narrower than 9:16
gets cropped horizontally:

```
crop_per_side = (1080 - 1920 × screenAR) / 2
```

Measured against real screenshots: 48px/side on a full-bleed iPhone,
28px/side on Android; worst case for a full-bleed 20:9 screen is 108px.
Because the UI icons are pinned to the *physical screen edge*, they
intrude further into canvas coordinates the more the canvas is cropped —
hence a flat 110px horizontal margin everywhere. Below y=1100 the right
margin grows to 220px to also clear the like/comment/share column, which
is what produces the L.

Vertical bounds come from the same screenshots: the Reels header ends at
canvas y≈240 (top margin 260) and the username/caption block starts at
y≈1749 (bottom margin 300).

## Licensing (sketch for a paid version)

Standard approach used by most small Premiere plugins (MassRename,
AutoSortBinsPro, etc.):

- **No-server key activation**: pre-generate keys (e.g. HMAC signature
  of email+seed), validate the checksum locally in the plugin — no
  backend needed for an MVP. Downside: a key can be copied across
  machines; fine for launch, not for scale.
- **Where to sell**: aescripts.com or Adobe Exchange — both take a cut
  but bring an audience of editors already buying this kind of plugin.

No licensing code included yet — validate the core functionality across
Premiere versions first, then invest in protection.
