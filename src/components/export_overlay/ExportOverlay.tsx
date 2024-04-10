import { createStore } from "solid-js/store";
import { Show, createEffect, createSignal } from "solid-js";
import dayjs from "dayjs";

import { useAppContext } from "../../contexts/AppContext";

import styles from "./ExportOverlay.module.css";
import Overlay from "../overlay/Overlay";
import LoadingBar from "../progress_bar/ProgressBar.tsx";
import { ProgressData } from "../../../types";
import { round } from "../../util.ts";

export default function ExportOverlay() {
  const [{ renderData }] = useAppContext();
  const [progress, setProgress] = createStore<{ percentage: number; eta: Date | null; speed: number }>({ percentage: 0, eta: null, speed: 1 });

  function updateProgress(data: ProgressData) {
    setProgress("percentage", data.done ? 100 : round(data.percentage * 100));
    console.log(data.eta);
    setProgress("eta", data.eta);
  }

  createEffect(() => {
    if (renderData.renderer != null) {
      renderData.renderer.addProgressListener(updateProgress);
    }
  });

  function timeToEta() {
    return dayjs().to(progress.eta);
  }

  return (
    <Show when={renderData.rendering}>
      <Overlay>
        <div class={styles.export}>
          <h2 class={styles.export__heading}>Exporting</h2>
          <p class={styles.export__attempt_text}>Attempt 1/1</p>

          <LoadingBar name="Export progress" fillColor="hsl(var(--clr-primary-400))" max={100} min={0} value={() => progress.percentage} />

          <div class={styles.export__info}>
            <p>ETA: {progress.eta == null ? "..." : timeToEta()}</p>
          </div>

          <div class={styles.export__btns}>
            <button class={styles.export_btn}>Accept Current</button>
            <button class={styles.export_btn}>Cancel</button>
          </div>
        </div>
      </Overlay>
    </Show>
  );
}
