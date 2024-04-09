import { invoke } from "@tauri-apps/api/core";
import { RenderInfo, RenderSizeLimit } from "../../types";
import { stat } from "@tauri-apps/plugin-fs";
import { Event, UnlistenFn, listen } from "@tauri-apps/api/event";

export default class Renderer {
  private settings: RenderInfo;
  private sizeLimit: RenderSizeLimit;
  private progressUnlistener: UnlistenFn | undefined;
  private listeners: Set<Function> = new Set();

  constructor(settings: RenderInfo, sizeLimit: RenderSizeLimit) {
    this.settings = settings;
    this.sizeLimit = sizeLimit;
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

  addProgressListener(callback: Function) {
    this.listeners.add(callback);
  }

  removeProgressListener(callback: Function) {
    this.listeners.delete(callback);
  }

  cleanup() {
    this.listeners.clear();
    this.progressUnlistener!();
  }

  async render(): Promise<void> {
    for (let i = 0; i < this.sizeLimit.maxAttempts; i++) {
      try {
        await invoke("render", this.settings);

        const file = await stat(this.settings.outputFilepath);
        const percentDiff = file.size / (this.sizeLimit.maxSize * 1e6);

        if (Math.abs(1 - percentDiff) < this.sizeLimit.retryThreshold) break;

        return await this.render();
      } catch (err) {
        alert(err);
      }
    }
  }
}
