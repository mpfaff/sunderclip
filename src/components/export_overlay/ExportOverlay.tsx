import { createStore } from "solid-js/store";
import { Show, createEffect } from "solid-js";
import dayjs from "dayjs";

import { useAppContext } from "../../contexts/AppContext";

import styles from "./ExportOverlay.module.css";
import Overlay from "../overlay/Overlay";
import LoadingBar from "../progress_bar/ProgressBar.tsx";
import { ProgressData } from "../../../types";
import { round } from "../../util.ts";
import { invoke } from "@tauri-apps/api/core";

export default function ExportOverlay() {
  const [{ renderData }, { setRenderData }] = useAppContext();
  const [progress, setProgress] = createStore<{ percentage: number; eta: Date | null; speed: number; done: boolean; errored: boolean }>({
    percentage: 0,
    eta: null,
    speed: 1,
    done: false,
    errored: false,
  });

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });

  function updateProgress(data: ProgressData) {
    setProgress("percentage", round(data.percentage * 100));
    setProgress("eta", data.eta);
    setProgress("done", data.done);
    setProgress("errored", data.errored);
  }

  createEffect(() => {
    if (renderData.renderer != null) {
      renderData.renderer.addProgressListener(updateProgress);
    }
  });

  function timeToEta() {
    return dayjs().to(progress.eta);
  }

  function close() {
    setRenderData("renderer", null);
    setRenderData("rendering", false);
  }

  return (
    <Show when={renderData.rendering}>
      <Overlay>
        <div class={styles.export}>
          <h2 class={styles.export__heading}>Exporting</h2>
          <p class={styles.export__attempt_text}>
            Attempt {renderData.renderer?.currentAttempt ?? ""}/{renderData.renderer?.maxAttempts || ""}
          </p>

          <LoadingBar name="Export progress" fillColor="hsl(var(--clr-primary-400))" max={100} min={0} value={() => progress.percentage} />

          <div class={styles.export__info}>
            <p>ETA: {progress.eta == null ? "..." : `${timeToEta()} (${dateFormatter.format(progress.eta)})`}</p>
          </div>

          <div class={styles.export__btns}>
            <Show
              when={!progress.errored && !progress.done}
              fallback={
                <button class={styles.export_btn} onClick={close}>
                  Finish
                </button>
              }
            >
              <button
                class={styles.export_btn}
                onClick={async () => {
                  await invoke<void>("show_in_folder", { path: renderData.renderer!.outputFilepath });
                }}
              >
                Open Folder
              </button>
              <button class={styles.export_btn}>Accept Current</button>
              <button
                class={styles.export_btn}
                onClick={() => {
                  renderData.renderer?.cancelRender();
                  close();
                }}
              >
                Cancel
              </button>
            </Show>
          </div>
        </div>
      </Overlay>
    </Show>
  );
}
