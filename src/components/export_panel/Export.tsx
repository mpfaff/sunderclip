import { createEffect, createSignal } from "solid-js";
import { useAppContext } from "../../contexts/AppContext";
import Panel from "../panel/Panel";

import panelStyles from "../panel/PanelCommon.module.css";
import styles from "./Export.module.css";
import { open } from "@tauri-apps/plugin-dialog";
import { createStore } from "solid-js/store";
import { ExportInfo } from "../../../types";
import { path } from "@tauri-apps/api";

export default function Export() {
  const [{}, { setRendering }] = useAppContext();

  const [exportInfo, setExportInfo] = createStore<ExportInfo>({
    filename: null,
    filepath: null,
    absolutePath: null,
    videoCodec: null,
    audioCodec: null,
    limitSize: false,
    mergeAudioTracks: [],
    sizeLimitDetails: { rateControl: "cbr", maxSize: 0 },
  });
  const [supportedCodecs, setSupportedCodecs] = createStore<{ video: string[]; audio: string[] }>({ video: [], audio: [] });

  createEffect(async () => {
    if (exportInfo.filepath == null) return;
    setExportInfo("absolutePath", await path.join(exportInfo.filepath, exportInfo.filename || ""));
  });

  return (
    <Panel column>
      <h2 class={panelStyles.heading}>Export Settings</h2>

      <form action="#" class={styles.export__form}>
        <fieldset>
          <label for="save-location">Save Location</label>
          <input
            type="button"
            name="save-location"
            id="save-location"
            onClick={async () => {
              const savePath = await open({ directory: true });
              setExportInfo("filepath", savePath);
            }}
          />

          <label for="filename">File Name</label>
          <input type="text" name="filename" id="filename" required onInput={(e) => setExportInfo("filename", e.target.value)} />

          <p>Video will save to: {exportInfo.absolutePath}</p>
        </fieldset>
        <fieldset>
          <label for="video-codec">Video Codec</label>
          <select name="video-codec" id="video-codec"></select>

          <label for="audio-codec">Audio Codec</label>
          <select name="audio-codec" id="audio-codec"></select>
        </fieldset>
      </form>

      <button class={styles.export__btn} onClick={() => setRendering(true)}>
        Export
      </button>
    </Panel>
  );
}
