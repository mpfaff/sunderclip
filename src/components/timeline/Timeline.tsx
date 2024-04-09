import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import Panel from "../panel/Panel";

import styles from "./Timeline.module.css";
import { formatSeconds, round } from "../../util";
import { useAppContext } from "../../contexts/AppContext";
import { usePlayerContext } from "../../contexts/PlayerContext";
import { createStore } from "solid-js/store";
import { TrimRange } from "../../../types";

const capturingElements = new Set(["INPUT", "SELECT", "BUTTON"]);
export default function Timeline() {
  const [{ videoElement, mediaData, trim }, { setTrim }] = useAppContext();
  const [{ currentTime, playing }, { setCurrentTime, setPlaying, video }] = usePlayerContext();

  const [dragging, setDragging] = createSignal(false);
  const [trimDragging, setTrimDragging] = createStore<{ start: boolean; end: boolean; any: boolean }>({ start: false, end: false, any: false });
  const [cursorPos, setCursorPos] = createSignal(0);
  const [trimPos, setTrimPos] = createStore<TrimRange>({ start: 0, end: 1 });
  const [timecodeType, setTimecodeType] = createSignal<"frames" | "time">("time");

  let cursorRef: HTMLDivElement;
  let timelineContainerRef: HTMLDivElement;
  let timelineBar: HTMLDivElement;
  let trimheadStartRef: HTMLDivElement;
  let trimheadEndRef: HTMLDivElement;

  function handleKeydown(event: KeyboardEvent) {
    if (dragging()) return;

    switch (event.code) {
      case "Space": {
        const focusedElement = document.activeElement;
        if (
          focusedElement != null &&
          focusedElement instanceof HTMLElement &&
          (capturingElements.has(focusedElement.tagName) || focusedElement.dataset["captureFocus"])
        )
          return;
        video.togglePlayback();
        break;
      }
      case "ArrowLeft": {
        break;
      }
      case "ArrowRight": {
        break;
      }
      default:
        return;
    }

    event.preventDefault();
  }

  function updateVideoTime(location: number) {
    videoElement()!.currentTime = location;

    setCurrentTime(location);
  }

  function handleCursorDown(event: PointerEvent) {
    setDragging(true);
    video.pause();
    handleCursorMove(event);
  }

  function handleTrimheadDown(event: PointerEvent) {
    const trimStart = (event.target as HTMLDivElement).id === "trimhead-start";
    setTrimDragging(trimStart ? "start" : "end", true);

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
    const percentage = Math.max(min, Math.min(relativePos / parentWidth, max));

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
    }
  }

  createEffect(() => {
    setTrimDragging("any", trimDragging.start || trimDragging.end);
  });

  function handleTrimheadMove(event: PointerEvent) {
    if (!trimDragging.any) return;

    const trimStart = trimDragging.start;
    const trimhead = trimStart ? trimheadStartRef : trimheadEndRef;
    const trimheadName = trimStart ? "start" : "end";

    const timelineBarRect = timelineBar.getBoundingClientRect();

    const properties = {
      mouseX: event.x,
      parentStartX: timelineBarRect.x,
      parentWidth: timelineBarRect.width,
    };

    const { percentage } = getSliderLocation(properties, trimStart ? 0 : trimPos.start, !trimStart ? 1 : trimPos.end);

    setTrim(trimheadName, percentage * videoElement()!.duration);
    setTrimPos(trimheadName, percentage);
  }

  createEffect(() => {
    if (dragging()) return;

    const time = currentTime();
    const duration = videoElement()!.duration;

    setCursorPos(!isNaN(duration) ? time / duration : 0);
  });

  onMount(() => {
    window.addEventListener("pointermove", handleCursorMove);
    window.addEventListener("pointerup", handleCursorUp);

    window.addEventListener("keydown", handleKeydown);
  });

  onCleanup(() => {
    window.removeEventListener("pointermove", handleCursorMove);
    window.removeEventListener("pointerup", handleCursorUp);

    window.removeEventListener("keydown", handleKeydown);
  });

  return (
    <Panel class={styles.timeline}>
      <div class={styles.timeline__info}>
        <p class={styles.timeline__timecode} contenteditable>
          {formatSeconds(currentTime(), timecodeType() === "frames" ? mediaData()?.fps || 1 : undefined)}
        </p>
        <p>
          {round(trim.start)}s to {round(trim.end)}s
        </p>
        <p>
          {round(trimPos.start * 100)}% to {round(trimPos.end * 100)}%
        </p>
      </div>
      <div class={styles.timeline__controls}>
        <div class={styles.timeline__container}>
          <div class={styles.timeline__bar} ref={(ref) => (timelineBar = ref)}>
            <div
              class={styles.timeline__scrollbar}
              ref={(ref) => (timelineContainerRef = ref)}
              tabIndex={0}
              role="slider"
              aria-label="Seek slider"
              onPointerDown={handleCursorDown}
            >
              <div
                class={`${styles.timeline__cursor} ${styles.timeline__playhead}`}
                onPointerDown={handleCursorDown}
                style={`left: ${cursorPos() * 100}%`}
                ref={(ref) => (cursorRef = ref)}
              ></div>
            </div>
            <div
              id="trimhead-start"
              class={`${styles.timeline__cursor} ${styles.timeline__trimhead} ${styles.timeline__trim_start}`}
              ref={(ref) => (trimheadStartRef = ref)}
              style={`left: ${trimPos.start * 100}%`}
              onPointerDown={handleTrimheadDown}
            ></div>
            <div
              id="trimhead-end"
              class={`${styles.timeline__cursor} ${styles.timeline__trimhead} ${styles.timeline__trim_end}`}
              ref={(ref) => (trimheadEndRef = ref)}
              style={`left: ${trimPos.end * 100}%`}
              onPointerDown={handleTrimheadDown}
            ></div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
