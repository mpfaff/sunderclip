import { Event, TauriEvent, UnlistenFn, listen } from "@tauri-apps/api/event";

import Overlay from "../overlay/Overlay";
import styles from "./Welcome.module.css";
import { Show, createSignal, onCleanup, onMount } from "solid-js";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppContext } from "../../contexts/AppContext";

type FileDropPayload = { paths: string[]; position: { x: number; y: number } };

const VIDEO_FILE_EXT_ARRAY = ["mp4", "webm", "ogg"];
const VIDEO_FILE_EXTENSIONS = new Set(VIDEO_FILE_EXT_ARRAY);

export default function Welcome() {
  const [{ videoFile }, { setVideoFile }] = useAppContext();

  const [hovering, setHovering] = createSignal(false);
  const [hoveringValid, setHoveringValid] = createSignal(false);

  let unlistenFileDropHover: UnlistenFn | undefined;
  let unlistenFileDropHoverCancel: UnlistenFn | undefined;
  let unlistenFileDrop: UnlistenFn | undefined;

  onMount(async () => {
    unlistenFileDropHover = await listen(TauriEvent.DRAG, async (event: Event<FileDropPayload>) => {
      const file = event.payload.paths[0];
      if (file == null) return;

      setHovering(true);

      if (event.payload.paths.length > 1 || !VIDEO_FILE_EXTENSIONS.has(file.split(".").pop()?.toLowerCase() || "")) return setHoveringValid(false);
      setHoveringValid(true);
    });

    unlistenFileDropHoverCancel = await listen(TauriEvent.DROP_CANCELLED, () => setHovering(false));

    unlistenFileDrop = await listen(TauriEvent.DROP, async (event: Event<FileDropPayload>) => {
      setHovering(false);

      const file = event.payload.paths[0];
      if (file == null) return;

      if (event.payload.paths.length > 1 || !VIDEO_FILE_EXTENSIONS.has(file.split(".").pop()?.toLowerCase() || "")) return setHoveringValid(false);
      setHoveringValid(true);

      setVideoFile(file);
    });
  });

  onCleanup(() => {
    if (unlistenFileDropHover) unlistenFileDropHover();
    if (unlistenFileDropHoverCancel) unlistenFileDropHoverCancel();
    if (unlistenFileDrop) unlistenFileDrop();
  });

  return (
    <Show when={videoFile() == null}>
      <Overlay
        strength={hovering() && hoveringValid() ? 0.35 : 0.6}
        class={`${styles.overlay_drop} ${hovering() ? (hoveringValid() ? styles.overlay_dropValid : styles.overlay_dropInvalid) : ""}`}
      >
        <Show
          when={!hovering()}
          fallback={
            <p class={styles.overlay__drop_msg}>
              {hoveringValid() ? "- Drop file -" : `Invalid drop payload. Only one video file of type (.${VIDEO_FILE_EXT_ARRAY.join(", .")}) is allowed.`}
            </p>
          }
        >
          <div class={styles.welcome}>
            <h1 class={styles.welcome__heading}>Welcome to Sunderclip</h1>

            <p class={styles.welcome__text}>To start, drag and drop a video file anywhere on this window</p>
            <p class={styles.welcome__split}>or</p>
            <button
              class={styles.welcome__btn}
              onClick={async () => {
                const file = await open({
                  multiple: false,
                  directory: false,
                  filters: [{ name: "Web video files", extensions: VIDEO_FILE_EXT_ARRAY }],
                });
                if (file == null) return;

                setVideoFile(file.path);
              }}
            >
              Select a file
            </button>
          </div>
        </Show>
      </Overlay>
    </Show>
  );
}
