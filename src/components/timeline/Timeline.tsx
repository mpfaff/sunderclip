import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import Panel from "../panel/Panel";

import styles from "./Timeline.module.css";
import { formatSeconds, minmax, round } from "../../util";
import { useAppContext } from "../../contexts/AppContext";
import { usePlayerContext } from "../../contexts/PlayerContext";
import { createStore } from "solid-js/store";
import { TrimRange } from "../../../types";
import Menubar from "../../classes/Menubar";

const capturingElements = new Set(["INPUT", "SELECT", "BUTTON"]);
const partialCapturingEvents = new Set(["Space"]);

export default function Timeline() {
  const [{ videoElement, mediaData, trim }, { setTrim }] = useAppContext();
  const [{ currentTime, playing }, { setCurrentTime, video }] = usePlayerContext();

  const [dragging, setDragging] = createSignal(false);
  const [trimDragging, setTrimDragging] = createStore<{ start: boolean; end: boolean; any: boolean }>({ start: false, end: false, any: false });
  const [cursorPos, setCursorPos] = createSignal(0);
  const [trimPos, setTrimPos] = createStore<TrimRange>({ start: 0, end: 1 });
  const [trimStartTime, setTrimStartTime] = createSignal<number | null>(null);
  const [timecodeType, setTimecodeType] = createSignal<"frames" | "time">("frames");

  let timelineBar: HTMLDivElement;

  function handleKeydown(event: KeyboardEvent) {
    if (dragging()) return;

    const focusedElement = document.activeElement;
    if (
      focusedElement != null &&
      focusedElement instanceof HTMLElement &&
      !(focusedElement.dataset["capturePartialFocus"] != null && partialCapturingEvents.has(event.code)) &&
      (capturingElements.has(focusedElement.tagName) || focusedElement.dataset["captureFocus"] != null)
    )
      return;

    switch (event.code) {
      case "Space": {
        video.togglePlayback();
        break;
      }
      case "ArrowLeft":
      case "ArrowRight": {
        let multiplier = event.code === "ArrowLeft" ? -1 : 1;
        if (event.ctrlKey) multiplier *= 4;
        if (event.shiftKey) multiplier *= 8;

        if (focusedElement?.id.startsWith("trimhead")) {
          const isTrimStart = focusedElement!.id === "trimhead-start";
          const trimheadName = isTrimStart ? "start" : "end";
          const trimheadTime = isTrimStart ? trim.start : trim.end;

          const duration = videoElement()!.duration;
          const time = minmax(isTrimStart ? 0 : trim.start, trimheadTime + 0.05 * multiplier, !isTrimStart ? duration : trim.end);

          setTrim(trimheadName, time);
          setTrimPos(trimheadName, time / duration);
        } else {
          updateVideoTime(currentTime() + (1 / (mediaData()?.fps ?? 10)) * multiplier);
        }

        break;
      }
      default:
        return;
    }

    event.preventDefault();
  }

  function updateVideoTime(time: number, displayTime = true) {
    const newTime = video.setTime(time);
    if (displayTime) setCurrentTime(newTime);
  }

  function handleCursorDown(event: PointerEvent) {
    setDragging(true);
    video.pause();
    handleCursorMove(event);
  }

  function handleTrimheadDown(event: PointerEvent) {
    const trimStart = (event.target as HTMLDivElement).id === "trimhead-start";
    setTrimDragging(trimStart ? "start" : "end", true);
    setTrimStartTime(videoElement()!.currentTime);
    video.pause();
    handleTrimheadMove(event);
  }

  function getSliderLocation(
    {
      mouseX,
      parentWidth,
      parentStartX,
    }: {
      mouseX: number;
      parentWidth: number;
      parentStartX: number;
    },
    min = 0,
    max = 1
  ) {
    const relativePos = mouseX - parentStartX;
    const percentage = minmax(min, relativePos / parentWidth, max);

    return { percentage };
  }

  function handleCursorMove(event: PointerEvent) {
    if (dragging()) {
      const cursorContainerRect = timelineBar.getBoundingClientRect();
      const { percentage } = getSliderLocation({
        mouseX: event.x,
        parentStartX: cursorContainerRect.x,
        parentWidth: cursorContainerRect.width,
      });

      updateVideoTime(videoElement()!.duration * percentage);
      setCursorPos(percentage);
    } else if (trimDragging.any) {
      setTrimDragging(trimDragging.start ? "start" : "end", true);
      handleTrimheadMove(event);
    }
  }

  function handleCursorUp(_: PointerEvent) {
    if (dragging()) {
      setDragging(false);
    } else if (trimDragging.any) {
      setTrimDragging(["start", "end", "any"], false);
      if (trimStartTime() != null) updateVideoTime(trimStartTime()!);
    }
  }

  createEffect(() => {
    // Sync any to if any trim head is being dragged
    setTrimDragging("any", trimDragging.start || trimDragging.end);
  });

  function handleTrimheadMove(event: PointerEvent) {
    if (!trimDragging.any) return;

    const trimStart = trimDragging.start;
    const trimheadName = trimStart ? "start" : "end";

    const timelineBarRect = timelineBar.getBoundingClientRect();

    const properties = {
      mouseX: event.x,
      parentStartX: timelineBarRect.x,
      parentWidth: timelineBarRect.width,
    };

    const { percentage } = getSliderLocation(properties, trimStart ? 0 : trimPos.start, !trimStart ? 1 : trimPos.end);

    const time = percentage * videoElement()!.duration;
    if (trimStartTime() != null) {
      video.pause();
      updateVideoTime(time, false);
    }
    setTrim(trimheadName, time);
    setTrimPos(trimheadName, percentage);
  }

  createEffect(() => {
    // Sync cursor position to video player time, do not sync if
    // the cursor or any trimhead is being dragged
    if (dragging() || trimDragging.any) return;

    const time = currentTime();
    const duration = videoElement()!.duration;

    setCursorPos(!isNaN(duration) ? time / duration : 0);
  });

  createEffect(() => {
    // Set trim end to end of video on new video load
    const duration = mediaData()?.duration;
    if (duration == null) return;

    setTrim("end", duration);
  });

  function resetTimeline() {
    setTrimPos("start", 0);
    setTrimPos("end", 1);
    setCursorPos(0);
  }

  onMount(() => {
    Menubar.addEventListener("new_proj", resetTimeline);

    window.addEventListener("pointermove", handleCursorMove);
    window.addEventListener("pointerup", handleCursorUp);

    window.addEventListener("keydown", handleKeydown);
  });

  onCleanup(() => {
    Menubar.removeEventListener("new_proj", resetTimeline);

    window.removeEventListener("pointermove", handleCursorMove);
    window.removeEventListener("pointerup", handleCursorUp);

    window.removeEventListener("keydown", handleKeydown);
  });

  return (
    <Panel class={styles.timeline}>
      <div class={styles.timeline__info}>
        <p class={styles.timeline__timecode}>{formatSeconds(currentTime(), timecodeType() === "frames" ? mediaData()?.fps || 1 : undefined)}</p>

        <div class={styles.timeline__timecodeType}>
          <label for="timecode">Timecode style</label>
          <select name="timecode" id="timecode" onInput={(e) => setTimecodeType(e.target.value === "ms" ? "time" : "frames")}>
            <option value="fps" title="Note: Will be inaccurate if video has variable frame rate">
              Frames
            </option>
            <option value="ms">Milliseconds</option>
          </select>
        </div>
      </div>
      <div class={styles.timeline__panel}>
        <div class={styles.timeline__trimInfo}>
          <p class={styles.timeline__trim_text}>
            Trim start: <span>{round(trim.start)}s</span>
          </p>
          <p class={styles.timeline__trim_text}>
            Trim end: <span>{round(trim.end)}s</span>
          </p>
        </div>
        <div class={styles.timeline__controls}>
          <div class={styles.timeline__container}>
            <div class={styles.timeline__bar} ref={(ref) => (timelineBar = ref)}>
              <div class={styles.timeline__scrollbar} tabIndex={0} role="slider" aria-label="Seek slider" onPointerDown={handleCursorDown}>
                <div
                  class={`${styles.timeline__cursor} ${styles.timeline__playhead}`}
                  onPointerDown={handleCursorDown}
                  style={`left: ${cursorPos() * 100}%`}
                ></div>
              </div>
              <div
                id="trimhead-start"
                role="slider"
                class={`${styles.timeline__cursor} ${styles.timeline__trimhead} ${styles.timeline__trim_start}`}
                style={`left: ${trimPos.start * 100}%`}
                tabIndex={0}
                data-capture-partial-focus
                onPointerDown={handleTrimheadDown}
                aria-label="Trim start slider"
              ></div>
              <div
                id="trimhead-end"
                role="slider"
                class={`${styles.timeline__cursor} ${styles.timeline__trimhead} ${styles.timeline__trim_end}`}
                style={`left: ${trimPos.end * 100}%`}
                tabIndex={0}
                data-capture-partial-focus
                onPointerDown={handleTrimheadDown}
                aria-label="Trim end slider"
              ></div>
            </div>
          </div>
        </div>
        <div class={styles.timeline__btns}></div>
      </div>
    </Panel>
  );
}
