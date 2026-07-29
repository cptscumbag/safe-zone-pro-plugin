/**
 * Safe Zone Pro — panel logic.
 *
 * API signatures below were verified against the official types.d.ts from
 * github.com/AdobeDocs/uxp-premiere-pro and confirmed live on Premiere
 * 26.3.0 during debugging (importFiles, executeTransaction,
 * SequenceEditor.createOverwriteItemAction, TrackItemSelection).
 *
 * Known API limitations (not bugs in this plugin):
 *  - Track locking (setLocked/isLocked) is currently NOT available in the
 *    UXP API (confirmed via an open Adobe community feature request) —
 *    this functionality is intentionally omitted; tracks are not
 *    auto-locked.
 *  - There is no method to delete a track itself via the UXP API — only
 *    to create one implicitly. The plugin works around this by reusing
 *    an empty track instead of creating a new one on every insert.
 */

const premierepro = require("premierepro");
const fs = require("uxp").storage.localFileSystem;

const PREFIX = "SAFE_ZONE_"; // used to find and remove clips created by this plugin

let config = null;

async function loadConfig() {
  const pluginFolder = await fs.getPluginFolder();
  const configFile = await pluginFolder.getEntry("zones-config.json");
  const text = await configFile.read();
  config = JSON.parse(text);
  document.getElementById("meta").textContent =
    `Zones updated: ${config.updated}`;
}

function renderButtons() {
  const container = document.getElementById("zoneButtons");
  container.innerHTML = "";

  Object.entries(config.platforms).forEach(([key, platform]) => {
    const btn = document.createElement("div");
    btn.className = "zone-btn";
    btn.id = `btn_${key}`;
    btn.innerHTML = `
      <span class="row">
        <span class="dot" style="background:${platform.color}"></span>
        ${platform.label}
      </span>
      <span>+</span>
    `;
    btn.addEventListener("click", () => addSafeZone(key, platform));
    container.appendChild(btn);
  });
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

async function addSafeZone(platformKey, platform) {
  setStatus(`Adding ${platform.label}...`);

  try {
    const project = await premierepro.Project.getActiveProject();
    if (!project) {
      setStatus("No open project.");
      return;
    }

    const sequence = await project.getActiveSequence();
    if (!sequence) {
      setStatus("No active sequence. Open a timeline first.");
      return;
    }
    console.log("STEP -1 OK: active sequence name =", sequence.name);

    // Decide: already present -> stop; anything else present -> replace it.
    const targetName = `${PREFIX}${platformKey}`;
    const existingTrackCount = await sequence.getVideoTrackCount();
    let sameZoneExists = false;
    let anyZoneExists = false;
    for (let i = 0; i < existingTrackCount; i++) {
      const track = await sequence.getVideoTrack(i);
      const items = await track.getTrackItems(
        premierepro.Constants.TrackItemType.CLIP,
        false
      );
      for (const item of items) {
        const name = await item.getName();
        if (!name || !name.startsWith(PREFIX)) continue;
        anyZoneExists = true;
        if (name === targetName) sameZoneExists = true;
      }
    }

    // Stale ProjectItems can linger in the bin even when the timeline is
    // clean (e.g. a previous cleanup failed) — treat those as needing a purge.
    const binCheckRaw = await project.getInsertionBin();
    const binCheck = await premierepro.FolderItem.cast(binCheckRaw);
    const staleBinItems = (await binCheck.getItems()).filter(
      (it) => it.name && it.name.startsWith(PREFIX)
    );

    if (sameZoneExists) {
      console.log("STEP -0.5: same zone already present, skipping insert");
      setStatus(`${platform.label} is already on the timeline.`);
      markActive(platformKey);
      return;
    }

    if (anyZoneExists || staleBinItems.length > 0) {
      console.log("STEP -0.5: replacing existing zone / purging stale items");
      const cleanupEditor = await premierepro.SequenceEditor.getEditor(sequence);
      await removeAllSafeZoneClips(project, sequence, cleanupEditor);
      clearActiveStates();
    }

    // 1. import the PNG overlay as a project media file
    const pluginFolder = await fs.getPluginFolder();
    const overlayEntry = await pluginFolder.getEntry(
      `overlays/${platform.filename}.png`
    );
    const overlayPath = overlayEntry.nativePath;
    console.log("STEP 0 OK: overlayPath =", overlayPath);

    const insertionBinRaw = await project.getInsertionBin();
    console.log("STEP 0b OK: insertionBinRaw =", insertionBinRaw);

    // getInsertionBin() returns a generic ProjectItem — bin methods
    // (getItems) are only available after casting to FolderItem
    const insertionBin = await premierepro.FolderItem.cast(insertionBinRaw);
    console.log("STEP 0c OK: insertionBin (cast) =", insertionBin);

    // importFiles(filePaths: string[], suppressUI?: boolean, targetBin?: ProjectItem, asNumberedStills?: boolean)
    // Returns Promise<boolean> — NOT an array of imported items!
    const importSuccess = await project.importFiles(
      [overlayPath],
      true, // suppressUI
      insertionBin, // targetBin
      false // asNumberedStills
    );
    console.log("STEP 1 OK: importSuccess =", importSuccess);

    if (!importSuccess) {
      setStatus("Failed to import overlay.");
      return;
    }

    // importFiles does not return the ProjectItem itself — find it in the
    // target bin by name. insertionBin is a FolderItem with getItems() -> ProjectItem[]
    const binItems = await insertionBin.getItems();
    console.log(
      "STEP 1b: binItems names =",
      binItems.map((i) => i.name)
    );

    const projectItem = binItems.find((item) =>
      item.name.startsWith(platform.filename)
    );
    if (!projectItem) {
      setStatus("Imported, but couldn't find the clip in the bin. Check console.");
      return;
    }
    console.log("STEP 1c OK: projectItem found", projectItem.name);

    // Rename — both createSetNameAction and executeTransaction must be
    // called inside lockedAccess (not just execute, but create too)
    project.lockedAccess(() => {
      const renameAction = projectItem.createSetNameAction(
        `${PREFIX}${platformKey}`
      );
      project.executeTransaction((compoundAction) => {
        compoundAction.addAction(renameAction);
      }, "Rename safe zone clip");
    });
    console.log("STEP 2 OK: renamed");

    // Insert into the timeline via SequenceEditor + Action
    const editor = await premierepro.SequenceEditor.getEditor(sequence);
    console.log("STEP 3 OK: editor", editor);

    const insertionTime = await premierepro.TickTime.createWithSeconds(0);
    const trackCount = await sequence.getVideoTrackCount();
    console.log("STEP 4 OK: trackCount =", trackCount);

    // Check the top existing track — if empty (e.g. left over from a
    // previously removed safe zone), reuse it instead of creating a new
    // track. Otherwise create a new one (index = trackCount).
    let targetTrackIndex = trackCount;
    if (trackCount > 0) {
      const topTrack = await sequence.getVideoTrack(trackCount - 1);
      const topTrackItems = await topTrack.getTrackItems(
        premierepro.Constants.TrackItemType.CLIP,
        false
      );
      console.log("STEP 4b: top track items count =", topTrackItems.length);
      if (topTrackItems.length === 0) {
        targetTrackIndex = trackCount - 1;
        console.log(
          "STEP 4c: top track is empty, reusing it instead of creating a new one:",
          targetTrackIndex
        );
      }
    }

    // overwrite (not insert!) — does not shift clips on other tracks.
    project.lockedAccess(() => {
      project.executeTransaction((compoundAction) => {
        const insertAction = editor.createOverwriteItemAction(
          projectItem,
          insertionTime,
          targetTrackIndex,
          -1 // audioTrackIndex: -1 = no audio
        );
        compoundAction.addAction(insertAction);
      }, "Insert safe zone clip");
    });
    console.log("STEP 6 OK: clip inserted on track", targetTrackIndex);

    // Stretch the clip to cover the full sequence length.
    const newTrack = await sequence.getVideoTrack(targetTrackIndex);
    const newTrackItems = await newTrack.getTrackItems(
      premierepro.Constants.TrackItemType.CLIP,
      false
    );
    console.log("STEP 7: newTrackItems count =", newTrackItems.length);

    const insertedItem = newTrackItems[0];
    if (!insertedItem) {
      setStatus("Clip inserted, but couldn't find it to stretch its length.");
      return;
    }

    // sequence.getOutPoint() is the work area, not the sequence length —
    // by default it's unset and returns a sentinel value. We compute the
    // real end of the sequence as the max getEndTime() across all clips
    // on all tracks (excluding the one we just created).
    let maxEndSeconds = 0;
    for (let i = 0; i < trackCount; i++) {
      if (i === targetTrackIndex) continue; // skip our own clip
      const track = await sequence.getVideoTrack(i);
      const items = await track.getTrackItems(
        premierepro.Constants.TrackItemType.CLIP,
        false
      );
      for (const item of items) {
        const endTime = await item.getEndTime();
        if (endTime.seconds > maxEndSeconds) {
          maxEndSeconds = endTime.seconds;
        }
      }
    }
    console.log("STEP 8: computed maxEndSeconds =", maxEndSeconds);

    if (maxEndSeconds <= 0) {
      setStatus(`${platform.label} added (empty sequence, not stretching).`);
      markActive(platformKey);
      return;
    }

    const sequenceEnd = await premierepro.TickTime.createWithSeconds(
      maxEndSeconds
    );

    project.lockedAccess(() => {
      const setEndAction = insertedItem.createSetEndAction(sequenceEnd);
      project.executeTransaction((compoundAction) => {
        compoundAction.addAction(setEndAction);
      }, "Extend safe zone to sequence length");
    });
    console.log("STEP 9 OK: stretched to", maxEndSeconds, "seconds");

    markActive(platformKey);
    setStatus(`${platform.label} added to timeline.`);
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message || err}`);
  }
}

function markActive(platformKey) {
  const btn = document.getElementById(`btn_${platformKey}`);
  if (btn) btn.classList.add("active");
}

function clearActiveStates() {
  document
    .querySelectorAll(".zone-btn.active")
    .forEach((el) => el.classList.remove("active"));
}

async function removeAllSafeZoneClips(project, sequence, editor) {
  if (!project || !sequence || !editor) {
    throw new Error("No active project/sequence — open a timeline and try again.");
  }
  const trackCount = await sequence.getVideoTrackCount();
  let foundItems = [];

  for (let i = 0; i < trackCount; i++) {
    const track = await sequence.getVideoTrack(i);
    const items = await track.getTrackItems(
      premierepro.Constants.TrackItemType.CLIP,
      false
    );
    for (const item of items) {
      const name = await item.getName();
      if (name && name.startsWith(PREFIX)) {
        foundItems.push(item);
      }
    }
  }

  if (foundItems.length === 0) {
    return 0;
  }

  let selection;
  project.lockedAccess(() => {
    premierepro.TrackItemSelection.createEmptySelection((sel) => {
      selection = sel;
      foundItems.forEach((item) => selection.addItem(item));
    });

    const removeAction = editor.createRemoveItemsAction(
      selection,
      false, // ripple
      premierepro.Constants.MediaType.VIDEO,
      false // shiftOverLapping
    );

    project.executeTransaction((compoundAction) => {
      compoundAction.addAction(removeAction);
    }, "Remove safe zones");
  });

  const insertionBinRaw = await project.getInsertionBin();
  const insertionBin = await premierepro.FolderItem.cast(insertionBinRaw);
  const binItems = await insertionBin.getItems();
  const binItemsToRemove = binItems.filter(
    (item) => item.name && item.name.startsWith(PREFIX)
  );

  if (binItemsToRemove.length > 0) {
    project.lockedAccess(() => {
      project.executeTransaction((compoundAction) => {
        binItemsToRemove.forEach((item) => {
          const removeFromBinAction = insertionBin.createRemoveItemAction(item);
          compoundAction.addAction(removeFromBinAction);
        });
      }, "Remove safe zone project items");
    });
  }

  return foundItems.length;
}

async function removeAllSafeZones() {
  setStatus("Removing all zones...");

  try {
    const project = await premierepro.Project.getActiveProject();
    if (!project) {
      setStatus("No open project.");
      return;
    }
    let sequence = await project.getActiveSequence();
    if (!sequence) {
      // getActiveSequence() occasionally returns null right after an edit —
      // retry once before giving up.
      sequence = await project.getActiveSequence();
    }
    if (!sequence) {
      setStatus("No active sequence. Click the timeline, then try again.");
      return;
    }
    const editor = await premierepro.SequenceEditor.getEditor(sequence);

    const removedCount = await removeAllSafeZoneClips(project, sequence, editor);

    clearActiveStates();
    setStatus(
      removedCount > 0
        ? `Zones removed: ${removedCount}.`
        : "No active zones found on the timeline."
    );
  } catch (err) {
    console.error(err);
    setStatus(`Error while removing: ${err.message || err}`);
  }
}

document
  .getElementById("removeAll")
  .addEventListener("click", removeAllSafeZones);

loadConfig()
  .then(renderButtons)
  .catch((err) => {
    console.error(err);
    setStatus("Failed to load zones config.");
  });
