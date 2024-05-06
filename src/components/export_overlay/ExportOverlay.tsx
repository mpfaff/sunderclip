import { For, Show } from "solid-js";
import dayjs from "dayjs";

import { useAppContext } from "../../contexts/AppContext";

import styles from "./ExportOverlay.module.css";
import Overlay from "../overlay/Overlay";
import LoadingBar from "../progress_bar/ProgressBar";
import { round } from "../../util.ts";
import { invoke } from "@tauri-apps/api/core";
import { RenderState } from "../../classes/Renderer.ts";
import { confirm } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

const stateMap = new Map<RenderState, string>([
  [RenderState.LOADING, "Preparing render..."],
  [RenderState.RENDERING, "Rendering..."],
  [RenderState.VALIDATING, "Checking file size..."],
  [RenderState.ERRORED, "Render failed."],
  [RenderState.FINISHED, "Render completed."],
]);

export default function ExportOverlay() {
  const [{ renderData }, { setRenderData }] = useAppContext();

  const progress = () => renderData.renderer?.progress;
  const timeToEta = () => dayjs().to(progress()?.eta);

  function close() {
    setRenderData("renderer", null);
    setRenderData("rendering", false);
  }

  const hasMultipleAttempts = () => (renderData.renderer?.maxAttempts ?? 0) > 1;

  return (
    <Overlay>
      <div class={styles.export}>
        <h2 class={styles.export__heading}>Exporting</h2>
        <Show when={hasMultipleAttempts()}>
          <p class={styles.export__attempt_text}>
            Attempt {renderData.renderer?.currentAttempt() ?? ""}/{renderData.renderer?.maxAttempts || ""}
          </p>
        </Show>
        <p>{stateMap.get(progress()?.state || RenderState.LOADING)}</p>

        <LoadingBar
          name="Export progress"
          fillColor="hsl(var(--clr-primary-400))"
          max={100}
          min={0}
          value={() => round((progress()?.percentage || 0) * 100)}
          done={() => progress()?.state === RenderState.FINISHED}
        />

        <div class={styles.export__info}>
          <p>ETA: {progress()?.eta == null ? "..." : timeToEta()}</p>
          <Show when={progress()?.state === RenderState.ERRORED}>
            <p>
              Error: {progress()?.errorMsg?.slice(0, progress()?.errorMsg?.indexOf("\n"))}
              <button
                onClick={async () => {
                  const copyText = await confirm(progress()?.errorMsg!, {
                    title: "Error Details",
                    okLabel: "Copy",
                    cancelLabel: "Close",
                  });

                  if (copyText) await writeText(progress()?.errorMsg!);
                }}
              >
                View Full
              </button>
            </p>
          </Show>
        </div>
        <hr />

        <p>Previous attempts</p>
        <ul class={styles.export__lastAttempts}>
          <For each={renderData.renderer?.lastAttempts} fallback={<p>No attempts yet.</p>}>
            {(attempt, i) => (
              <li class={styles.export__lastAttemptItem}>
                <p>{hasMultipleAttempts() ? `Attempt #${i() + 1}` : "Resultant file:"}</p>
                <p>Bitrate: {round(attempt.bitrate)}Kb/s</p>
                <p>Size: {attempt.size}MB</p>
              </li>
            )}
          </For>
        </ul>

        <div class={styles.export__btns}>
          <button
            class={styles.export_btn}
            disabled={renderData.renderer?.outputFilepath == null}
            onClick={async (e) => {
              const button = e.currentTarget;

              button.disabled = true;
              try {
                await invoke<void>("show_in_folder", { path: renderData.renderer!.outputFilepath });
              } catch {} // TODO: inform user of failure, however this should be a rare error
              button.disabled = false;
            }}
          >
            Open Folder
          </button>
          <Show
            when={progress()?.state !== RenderState.FINISHED && progress()?.state !== RenderState.ERRORED}
            fallback={
              <button class={styles.export_btn} onClick={close}>
                {progress()?.state !== RenderState.ERRORED ? "Done" : "Close"}
              </button>
            }
          >
            <Show when={hasMultipleAttempts()}>
              <button class={styles.export_btn} onClick={() => renderData.renderer?.setUseCurrentAttempt((prev) => !prev)}>
                {!renderData.renderer?.useCurrentAttempt() ? "Accept Current" : "Auto Select"}
              </button>
            </Show>
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
  );
}
