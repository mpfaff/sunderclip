import { invoke } from "@tauri-apps/api/core";
import { ProgressData, RawProgress, RenderMeta, RenderSettings, RenderSizeLimit } from "../../types";
import { remove, stat } from "@tauri-apps/plugin-fs";
import { Event, UnlistenFn, listen } from "@tauri-apps/api/event";
import { VideoCodecs } from "../components/export_panel/Codecs";

export default class Renderer {
  private settings: RenderSettings & { codecRateControl: string[] };
  private sizeLimit: RenderSizeLimit | null;
  private meta: RenderMeta;
  private lastProgress: ProgressData | undefined;

  private _currentAttempt = 0;
  private currentRenderId: number | undefined;

  private progressUnlistener: UnlistenFn | undefined;
  private listeners: Set<(data: ProgressData) => void> = new Set();

  private static errorPrefix = "error:";

  private static generateRateControlCmd(settings: RenderSettings) {
    const rateControlCommand: string[] = [];
    const replacementMap = new Map([
      ["TARGET_BITRATE", "targetBitrate"],
      ["MIN_BITRATE", "minBitrate"],
      ["MAX_BITRATE", "maxBitrate"],
      ["CRF_VALUE", "crfValue"],
      ["BUF_SIZE", "bufSize"],
    ]);

    for (const arg of VideoCodecs[settings.vCodecName].rateControl[settings.rateControl]!) {
      const openingBracketIndex = arg.indexOf("{");

      if (openingBracketIndex != -1) {
        const template = arg.slice(openingBracketIndex + 1, arg.indexOf("}"));

        if (replacementMap.has(template))
          rateControlCommand.push(arg.replace(`{${template}}`, settings[replacementMap.get(template)! as keyof RenderSettings].toString()));
      } else {
        rateControlCommand.push(arg);
      }
    }

    return rateControlCommand;
  }

  constructor(settings: RenderSettings, sizeLimit: RenderSizeLimit | null, meta: RenderMeta) {
    if (sizeLimit != null) {
      const duration = settings.trimEnd - settings.trimStart;
      const theoreticalConstantBitrateKbps = ((sizeLimit.maxSize * 8) / duration) * 1000;

      settings.targetBitrate = theoreticalConstantBitrateKbps;
      settings.maxBitrate = theoreticalConstantBitrateKbps;
      settings.minBitrate = 0;
    }

    this.settings = { ...settings, codecRateControl: Renderer.generateRateControlCmd(settings) };
    this.sizeLimit = sizeLimit;
    this.meta = meta;

    console.log(this.settings, this.sizeLimit);
  }

  get currentAttempt() {
    return this._currentAttempt;
  }
  get maxAttempts() {
    return this.sizeLimit != null ? this.sizeLimit.maxAttempts : 1;
  }
  get outputFilepath() {
    return this.settings.outputFilepath;
  }

  async init() {
    this.progressUnlistener = await listen<string>("export_progress", (data) => this.handleProgress(data));
  }

  handleProgress(data: Event<string>) {
    const lines = data.payload;

    const progress: ProgressData = this.lastProgress || {
      errored: false,
      percentage: 0,
      currentTimeMs: 0,
      fps: 0,
      eta: null,
      speed: 1,
      done: false,
    };

    if (lines.startsWith(Renderer.errorPrefix)) {
      alert(lines.slice(Renderer.errorPrefix.length));
      progress.errored = true;
    }

    if (!progress.errored) {
      lines.split("\n").forEach((property) => {
        const [name, value] = property.split("=") as [keyof RawProgress, string];
        const validValue = value !== "N/A";

        if (!validValue) return;

        switch (name) {
          case "out_time_us": {
            progress.currentTimeMs = Number(value) / 1000;
            progress.percentage = progress.currentTimeMs / 1000 / this.meta.totalDuration;
            break;
          }
          case "speed": {
            progress.speed = parseFloat(value);
            progress.eta = new Date(Date.now() + (this.meta.totalDuration * 1000 - progress.currentTimeMs) / progress.speed);
            break;
          }
          case "fps": {
            progress.fps = parseFloat(value);
            break;
          }
          case "progress": {
            progress.done = value === "end" ? true : false;
            if (progress.done) progress.percentage = 1;
          }
        }
      });
    }

    this.lastProgress = progress;

    for (const listener of this.listeners.values()) {
      listener(progress);
    }

    if (progress.errored) {
      this.cleanup();
      return;
    }

    if (progress.done) this.postRender();
  }

  addProgressListener(callback: (data: ProgressData) => void) {
    this.listeners.add(callback);
  }

  removeProgressListener(callback: (data: ProgressData) => void) {
    this.listeners.delete(callback);
  }

  cleanup() {
    this.listeners.clear();
    this.progressUnlistener!();
  }

  async render(): Promise<void> {
    this._currentAttempt++;

    try {
      const id = await invoke<number>("start_render", this.settings);
      this.currentRenderId = id;
    } catch (err) {
      alert(err);
      this.cleanup();
    }
  }

  private adjustSettings(resultantSize: number) {
    const percentDiff = 1 - resultantSize / (this.sizeLimit!.maxSize * 1e6);

    if (percentDiff >= 0 && percentDiff < this.sizeLimit!.retryThreshold) return false;

    this.settings.targetBitrate += this.settings.targetBitrate * percentDiff;
    this.settings.maxBitrate += this.settings.maxBitrate * percentDiff;

    this.settings.codecRateControl = Renderer.generateRateControlCmd(this.settings);

    return true;
  }

  async postRender() {
    if (this.sizeLimit != null) {
      const file = await stat(this.settings.outputFilepath);
      const adjusted = this.adjustSettings(file.size);

      if (adjusted && this._currentAttempt < this.sizeLimit.maxAttempts) {
        // FFMPEG retains a file lock for some time after finishing, keep attempting until successful
        await new Promise<void>((resolve, reject) => {
          let attempts = 0;

          const attemptRemove = setInterval(async () => {
            if (attempts > 10) reject();

            try {
              await remove(this.settings.outputFilepath);

              clearInterval(attemptRemove);
              resolve();
            } catch {}

            attempts++;
          }, 1000);
        });

        this.render();

        return;
      }
    }

    this.cleanup();
  }

  async cancelRender() {
    const cancelled = await invoke<boolean>("cancel_render", { taskId: this.currentRenderId });
  }
}
