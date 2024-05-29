import { invoke } from "@tauri-apps/api/core";
import { RawProgress, RenderMeta, RenderSettings, RenderSizeLimit } from "../../types";
import { remove, stat } from "@tauri-apps/plugin-fs";
import { Event, UnlistenFn, listen } from "@tauri-apps/api/event";
import { VideoCodecs } from "../components/export_panel/Codecs";
import { Accessor, Setter, createSignal } from "solid-js";
import { SetStoreFunction, createStore } from "solid-js/store";
import { minmax, round } from "../util";

// Render states
export enum RenderState {
  LOADING, // Preparing to render, FFMPEG setting itself up
  RENDERING, // FFMPEG render in progress
  VALIDATING, // Fetching file size and performing calculations
  ERRORED, // Error in rendering occurred from FFMPEG
  FINISHED, // Entire export is complete
}

// Object that stores progress information
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

// Logged attempt object
type Attempt = {
  bitrate: number | null; // In Kb/s
  size: number; // In MB
};
type Attempts = Attempt[];

export default class Renderer {
  private settings: RenderSettings & { codecRateControl: string[] };
  private sizeLimit: RenderSizeLimit | null;
  private meta: RenderMeta;

  // Define reactive states that can be accessed outside this class
  readonly progress: ProgressStore;
  private setProgress: SetStoreFunction<ProgressStore>;

  readonly currentAttempt: Accessor<number>;
  private setCurrentAttempt: Setter<number>;

  readonly useCurrentAttempt: Accessor<boolean>;
  readonly setUseCurrentAttempt: Setter<boolean>;

  readonly lastAttempts: Attempts;
  private setLastAttempts: SetStoreFunction<Attempts>;

  // Define defaults for internal memory objects that persist throughout the entire renderer lifespan
  private bestAttempt: {
    size: number; // Bytes
    minBitrate: number | null;
    targetBitrate: number | null;
    maxBitrate: number;
  } = {
    size: 0,
    minBitrate: null,
    targetBitrate: null,
    maxBitrate: Infinity,
  };
  private memory: {
    lastPercentDiff: number;
    maxSetBitrate: number;
    minSetBitrate: number | null;
  } = {
    lastPercentDiff: 0.1,
    maxSetBitrate: Infinity,
    minSetBitrate: null,
  };

  // Current render ID by Tauri backend
  private currentRenderId: number | undefined;

  // Function used on cleanup to un-listen to Tauri events for render progress
  private progressUnlistener: UnlistenFn | undefined;

  private static readonly ERROR_PREFIX = "error:";

  private static generateRateControlCmd(settings: RenderSettings) {
    const rateControlCommand: string[] = [];

    // Map templating strings to their property names
    const replacementMap = new Map([
      ["TARGET_BITRATE", "targetBitrate"],
      ["MIN_BITRATE", "minBitrate"],
      ["MAX_BITRATE", "maxBitrate"],
      ["CRF_VALUE", "crfValue"],
      ["BUF_SIZE", "bufSize"],
    ]);

    // Replace string templates with respective value
    for (const arg of VideoCodecs[settings.vCodecName].rateControl[settings.rateControl]!) {
      const openingBracketIndex = arg.indexOf("{");

      if (openingBracketIndex != -1) {
        // Current argument has template to fill, insert value
        const template = arg.slice(openingBracketIndex + 1, arg.indexOf("}"));

        if (replacementMap.has(template))
          rateControlCommand.push(arg.replace(`{${template}}`, settings[replacementMap.get(template)! as keyof RenderSettings].toString()));
      } else {
        // Current argument has no template to fill, push argument as-is
        rateControlCommand.push(arg);
      }
    }

    return rateControlCommand;
  }

  constructor(settings: RenderSettings, sizeLimit: RenderSizeLimit | null, meta: RenderMeta) {
    // Initialize default states
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

    // If a size limit is enabled, adjust settings to include this
    if (sizeLimit != null) {
      const duration = settings.trimEnd - settings.trimStart;
      // TODO: subtract audio bitrate from calculations
      // Convert max size (MB) to megabits (Mb), then divide by duration (s) to get Mb/s, then multiply by 1000 to get Kb/s
      const theoreticalConstantBitrateKbps = ((sizeLimit.maxSize * 8) / duration) * 1000;

      settings.targetBitrate = theoreticalConstantBitrateKbps;
      settings.maxBitrate = theoreticalConstantBitrateKbps;
      settings.minBitrate = 0;
    }

    // Set settings with FFMPEG arguments for rate control
    this.settings = { ...settings, codecRateControl: Renderer.generateRateControlCmd(settings) };
    this.sizeLimit = sizeLimit;
    this.meta = meta;
  }

  get maxAttempts() {
    // Return the max attempts this renderer has.
    // This is null if there is no size limit, so return 1
    return this.sizeLimit?.maxAttempts ?? 1;
  }
  get outputFilepath() {
    return this.settings.outputFilepath;
  }

  // Mandatory-called async initialization function to listen for progress events from Tauri and FFMPEG
  async init() {
    this.progressUnlistener = await listen<string>("export_progress", (data) => this.handleProgress(data));
  }

  handleProgress(data: Event<string>) {
    const lines = data.payload;

    const newProgress: ProgressStore = Object.assign({}, this.progress); // Clone current progress object

    // Check if lines start with the error prefix meaning there is an error
    if (lines.startsWith(Renderer.ERROR_PREFIX)) {
      newProgress.state = RenderState.ERRORED;
      newProgress.errorMsg = lines.slice(Renderer.ERROR_PREFIX.length);
    } else {
      // If there is no error, parse and set progress value normally
      lines.split("\n").forEach((property) => {
        const [name, value] = property.split("=") as [keyof RawProgress, string];
        const validValue = value !== "N/A";

        if (!validValue) return;

        switch (name) {
          case "out_time_us": {
            // FFMPEG gives both ms and us, however the ms reading is identical to us due to a bug in FFMPEG,
            // so use the us time and convert to ms instead
            newProgress.currentTimeMs = Number(value) / 1000; // Convert value (us) to milliseconds
            newProgress.percentage = newProgress.currentTimeMs / 1000 / this.meta.totalDuration; // Convert milliseconds to seconds, then to percentage
            break;
          }
          case "speed": {
            // Speed is given by FFMPEG as a multiplier, for example: "1.76x"
            newProgress.speed = parseFloat(value);
            // Convert duration to milliseconds, subtracted by the position (in ms) the render is currently at, divided by the current speed multiplier
            // to get the remaining duration, and convert to a date
            newProgress.eta = new Date(Date.now() + (this.meta.totalDuration * 1000 - newProgress.currentTimeMs) / newProgress.speed);
            break;
          }
          case "fps": {
            newProgress.fps = parseFloat(value);
            break;
          }
          case "progress": {
            // Update render states, set progress to 100% (1) if done as FFMPEG does not emit an event for this
            newProgress.doneCurrent = value === "end" ? true : false;
            if (newProgress.state === RenderState.LOADING) newProgress.state = RenderState.RENDERING;
            if (newProgress.doneCurrent) newProgress.percentage = 1;
          }
        }
      });
    }

    this.setProgress(newProgress);

    // End render if errored
    if (newProgress.state === RenderState.ERRORED) {
      this.cleanup();
      return;
    }

    // If current render is done, start post-render tasks
    if (newProgress.doneCurrent) this.postRender();
  }

  async render(): Promise<void> {
    this.setProgress("state", RenderState.LOADING);
    this.setProgress("percentage", 0);
    this.setCurrentAttempt((prev) => ++prev);

    try {
      // Send render request to Tauri, which will return a render ID
      const id = await invoke<number>("start_render", this.settings);
      this.currentRenderId = id;
    } catch (err) {
      // Stop the render if there is an error
      alert(err);
      this.cleanup();
    }
  }

  // This function adjusts the current settings to attempt to reach the target size limit,
  // returning whether or not adjusting was needed
  private adjustSettings(resultantSize: number, finalAttempt: boolean): boolean {
    const targetSizeBytes = this.sizeLimit!.maxSize * 1e6; // Convert MB to bytes
    // > 0 : over size limit
    // < 0 : under size limit
    // This is achieved through the subtraction of 1
    const percentDiff = resultantSize / targetSizeBytes - 1;

    // If percent difference is less than or equal to zero and the inverted percent difference (inversion is needed due to prior subtraction by 1)
    // is less than the retry threshold percentage, stop adjusting
    if (percentDiff <= 0 && -percentDiff < this.sizeLimit!.retryThreshold) return false;

    // Constrain max allowed bitrate if the resultant size is bigger than the target size
    if (resultantSize > targetSizeBytes) {
      this.memory.maxSetBitrate = Math.min(this.memory.maxSetBitrate, this.settings.maxBitrate);
    }
    // Constrain min allowed bitrate if the resultant size is smaller than the target size
    if (resultantSize < targetSizeBytes) this.memory.minSetBitrate = this.settings.targetBitrate;

    // Use square root curve to produce multiplier
    const multiplier = Math.sqrt(42 * Math.abs(Math.abs(this.memory.lastPercentDiff) - Math.abs(percentDiff))) + 1;

    // Attempt to adjust settings if it is not the final attempt
    if (!finalAttempt) {
      // If max and min bitrate bounds are set and not default values
      if (this.memory.maxSetBitrate !== Infinity && this.memory.minSetBitrate !== null) {
        this.settings.targetBitrate = minmax(
          this.memory.minSetBitrate,
          this.settings.targetBitrate - (this.memory.maxSetBitrate - this.memory.minSetBitrate) * percentDiff,
          this.memory.maxSetBitrate
        );
        this.settings.maxBitrate = minmax(
          this.memory.minSetBitrate,
          this.settings.maxBitrate - (this.memory.maxSetBitrate - this.memory.minSetBitrate) * percentDiff,
          this.memory.maxSetBitrate
        );
      } else {
        this.settings.targetBitrate = minmax(
          this.memory.minSetBitrate || 0.01,
          this.settings.targetBitrate - this.settings.targetBitrate * percentDiff * multiplier,
          this.memory.maxSetBitrate
        );
        this.settings.maxBitrate = minmax(
          this.memory.minSetBitrate || 0.01,
          this.settings.maxBitrate - this.settings.maxBitrate * percentDiff * multiplier,
          this.memory.maxSetBitrate
        );
      }
      this.memory.lastPercentDiff = percentDiff;
    } else {
      // Give up on adjusting as it is the final attempt and we have ran out of attempts,
      // use the best found settings so far instead
      this.settings.maxBitrate = this.bestAttempt.maxBitrate == Infinity ? this.bestAttempt.targetBitrate! : this.bestAttempt.maxBitrate;
      this.settings.targetBitrate = this.bestAttempt.targetBitrate!;
      this.settings.minBitrate = this.bestAttempt.minBitrate || 0.01;
    }

    // Regenerate the command to be passed to FFMPEG with the current adjusted settings
    this.settings.codecRateControl = Renderer.generateRateControlCmd(this.settings);

    return true;
  }

  async postRender() {
    // Retrieve stats for file
    const file = await stat(this.settings.outputFilepath);

    // Append another attempt to the previous attempts
    this.setLastAttempts(this.lastAttempts.length, {
      bitrate: this.settings.targetBitrate,
      size: round(file.size / 1e6), // Convert bytes to MB
    });

    // If there is a size limit specified and the user did not select they want to use the current attempt
    if (this.sizeLimit != null && !this.useCurrentAttempt()) {
      this.setProgress("state", RenderState.VALIDATING);

      const maxSizeBytes = this.sizeLimit.maxSize * 1e6; // Convert MB to bytes

      // Set best attempt to current settings if:
      // there is no best attempt yet
      // the resultant file is less than the target size and if the current target bitrate is larger than the last best attempt bitrate or if last best attempt was larger than the target size
      // the resultant file is larger than the target size and is less than the last best attempt's size
      if (
        this.bestAttempt.targetBitrate == null ||
        (file.size <= maxSizeBytes && (this.settings.targetBitrate > this.bestAttempt.targetBitrate || this.bestAttempt.size > maxSizeBytes)) ||
        (file.size >= maxSizeBytes && file.size < this.bestAttempt.size)
      ) {
        this.bestAttempt.size = file.size;
        this.bestAttempt.targetBitrate = this.settings.targetBitrate;
        this.bestAttempt.maxBitrate = this.settings.maxBitrate;
        this.bestAttempt.minBitrate = this.settings.minBitrate;
      }

      // Call to adjust settings, passing in if the nxt attempt will be the last (final)
      const adjusted = this.adjustSettings(file.size, this.currentAttempt() == this.maxAttempts - 1);

      // If adjustments were made and the current attempt is less than the max allowed attempts,
      // remove the old file and rerender
      if (adjusted && this.currentAttempt() < this.sizeLimit.maxAttempts) {
        await remove(this.settings.outputFilepath);

        this.render();

        return;
      }
    }

    // Render is complete, cleanup
    this.cleanup();
  }

  async cancelRender() {
    // Call to Tauri to cancel the current render
    return await invoke<boolean>("cancel_render", { taskId: this.currentRenderId });
  }

  cleanup() {
    // Render done, errored or not, cleanup
    if (this.progress.state !== RenderState.ERRORED) this.setProgress("state", RenderState.FINISHED);
    this.progressUnlistener!();
  }
}
