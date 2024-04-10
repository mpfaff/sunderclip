import { invoke } from "@tauri-apps/api/core";
import { ProgressData, RenderInfo, RenderSettings, RenderSizeLimit } from "../../types";
import { stat } from "@tauri-apps/plugin-fs";
import { Event, UnlistenFn, listen } from "@tauri-apps/api/event";
import { VideoCodecs } from "../components/export_panel/Codecs";

export default class Renderer {
  private settings: RenderSettings & { codecRateControl: string[] };
  private sizeLimit: RenderSizeLimit;
  private progressUnlistener: UnlistenFn | undefined;
  private listeners: Set<Function> = new Set();

  constructor(settings: RenderSettings, sizeLimit: RenderSizeLimit) {
    const rateControlCommand: string[] = [];
    const replacementMap = new Map([
      ["TARGET_BITRATE", "targetBitrate"],
      ["MIN_BITRATE", "minBitrate"],
      ["MAX_BITRATE", "maxBitrate"],
      ["CRF_VALUE", "crfValue"],
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

    console.log(this.settings, this.sizeLimit);
  }

  async init() {
    this.progressUnlistener = await listen<string>("export_progress", (data) => this.handleProgress(data));
  }

  handleProgress(data: Event<string>) {
    for (const listener of this.listeners.values()) {
      // TODO: parse
      listener(data);
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

      return await this.render();
    } catch (err) {
      alert(err);
    }
    // }
  }
}
