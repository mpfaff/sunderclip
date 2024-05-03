import { invoke } from "@tauri-apps/api/core";
import { RawProgress, RenderMeta, RenderSettings, RenderSizeLimit } from "../../types";
import { remove, stat } from "@tauri-apps/plugin-fs";
import { Event, UnlistenFn, listen } from "@tauri-apps/api/event";
import { VideoCodecs } from "../components/export_panel/Codecs";
import { Accessor, Setter, createSignal } from "solid-js";
import { SetStoreFunction, createStore } from "solid-js/store";
import { minmax, round } from "../util";

export enum RenderState {
  LOADING,
  RENDERING,
  VALIDATING,
  ERRORED,
  FINISHED,
}

type ProgressStore = {
  errorMsg: string | null;
  percentage: number;
  currentTimeMs: number;
  fps: number;
  eta: null | Date;
  speed: number;
  state: RenderState;
  doneCurrent: boolean;
};

type Attempt = {
  bitrate: number;
  size: number;
};

type Attempts = Attempt[];

export default class Renderer {
  private settings: RenderSettings & { codecRateControl: string[] };
  private sizeLimit: RenderSizeLimit | null;
  private meta: RenderMeta;

  readonly progress: ProgressStore;
  private setProgress: SetStoreFunction<ProgressStore>;

  readonly currentAttempt: Accessor<number>;
  private setCurrentAttempt: Setter<number>;

  readonly useCurrentAttempt: Accessor<boolean>;
  readonly setUseCurrentAttempt: Setter<boolean>;

  readonly lastAttempts: Attempts;
  private setLastAttempts: SetStoreFunction<Attempts>;

  private bestAttempt = {
    size: 0,
    minBitrate: 0.1,
    targetBitrate: 0.1,
    maxBitrate: Infinity,
  };
  private lastPercentDiff = 0.1;
  private memory = {
    maxSetBitrate: Infinity,
    minSetBitrate: 0.1,
  };

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
      errorMsg: null,
      percentage: 0,
      currentTimeMs: 0,
      fps: 0,
      eta: null,
      speed: 1,
      doneCurrent: false,
      state: RenderState.LOADING,
    });
    [this.useCurrentAttempt, this.setUseCurrentAttempt] = createSignal(false);
    [this.lastAttempts, this.setLastAttempts] = createStore<Attempts>([]);

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
      newProgress.state = RenderState.ERRORED;
      newProgress.errorMsg = lines.slice(Renderer.errorPrefix.length);
    }

    if (newProgress.state !== RenderState.ERRORED) {
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
            if (newProgress.state === RenderState.LOADING) newProgress.state = RenderState.RENDERING;
            if (newProgress.doneCurrent) newProgress.percentage = 1;
          }
        }
      });
    }

    this.setProgress(newProgress);

    for (const listener of this.listeners.values()) {
      listener(newProgress);
    }

    if (newProgress.state === RenderState.ERRORED) {
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
    this.setProgress("state", RenderState.LOADING);
    this.setProgress("percentage", 0);
    this.setCurrentAttempt((prev) => ++prev);

    try {
      const id = await invoke<number>("start_render", this.settings);
      this.currentRenderId = id;
    } catch (err) {
      alert(err);
      this.cleanup();
    }
  }

  private adjustSettings(resultantSize: number, finalAttempt: boolean) {
    console.log(resultantSize / 1e6);

    const maxSizeBytes = this.sizeLimit!.maxSize * 1e6;
    // > 0 : over size limit
    // < 0 : under size limit
    const percentDiff = resultantSize / maxSizeBytes - 1;

    if (percentDiff <= 0 && -percentDiff < this.sizeLimit!.retryThreshold) return false;

    if (resultantSize > maxSizeBytes) {
      this.memory.maxSetBitrate = Math.min(this.memory.maxSetBitrate, this.settings.maxBitrate);
    }
    if (resultantSize < maxSizeBytes) this.memory.minSetBitrate = this.settings.targetBitrate;

    const multiplier = Math.sqrt(69 * Math.abs(Math.abs(this.lastPercentDiff) - Math.abs(percentDiff))) + 1;

    if (!finalAttempt) {
      if (this.memory.maxSetBitrate !== Infinity && this.memory.minSetBitrate !== 0) {
        this.settings.targetBitrate = minmax(
          this.memory.minSetBitrate,
          this.settings.targetBitrate - (this.memory.maxSetBitrate - this.memory.minSetBitrate) * percentDiff * multiplier,
          this.memory.maxSetBitrate
        );
        this.settings.maxBitrate = minmax(
          this.memory.minSetBitrate,
          this.settings.maxBitrate - (this.memory.maxSetBitrate - this.memory.minSetBitrate) * percentDiff * multiplier,
          this.memory.maxSetBitrate
        );
      } else {
        this.settings.targetBitrate = minmax(
          this.memory.minSetBitrate,
          this.settings.targetBitrate - this.settings.targetBitrate * percentDiff * multiplier,
          this.memory.maxSetBitrate
        );
        this.settings.maxBitrate = minmax(
          this.memory.minSetBitrate,
          this.settings.maxBitrate - this.settings.maxBitrate * percentDiff * multiplier,
          this.memory.maxSetBitrate
        );
      }
      this.lastPercentDiff = percentDiff;
    } else {
      this.settings.maxBitrate = this.bestAttempt.maxBitrate;
      this.settings.targetBitrate = this.bestAttempt.targetBitrate;
      this.settings.minBitrate = this.bestAttempt.minBitrate;
    }

    this.settings.codecRateControl = Renderer.generateRateControlCmd(this.settings);

    console.log(
      `Multiplier: ${multiplier}, Target: ${this.settings.targetBitrate}, Min mem: ${this.memory.minSetBitrate}, Max mem: ${this.memory.maxSetBitrate} Percent diff: ${percentDiff}`
    );

    return true;
  }

  async postRender() {
    const file = await stat(this.settings.outputFilepath);

    this.setLastAttempts(this.lastAttempts.length, {
      bitrate: this.settings.targetBitrate,
      size: round(file.size / 1e6),
    });

    if (this.sizeLimit != null && !this.useCurrentAttempt()) {
      this.setProgress("state", RenderState.VALIDATING);

      if (file.size <= this.sizeLimit.maxSize && file.size > this.bestAttempt.size) {
        this.bestAttempt.size = file.size;
        this.bestAttempt.targetBitrate = this.settings.targetBitrate;
        this.bestAttempt.maxBitrate = this.settings.maxBitrate;
        this.bestAttempt.minBitrate = this.settings.minBitrate;
      }

      const adjusted = this.adjustSettings(file.size, this.currentAttempt() == this.maxAttempts);

      if (adjusted && this.currentAttempt() < this.sizeLimit.maxAttempts) {
        await remove(this.settings.outputFilepath);

        this.render();

        return;
      }
    }

    this.cleanup();
  }

  async cancelRender() {
    return await invoke<boolean>("cancel_render", { taskId: this.currentRenderId });
  }

  cleanup() {
    if (this.progress.state !== RenderState.ERRORED) this.setProgress("state", RenderState.FINISHED);
    this.listeners.clear();
    this.progressUnlistener!();
  }
}
