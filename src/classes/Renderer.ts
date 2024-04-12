import { invoke } from "@tauri-apps/api/core";
import { ProgressData, RawProgress, RenderMeta, RenderSettings, RenderSizeLimit } from "../../types";
import { stat } from "@tauri-apps/plugin-fs";
import { Event, UnlistenFn, listen } from "@tauri-apps/api/event";
import { VideoCodecs } from "../components/export_panel/Codecs";

export default class Renderer {
  private settings: RenderSettings & { codecRateControl: string[] };
  private sizeLimit: RenderSizeLimit;
  private meta: RenderMeta;
  private progressUnlistener: UnlistenFn | undefined;
  private listeners: Set<(data: ProgressData) => void> = new Set();

  constructor(settings: RenderSettings, sizeLimit: RenderSizeLimit, meta: RenderMeta) {
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

    this.settings = { ...settings, codecRateControl: rateControlCommand };
    this.sizeLimit = sizeLimit;
    this.meta = meta;

    console.log(this.settings, this.sizeLimit);
  }

  async init() {
    this.progressUnlistener = await listen<string>("export_progress", (data) => this.handleProgress(data));
  }

  handleProgress(data: Event<string>) {
    const lines = data.payload;
    const properties = lines.split("\n");
    const progress: ProgressData = {
      percentage: 0,
      currentTimeMs: 0,
      fps: 0,
      eta: null,
      speed: 1,
      done: false,
    };

    properties.forEach((property) => {
      const [name, value] = property.split("=") as [keyof RawProgress, string];
      const validValue = value !== "N/A";

      if (!validValue) return; // TODO: Maintain only valid values

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
        }
      }
    });

    for (const listener of this.listeners.values()) {
      listener(progress);
    }
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
    // for (let i = 0; i < this.sizeLimit.maxAttempts; i++) {
    try {
      await invoke("render", this.settings);

      const file = await stat(this.settings.outputFilepath);
      const percentDiff = file.size / (this.sizeLimit.maxSize * 1e6);

      // if (Math.abs(1 - percentDiff) < this.sizeLimit.retryThreshold) break;

      // return await this.render();
    } catch (err) {
      alert(err);
    }
    // }
  }
}
