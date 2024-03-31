import { Show, createSignal } from "solid-js";
import { useAppContext } from "../../contexts/AppContext";
import Overlay from "../overlay/Overlay";

import styles from "./ExportOverlay.module.css";
import LoadingBar from "../progress_bar/ProgressBar.tsx";

export default function ExportOverlay() {
  const [{ rendering }] = useAppContext();
  const [progress, setProgress] = createSignal(80);

  return (
    <Show when={rendering()}>
      <Overlay>
        <div class={styles.export}>
          <h2 class={styles.export__heading}>Exporting</h2>

          <LoadingBar name="Export progress" fillColor="hsl(var(--clr-primary-400))" max={100} min={0} value={progress} />

          <div class={styles.export__btns}>
            <div class={styles.export__btns_row}>
              <button class={styles.export_btn}>Accept Current</button>
            </div>
            <div class={styles.export__btns_row}>
              <button class={styles.export_btn}>Cancel</button>
            </div>
          </div>
        </div>
      </Overlay>
    </Show>
  );
}
