import { For, Show, createEffect, createSignal, onMount } from "solid-js";
import { useAppContext } from "../../contexts/AppContext";
import Panel from "../panel/Panel";

import panelStyles from "../panel/PanelCommon.module.css";
import styles from "./Export.module.css";
import { open } from "@tauri-apps/plugin-dialog";
import { createStore } from "solid-js/store";
import { path } from "@tauri-apps/api";
import { invoke } from "@tauri-apps/api/core";

import { ExportInfo, RateControlType } from "../../../types";
import { AudioCodec, AudioCodecs, VendorSuffix, VideoCodec, VideoCodecHwVendorSuffixes, VideoCodecs } from "./Codecs";

type Codec<T> = {
  id: string; // FFMPEG encoder ID
  name: T; // Key of VideoCodec or AudioCodec
};

export default function Export() {
  const [{ mediaData }, { setRendering }] = useAppContext();

  const [exportInfo, setExportInfo] = createStore<ExportInfo>({
    filename: null,
    fileExt: null,
    filepath: localStorage.getItem("export_filepath"),
    absolutePath: null,
    width: null,
    lockRatio: true,
    height: null,
    fps: null,
    videoCodec: "h264",
    audioCodec: "aac",
    limitSize: false,
    crfValue: null,
    targetBitrate: null,
    minBitrate: null,
    maxBitrate: null,
    mergeAudioTracks: [],
    rateControl: "cbr",
    sizeLimitDetails: { maxAttempts: 3, maxSize: 0, retryThreshold: 0.1 },
  });

  const [supportedCodecs, setSupportedCodecs] = createStore<{ video: Codec<VideoCodec>[]; audio: Codec<AudioCodec>[] }>({
    video: [],
    audio: [],
  });

  createEffect(() => {
    // Set initial default values for new video

    if (mediaData() == null) return;
    const { width, height, fps, filename } = mediaData()!;

    setExportInfo("width", width);
    setExportInfo("height", height);
    setExportInfo("fps", fps);
    setExportInfo("filename", filename);
  });

  createEffect(async () => {
    // Sync absolute path with other properties

    const filepath = exportInfo.filepath;
    const fileExt = exportInfo.fileExt;
    const filename = exportInfo.filename;
    if (filepath == null || filename == null || fileExt == null) return;

    setExportInfo("absolutePath", (await path.join(filepath, filename || "")) + `.${fileExt}`);
  });

  createEffect(() => {
    // Sync video codec with appropriate container

    if (exportInfo.videoCodec == null) return;
    setExportInfo("fileExt", VideoCodecs[exportInfo.videoCodec].container);
  });

  createEffect(() => {
    // Sync default CRF value
    if (exportInfo.rateControl === "crf") setExportInfo("crfValue", VideoCodecs[exportInfo.videoCodec!].crf?.default!);
  });

  onMount(async () => {
    const encodersArray = await invoke<string[]>("get_encoders");
    const encoders = new Set(encodersArray);

    for (const codec of Object.keys(VideoCodecs)) {
      const encoder = VideoCodecs[codec as VideoCodec];

      const supportedEncoders: Codec<VideoCodec>[] = [];
      if (encoders.has(encoder.cpu)) supportedEncoders.push({ id: encoder.cpu, name: codec as VideoCodec });
      for (const suffix of Object.keys(VideoCodecHwVendorSuffixes)) {
        const encoderName = `${encoder.hwPrefix}_${suffix}`;
        if (encoders.has(encoderName)) supportedEncoders.push({ id: encoderName, name: codec as VideoCodec });
      }

      setSupportedCodecs("video", (prev) => [...prev, ...supportedEncoders]);
    }
    setExportInfo("fileExt", VideoCodecs[supportedCodecs.video[0].name].container);

    for (const codec of Object.keys(AudioCodecs)) {
      const encoder = AudioCodecs[codec as AudioCodec];
      if (encoders.has(encoder.id)) setSupportedCodecs("audio", (prev) => [...prev, { id: encoder.id, name: codec as AudioCodec }]);
    }
  });

  return (
    <Panel column class={styles.export}>
      <h2 class={panelStyles.heading}>Export Settings</h2>

      <form action="#" class={styles.export__form}>
        <fieldset class={styles.export__fieldset}>
          <div class={styles.export__inputGroup}>
            <label for="location">Location</label>
            <div class={styles.export__inputRow} style={{ gap: "0.5em" }}>
              <Show when={exportInfo.filepath != null}>
                <span class={`force-wrap ${styles.export__folder_text}`}>{exportInfo.filepath}</span>
              </Show>

              <input
                type="button"
                name="location"
                id="location"
                required
                value={exportInfo.filepath != null ? "Change" : "Select folder"}
                style={{ width: "unset", "flex-grow": 1 }}
                onClick={async () => {
                  const savePath = await open({ directory: true });
                  if (savePath != null && savePath !== exportInfo.filepath) {
                    setExportInfo("filepath", savePath);
                    localStorage.setItem("export_filepath", savePath);
                  }
                }}
              />
            </div>
          </div>
          <div class={styles.export__inputGroup}>
            <label for="filename">File Name</label>
            <div class={styles.export__inputRow}>
              <input
                type="text"
                name="filename"
                id="filename"
                required
                onInput={(e) => setExportInfo("filename", e.target.value)}
                placeholder="Enter filename"
                value={exportInfo.filename || ""}
              />
              <span>.{exportInfo.fileExt}</span>
            </div>
          </div>

          <p class={styles.export__location_text}>
            Video will save to: <br />
            <span class="force-wrap">{exportInfo.absolutePath || "[No location selected]"}</span>
          </p>
        </fieldset>
        <fieldset class={styles.export__fieldset}>
          <div class={`${styles.export__group} ${styles.export__video}`}>
            <div class={styles.export__inputGroup} style={{ "grid-area": "x-res" }}>
              <label for="resolution">Width</label>
              <input
                type="number"
                name="width"
                id="width"
                value={exportInfo.width || ""}
                required
                onInput={(e) => setExportInfo("width", e.target.valueAsNumber)}
              />
            </div>
            <div class={styles.export__inputGroup} style={{ "grid-area": "y-res" }}>
              <label for="height">Height</label>
              <input
                type="number"
                name="height"
                id="height"
                value={exportInfo.height || ""}
                required
                onInput={(e) => setExportInfo("height", e.target.valueAsNumber)}
              />
            </div>
            <div class={styles.export__inputGroup} style={{ "grid-area": "lock" }}>
              <label for="lock-aspect">Lock Ratio</label>
              <input type="checkbox" name="lock-aspect" id="lock-aspect" checked onInput={(e) => setExportInfo("lockRatio", e.target.checked)} />
            </div>
            <div class={styles.export__inputGroup} style={{ "grid-area": "fps" }}>
              <label for="fps">Frame Rate</label>
              <input type="number" name="fps" id="fps" value={exportInfo.fps || ""} required onInput={(e) => setExportInfo("fps", e.target.valueAsNumber)} />
            </div>
            <div class={styles.export__inputGroup} style={{ "grid-area": "v-codec" }}>
              <label for="video-codec">Video Codec</label>
              <select name="video-codec" id="video-codec" onInput={(e) => setExportInfo("videoCodec", e.target.value as VideoCodec)}>
                <For each={supportedCodecs.video}>
                  {(codec) => {
                    const encoder = VideoCodecs[codec.name];

                    return (
                      <option value={codec.name}>
                        {`${encoder.friendlyName} (${
                          encoder.hwPrefix != null && codec.id.startsWith(encoder.hwPrefix!)
                            ? `GPU ${VideoCodecHwVendorSuffixes[codec.id.slice(encoder.hwPrefix.length + 1) as VendorSuffix]}`
                            : "CPU"
                        })`}
                      </option>
                    );
                  }}
                </For>
              </select>
            </div>
            <div class={styles.export__inputGroup} style={{ "grid-area": "a-codec" }}>
              <label for="audio-codec">Audio Codec</label>
              <select name="audio-codec" id="audio-codec" onInput={(e) => setExportInfo("audioCodec", e.target.value as AudioCodec)}>
                <For each={supportedCodecs.audio}>{(codec) => <option value={codec.name}>{AudioCodecs[codec.name].friendlyName}</option>}</For>
              </select>
            </div>
          </div>
        </fieldset>
        <fieldset class={styles.export__fieldset}>
          <div class={`${styles.export__group} ${styles}`}>
            <div class={styles.export__inputGroup}>
              <label for="rate-control">Rate control</label>
              <select name="rate-control" id="rate-control" onInput={(e) => setExportInfo("rateControl", e.target.value as RateControlType)}>
                <option value="cbr">CBR (constant bitrate)</option>
                <option value="vbr">VBR (variable bitrate)</option>
                <option value="abr">ABR (average bitrate)</option>
                <option value="crf">CRF (quality control)</option>
              </select>
            </div>
            <Show when={exportInfo.rateControl.endsWith("br")}>
              <div class={styles.export__inputGroup}>
                <label for="target-bitrate">Target Bitrate (Kbps)</label>
                <input type="number" name="target-bitrate" id="target-bitrate" onInput={(e) => setExportInfo("targetBitrate", e.target.valueAsNumber)} />
              </div>
            </Show>
            <Show when={exportInfo.rateControl === "vbr" && VideoCodecs[exportInfo.videoCodec!].rateControl["vbr"] != null}>
              <div class={styles.export__inputGroup}>
                <label for="min-bitrate">Min Bitrate (Kbps)</label>
                <input type="number" name="min-bitrate" id="min-bitrate" onInput={(e) => setExportInfo("minBitrate", e.target.valueAsNumber)} />
              </div>
              <div class={styles.export__inputGroup}>
                <label for="max-bitrate">Max Bitrate (Kbps)</label>
                <input type="number" name="max-bitrate" id="max-bitrate" onInput={(e) => setExportInfo("maxBitrate", e.target.valueAsNumber)} />
              </div>
            </Show>
            <Show when={exportInfo.rateControl === "crf"}>
              <div class={styles.export__inputGroup}>
                <label for="crf-value">CRF: {exportInfo.crfValue}</label>
                <input
                  type="range"
                  name="crf-value"
                  id="crf-value"
                  min={VideoCodecs[exportInfo.videoCodec!].crf!.min}
                  max={VideoCodecs[exportInfo.videoCodec!].crf!.max}
                  value={exportInfo.crfValue || ""}
                  onInput={(e) => setExportInfo("crfValue", e.target.valueAsNumber)}
                />
              </div>
            </Show>
          </div>
        </fieldset>
        <div class={styles.export__inputGroup} style={{ "margin-top": "0.5em" }}>
          <div class={styles.export__group}>
            <label for="limit-size">Limit Size?</label>
            <input type="checkbox" name="limit-size" id="limit-size" style={{ margin: "0" }} onInput={(e) => setExportInfo("limitSize", e.target.checked)} />
          </div>
        </div>
        <fieldset class={styles.export__fieldset} disabled={!exportInfo.limitSize}>
          <div class={`${styles.export__group} ${styles.export__max_size}`}>
            <div class={styles.export__inputGroup}>
              <label for="max-size">Max File Size (MB)</label>
              <input
                type="number"
                name="max-size"
                id="max-size"
                required
                onInput={(e) => setExportInfo("sizeLimitDetails", "maxSize", e.target.valueAsNumber)}
              />
            </div>
            <div class={styles.export__inputGroup}>
              <label for="max-attempts">Max attempts</label>
              <input type="number" name="max-attempts" id="max-attempts" value={exportInfo.sizeLimitDetails.maxAttempts} required />
            </div>
            <div class={styles.export__inputGroup}>
              <label for="retry-threshold">Retry Threshold</label>
              <input type="number" name="retry-threshold" id="retry-threshold" value={exportInfo.sizeLimitDetails.retryThreshold} required />
            </div>
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
