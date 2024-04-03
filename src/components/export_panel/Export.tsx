import { createEffect, createSignal, onMount } from "solid-js";
import { useAppContext } from "../../contexts/AppContext";
import Panel from "../panel/Panel";

import panelStyles from "../panel/PanelCommon.module.css";
import styles from "./Export.module.css";
import { open } from "@tauri-apps/plugin-dialog";
import { createStore } from "solid-js/store";
import { ExportInfo } from "../../../types";
import { path } from "@tauri-apps/api";

export default function Export() {
  const [{ mediaData }, { setRendering }] = useAppContext();

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
    <Panel column class={styles.export}>
      <h2 class={panelStyles.heading}>Export Settings</h2>

      <form action="#" class={styles.export__form}>
        <fieldset class={styles.export__fieldset}>
          <div class={styles.export__inputGroup}>
            <label for="location">Location</label>
            <input
              type="button"
              name="location"
              id="location"
              required
              value={exportInfo.filepath || "Select folder"}
              onClick={async () => {
                const savePath = await open({ directory: true });
                if (exportInfo.filepath == null && savePath != null) setExportInfo("filepath", savePath);
              }}
            />
          </div>
          <div class={styles.export__inputGroup}>
            <label for="filename">File Name</label>
            <input
              type="text"
              name="filename"
              id="filename"
              required
              onInput={(e) => setExportInfo("filename", e.target.value)}
              value={mediaData()?.filename}
            />
          </div>

          <p>
            Video will save to: <br />
            <span>{exportInfo.absolutePath}</span>
          </p>
        </fieldset>
        <fieldset class={styles.export__fieldset}>
          <div class={`${styles.export__group} ${styles.export__video}`}>
            <div class={styles.export__inputGroup} style={{ "grid-area": "x-res" }}>
              <label for="resolution">Width</label>
              <input type="number" name="width" id="width" value={mediaData()?.width} required />
            </div>
            <div class={styles.export__inputGroup} style={{ "grid-area": "y-res" }}>
              <label for="height">Height</label>
              <input type="number" name="height" id="height" value={mediaData()?.height} required />
            </div>
            <div class={styles.export__inputGroup} style={{ "grid-area": "lock" }}>
              <label for="lock-aspect">Lock Ratio</label>
              <input type="checkbox" name="lock-aspect" id="lock-aspect" checked />
            </div>
            <div class={styles.export__inputGroup} style={{ "grid-area": "fps" }}>
              <label for="fps">Frame Rate</label>
              <input type="number" name="fps" id="fps" value={mediaData()?.fps} required />
            </div>
            <div class={styles.export__inputGroup} style={{ "grid-area": "v-codec" }}>
              <label for="video-codec">Video Codec</label>
              <select name="video-codec" id="video-codec"></select>
            </div>
            <div class={styles.export__inputGroup} style={{ "grid-area": "a-codec" }}>
              <label for="audio-codec">Audio Codec</label>
              <select name="audio-codec" id="audio-codec"></select>
            </div>
          </div>
        </fieldset>
        <fieldset class={styles.export__fieldset}>
          <div class={styles.export__inputGroup}>
            <label for="target-bitrate">Target Bitrate</label>
            <input type="number" name="target-bitrate" id="target-bitrate" />
          </div>
          <div class={styles.export__inputGroup}>
            <label for="rate-control">Rate control</label>
            <select name="rate-control" id="rate-control">
              <option value="cbr">CBR (constant bitrate)</option>
              <option value="vbr">VBR (variable bitrate)</option>
            </select>
          </div>
          <div class={styles.export__inputGroup}>
            <label for="limit-size">Limit Size?</label>
            <input type="checkbox" name="limit-size" id="limit-size" />
          </div>
          <div class={styles.export__inputGroup}>
            <label for="max-size">Max File Size</label>
            <input type="number" name="max-size" id="max-size" />
          </div>
          <div class={styles.export__inputGroup}>
            <label for="max-attempts">Max attempts</label>
            <input type="number" name="max-attempts" id="max-attempts" value="3" />
          </div>
          <div class={styles.export__inputGroup}>
            <label for="retry-threshold">Retry Threshold</label>
            <input type="number" name="retry-threshold" id="retry-threshold" value="0.1" />
          </div>
        </fieldset>
      </form>
      <div class={styles.export_btns}>
        <button class={styles.export__btn} onClick={() => setRendering(true)}>
          Export
        </button>
      </div>
    </Panel>
  );
}
