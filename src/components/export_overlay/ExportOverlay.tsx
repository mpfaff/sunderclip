import { Show } from "solid-js";
import dayjs from "dayjs";

import { useAppContext } from "../../contexts/AppContext";

import styles from "./ExportOverlay.module.css";
import Overlay from "../overlay/Overlay";
import LoadingBar from "../progress_bar/ProgressBar";
import { round } from "../../util.ts";
import { invoke } from "@tauri-apps/api/core";

export default function ExportOverlay() {
  const [{ renderData }, { setRenderData }] = useAppContext();

  const renderer = () => renderData.renderer;

  function timeToEta() {
    return dayjs().to(renderer()?.progress.eta);
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
            Attempt {renderer()?.currentAttempt() ?? ""}/{renderer()?.maxAttempts || ""}
          </p>

          <LoadingBar
            name="Export progress"
            fillColor="hsl(var(--clr-primary-400))"
            max={100}
            min={0}
            value={() => round((renderer()?.progress.percentage || 0) * 100)}
            done={() => renderer()?.progress.errored == true || renderer()?.progress.done == true}
          />

          <div class={styles.export__info}>
            <p>ETA: {renderer()?.progress.eta == null ? "..." : timeToEta()}</p>
            <Show when={renderer()?.progress.errored}>
              <p>Error: {}</p>
            </Show>
          </div>

          <div class={styles.export__btns}>
            <Show
              when={!renderer()?.progress.errored && !renderer()?.progress.done}
              fallback={
                <button class={styles.export_btn} onClick={close}>
                  {renderer()?.progress.errored ? "Close" : "Finish"}
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
                  renderer()?.cancelRender();
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
