import { invoke } from "@tauri-apps/api/core";
import { RawProgress, RenderMeta, RenderSettings, RenderSizeLimit } from "../../types";
import { remove, stat } from "@tauri-apps/plugin-fs";
import { Event, UnlistenFn, listen } from "@tauri-apps/api/event";
import { VideoCodecs } from "../components/export_panel/Codecs";
import { Accessor, Setter, createSignal } from "solid-js";
import { SetStoreFunction, createStore } from "solid-js/store";

type ProgressStore = {
  errored: boolean;
  errorMsg: string | null;
  percentage: number;
  currentTimeMs: number;
  fps: number;
  eta: null | Date;
  speed: number;
  doneCurrent: boolean;
  finished: boolean;
};

export default class Renderer {
  private settings: RenderSettings & { codecRateControl: string[] };
  private sizeLimit: RenderSizeLimit | null;
  private meta: RenderMeta;

  readonly progress: ProgressStore;
  private setProgress: SetStoreFunction<ProgressStore>;

  readonly currentAttempt: Accessor<number>;
  private setCurrentAttempt: Setter<number>;

  private currentRenderId: number | undefined;

  private progressUnlistener: UnlistenFn | undefined;
  private listeners: Set<(data: ProgressStore) => void> = new Set();

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
    [this.currentAttempt, this.setCurrentAttempt] = createSignal(0);
    [this.progress, this.setProgress] = createStore<ProgressStore>({
      errored: false,
      errorMsg: null,
      percentage: 0,
      currentTimeMs: 0,
      fps: 0,
      eta: null,
      speed: 1,
      doneCurrent: false,
      finished: false,
    });

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

    const newProgress: ProgressStore = Object.assign({}, this.progress);

    if (lines.startsWith(Renderer.errorPrefix)) {
      newProgress.errored = true;
      newProgress.errorMsg = lines.slice(Renderer.errorPrefix.length);
    }

    if (!newProgress.errored) {
      lines.split("\n").forEach((property) => {
        const [name, value] = property.split("=") as [keyof RawProgress, string];
        const validValue = value !== "N/A";

        if (!validValue) return;

        switch (name) {
          case "out_time_us": {
            newProgress.currentTimeMs = Number(value) / 1000;
            newProgress.percentage = newProgress.currentTimeMs / 1000 / this.meta.totalDuration;
            break;
          }
          case "speed": {
            newProgress.speed = parseFloat(value);
            newProgress.eta = new Date(Date.now() + (this.meta.totalDuration * 1000 - newProgress.currentTimeMs) / newProgress.speed);
            break;
          }
          case "fps": {
            newProgress.fps = parseFloat(value);
            break;
          }
          case "progress": {
            newProgress.doneCurrent = value === "end" ? true : false;
            if (newProgress.doneCurrent) newProgress.percentage = 1;
          }
        }
      });
    }

    this.setProgress(newProgress);

    for (const listener of this.listeners.values()) {
      listener(newProgress);
    }

    if (newProgress.errored) {
      this.cleanup();
      return;
    }

    if (newProgress.doneCurrent) this.postRender();
  }

  addProgressListener(callback: (data: ProgressStore) => void) {
    this.listeners.add(callback);
  }

  removeProgressListener(callback: (data: ProgressStore) => void) {
    this.listeners.delete(callback);
  }

  async render(): Promise<void> {
    this.setCurrentAttempt((prev) => ++prev);

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

      if (adjusted && this.currentAttempt() < this.sizeLimit.maxAttempts) {
        await remove(this.settings.outputFilepath);

        this.render();

        return;
      }
    }

    this.cleanup();
  }

  async cancelRender() {
    const cancelled = await invoke<boolean>("cancel_render", { taskId: this.currentRenderId });
  }

  cleanup() {
    this.setProgress("finished", true);
    this.listeners.clear();
    this.progressUnlistener!();
  }
}
