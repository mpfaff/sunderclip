import { For, Show, createEffect, onMount } from "solid-js";
import { useAppContext } from "../../contexts/AppContext";
import Panel from "../panel/Panel";

import panelStyles from "../panel/PanelCommon.module.css";
import styles from "./Export.module.css";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { createStore } from "solid-js/store";
import { path } from "@tauri-apps/api";
import { invoke } from "@tauri-apps/api/core";

import { ExportInfo, RateControlType, RenderInfo } from "../../../types";
import { AudioCodec, AudioCodecs, VendorSuffix, VideoCodec, VideoCodecHwVendorSuffixes, VideoCodecs } from "./Codecs";
import { exists } from "@tauri-apps/plugin-fs";
import { round } from "../../util";

type Codec<T> = {
  id: string; // FFMPEG encoder ID
  name: T; // Key of VideoCodec or AudioCodec
};

export default function Export() {
  const [{ mediaData, videoFile }, {}, { render }] = useAppContext();

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
    videoCodecId: Object.values(VideoCodecs)[0].cpu,
    audioCodecId: Object.values(AudioCodecs)[0].id,
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

  let formRef!: HTMLFormElement;
  let rateControlSelect!: HTMLSelectElement;

  createEffect(() => {
    // Set initial default values for new video

    if (mediaData() == null) return;
    const { width, height, fps, filename, streams } = mediaData()!;

    setExportInfo("width", width);
    setExportInfo("height", height);
    setExportInfo("fps", fps);
    setExportInfo("filename", filename);
    setExportInfo(
      "mergeAudioTracks",
      streams.filter((stream) => stream.codec_type === "audio").map((stream) => stream.index)
    );
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
    if (exportInfo.rateControl === "crf") setExportInfo("crfValue", VideoCodecs[exportInfo.videoCodec].crf?.default!);
  });

  createEffect(() => {
    exportInfo.videoCodec; // Run on video codec change

    // Auto select compatible rate control if current one is not compatible with new codec
    if (rateControlSelect.options[rateControlSelect.selectedIndex].disabled) {
      for (let i = 0; i < rateControlSelect.options.length; i++) {
        const option = rateControlSelect.options[i];
        if (!option.disabled) {
          rateControlSelect.selectedIndex = i;
          setExportInfo("rateControl", option.value as RateControlType);

          break;
        }
      }
    }
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

  async function beginRender() {
    if (!formRef.reportValidity()) return;

    const settings: RenderInfo = {
      aCodecId: exportInfo.audioCodecId,
      vCodecId: exportInfo.videoCodecId,
      vCodecName: exportInfo.videoCodec,
      aCodecName: exportInfo.audioCodec,
      rateControl: exportInfo.rateControl,
      targetBitrate: exportInfo.targetBitrate || 0,
      maxBitrate: exportInfo.maxBitrate || 0,
      minBitrate: exportInfo.minBitrate || 0,
      overrideFile: false,
      crfValue: exportInfo.crfValue!,
      bufSize: (exportInfo.targetBitrate || 0) * 2,
      inputFilepath: videoFile()!,
      outputFilepath: exportInfo.absolutePath!,
      audioTracks: exportInfo.mergeAudioTracks,
    };

    const fileExists = await exists(settings.outputFilepath);

    if (fileExists) {
      const overridePrompt = await ask("A file with the same name already exists at this location. Would you like to replace it?", {
        title: "File Conflict",
        kind: "info",
        okLabel: "Replace",
      });

      if (!overridePrompt) {
        return;
      } else {
        settings.overrideFile = true;
      }
    }

    render(
      settings,
      exportInfo.limitSize
        ? {
            maxAttempts: exportInfo.sizeLimitDetails.maxAttempts,
            maxSize: exportInfo.sizeLimitDetails.maxSize,
            retryThreshold: exportInfo.sizeLimitDetails.retryThreshold,
          }
        : null
    );
  }

  return (
    <Panel column class={styles.export}>
      <h2 class={panelStyles.heading}>Export Settings</h2>

      <form action="#" class={styles.export__form} ref={(ref) => (formRef = ref)}>
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
                min="1"
                disabled
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
                min="1"
                disabled
                value={exportInfo.height || ""}
                required
                onInput={(e) => setExportInfo("height", e.target.valueAsNumber)}
              />
            </div>
            <div class={styles.export__inputGroup} style={{ "grid-area": "lock" }}>
              <label for="lock-aspect">Lock Ratio</label>
              <input type="checkbox" name="lock-aspect" id="lock-aspect" checked disabled onInput={(e) => setExportInfo("lockRatio", e.target.checked)} />
            </div>
            <div class={styles.export__inputGroup} style={{ "grid-area": "fps" }}>
              <label for="fps">Frame Rate</label>
              <input
                type="number"
                name="fps"
                id="fps"
                disabled
                value={exportInfo.fps || ""}
                required
                onInput={(e) => setExportInfo("fps", e.target.valueAsNumber)}
                step="0.01"
              />
            </div>
            <div class={styles.export__inputGroup} style={{ "grid-area": "v-codec" }}>
              <label for="video-codec">Video Codec</label>
              <select
                name="video-codec"
                id="video-codec"
                onInput={(e) => {
                  setExportInfo("videoCodec", e.target.value as VideoCodec);
                  setExportInfo("videoCodecId", e.target.options[e.target.selectedIndex].dataset["codecId"]!);
                }}
              >
                <For each={supportedCodecs.video}>
                  {(codec) => {
                    const encoder = VideoCodecs[codec.name];

                    return (
                      <option value={codec.name} data-codec-id={codec.id}>
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
              <select
                name="audio-codec"
                id="audio-codec"
                onInput={(e) => {
                  setExportInfo("audioCodec", e.target.value as AudioCodec);
                  setExportInfo("audioCodecId", e.target.options[e.target.selectedIndex].dataset["codecId"]!);
                }}
              >
                <For each={supportedCodecs.audio}>
                  {(codec) => (
                    <option value={codec.name} data-codec-id={codec.id}>
                      {AudioCodecs[codec.name].friendlyName}
                    </option>
                  )}
                </For>
              </select>
            </div>
          </div>
        </fieldset>
        <fieldset class={styles.export__fieldset}>
          <div class={`${styles.export__group}`}>
            <div class={styles.export__inputGroup}>
              <label for="rate-control">Rate control</label>
              <select
                name="rate-control"
                id="rate-control"
                ref={(ref) => (rateControlSelect = ref)}
                onInput={(e) => setExportInfo("rateControl", e.target.value as RateControlType)}
              >
                <option value="cbr" disabled={VideoCodecs[exportInfo.videoCodec].rateControl["cbr"] == null}>
                  CBR (constant bitrate)
                </option>
                <option value="vbr" disabled={VideoCodecs[exportInfo.videoCodec].rateControl["vbr"] == null}>
                  VBR (variable bitrate)
                </option>
                <option value="abr" disabled={VideoCodecs[exportInfo.videoCodec].rateControl["abr"] == null}>
                  ABR (average bitrate)
                </option>

                {/* CRF controls constant quality, thus impractical to use with size limit */}
                <option value="crf" disabled={exportInfo.limitSize || VideoCodecs[exportInfo.videoCodec].rateControl["crf"] == null}>
                  CRF (quality control)
                </option>
              </select>
            </div>
            <Show when={exportInfo.rateControl.endsWith("br")}>
              <div class={styles.export__inputGroup}>
                <label for="target-bitrate">Target Bitrate (Kbps)</label>
                <input
                  type="number"
                  name="target-bitrate"
                  id="target-bitrate"
                  min="0.1"
                  value={mediaData() != null ? round((mediaData()!.size * 8) / mediaData()!.duration / 1000, 0) : ""}
                  onInput={(e) => setExportInfo("targetBitrate", e.target.valueAsNumber)}
                  required
                  disabled={exportInfo.limitSize}
                />
              </div>
            </Show>
            <Show when={exportInfo.rateControl === "vbr" && VideoCodecs[exportInfo.videoCodec].rateControl["vbr"] != null}>
              <div class={styles.export__inputGroup}>
                <label for="min-bitrate">Min Bitrate (Kbps)</label>
                <input
                  type="number"
                  name="min-bitrate"
                  id="min-bitrate"
                  min="0.1"
                  onInput={(e) => setExportInfo("minBitrate", e.target.valueAsNumber)}
                  required
                  disabled={exportInfo.limitSize}
                />
              </div>
              <div class={styles.export__inputGroup}>
                <label for="max-bitrate">Max Bitrate (Kbps)</label>
                <input
                  type="number"
                  name="max-bitrate"
                  id="max-bitrate"
                  min="0.1"
                  onInput={(e) => setExportInfo("maxBitrate", e.target.valueAsNumber)}
                  required
                  disabled={exportInfo.limitSize}
                />
              </div>
            </Show>
            <Show when={exportInfo.rateControl === "crf"}>
              <div class={styles.export__inputGroup}>
                <label for="crf-value">CRF: {exportInfo.crfValue}</label>
                <input
                  type="range"
                  name="crf-value"
                  id="crf-value"
                  min={VideoCodecs[exportInfo.videoCodec].crf!.min}
                  max={VideoCodecs[exportInfo.videoCodec].crf!.max}
                  value={exportInfo.crfValue || ""}
                  onInput={(e) => setExportInfo("crfValue", e.target.valueAsNumber)}
                  disabled={exportInfo.limitSize}
                />
              </div>
            </Show>
          </div>
        </fieldset>
        <fieldset class={styles.export__fieldset}>
          <div class={styles.export__group}>
            <p style={{ width: "100%" }}>Merge Audio Tracks</p>
            <For each={mediaData()?.streams.filter((stream) => stream.codec_type === "audio")}>
              {(stream) => {
                const id = `audio-track-${stream.index}`;

                return (
                  <>
                    <label for={id}>{stream.index}</label>
                    <input
                      type="checkbox"
                      name={id}
                      id={id}
                      checked
                      onInput={(e) =>
                        setExportInfo("mergeAudioTracks", (tracks) => {
                          if (e.target.checked) tracks.push(stream.index);
                          else tracks = tracks.filter((trackIndex) => trackIndex != stream.index);
                          return tracks;
                        })
                      }
                    />
                  </>
                );
              }}
            </For>
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
                min="0.01"
                required
                onInput={(e) => setExportInfo("sizeLimitDetails", "maxSize", e.target.valueAsNumber)}
              />
            </div>
            <div class={styles.export__inputGroup}>
              <label for="max-attempts">Max attempts</label>
              <input
                type="number"
                name="max-attempts"
                id="max-attempts"
                value={exportInfo.sizeLimitDetails.maxAttempts}
                min="2"
                step="1"
                required
                onInput={(e) => setExportInfo("sizeLimitDetails", "maxAttempts", e.target.valueAsNumber)}
              />
            </div>
            <div class={styles.export__inputGroup}>
              <label for="retry-threshold">Retry Threshold (%)</label>
              <input
                type="number"
                name="retry-threshold"
                id="retry-threshold"
                value={exportInfo.sizeLimitDetails.retryThreshold}
                required
                min="0"
                max="1"
                step="0.01"
                onInput={(e) => setExportInfo("sizeLimitDetails", "retryThreshold", e.target.valueAsNumber)}
              />
            </div>
          </div>
        </fieldset>
      </form>
      <div class={styles.export_btns}>
        <button class={styles.export__btn} onClick={beginRender}>
          Export
        </button>
      </div>
    </Panel>
  );
}
