import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import Panel from "../panel/Panel";

import styles from "./Timeline.module.css";
import { formatSeconds, round } from "../../util";
import { useAppContext } from "../../contexts/AppContext";
import { usePlayerContext } from "../../contexts/PlayerContext";
import { createStore } from "solid-js/store";

type TrimPosition = {
  start: {
    position: number;
    percentage: number;
  };
  end: {
    position: number;
    percentage: number;
  };
};

export default function Timeline() {
  const [{ videoElement, mediaData, trim }, { setTrim }] = useAppContext();
  const [{ currentTime, playing }, { setCurrentTime, setPlaying, video }] = usePlayerContext();

  const [dragging, setDragging] = createSignal(false);
  const [trimDragging, setTrimDragging] = createStore<{ start: boolean; end: boolean; any: boolean }>({ start: false, end: false, any: false });
  const [cursorPos, setCursorPos] = createSignal(0);
  const [trimPos, setTrimPos] = createStore<TrimPosition>({ start: { position: 0, percentage: 0 }, end: { position: 0, percentage: 1 } });
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
      sliderWidth,
      parentWidth,
      parentStartX,
      offset,
    }: {
      mouseX: number;
      sliderWidth: number;
      parentWidth: number;
      parentStartX: number;
      offset: number;
      minPercent?: number;
      maxPercent?: number;
    },
    min = 0,
    max = 1
  ) {
    const sliderOffset = sliderWidth * offset;

    const delta = mouseX - parentStartX;
    const position = Math.max(min * parentWidth, Math.min(delta, (parentWidth - sliderOffset) * max) - sliderOffset);
    const percentage = Math.max(min, Math.min((delta - sliderOffset) / (parentWidth - sliderWidth), max));

    return { position, percentage };
  }

  function handleCursorMove(event: PointerEvent) {
    if (dragging()) {
      const sliderRect = cursorRef.getBoundingClientRect();
      const cursorContainerRect = timelineContainerRef.getBoundingClientRect();
      const { position, percentage } = getSliderLocation({
        mouseX: event.x,
        sliderWidth: sliderRect.width,
        parentStartX: cursorContainerRect.x,
        parentWidth: cursorContainerRect.width,
        offset: 0.5,
      });

      updateVideoTime(videoElement()!.duration * percentage);
      setCursorPos(position);
    } else if (trimDragging.any) {
      const trimheadName = trimDragging.start ? "start" : "end";

      setTrimDragging(trimheadName, true);
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

    const trimheadRect = trimhead.getBoundingClientRect();
    const timelineBarRect = timelineBar.getBoundingClientRect();

    const properties = {
      mouseX: event.x,
      sliderWidth: trimheadRect.width,
      parentStartX: timelineBarRect.x,
      parentWidth: timelineBarRect.width,
      offset: 0,
    };

    const { position, percentage } = getSliderLocation(properties, trimStart ? 0 : trimPos.start.percentage, !trimStart ? 1 : trimPos.end.percentage);

    setTrim(trimheadName, percentage * videoElement()!.duration);
    setTrimPos(trimheadName, "position", !trimStart ? timelineBarRect.width - position : position);
    setTrimPos(trimheadName, "percentage", percentage);
  }

  createEffect(() => {
    if (dragging()) return;

    const cursorWidth = cursorRef.getBoundingClientRect().width;
    const timelineBarRect = timelineContainerRef.getBoundingClientRect();

    const time = currentTime();
    const duration = videoElement()!.duration;

    setCursorPos((!isNaN(duration) ? time / duration : 0) * (timelineBarRect.width - cursorWidth));
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
          {round(trimPos.start.percentage * 100)}% to {round(trimPos.end.percentage * 100)}%
        </p>
      </div>
      <div class={styles.timeline__controls}>
        <div class={styles.timeline__container}>
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
              style={`--translateX: ${cursorPos()}px`}
              ref={(ref) => (cursorRef = ref)}
            ></div>
          </div>
          <div class={styles.timeline__bar} ref={(ref) => (timelineBar = ref)}>
            <div
              id="trimhead-start"
              class={`${styles.timeline__cursor} ${styles.timeline__trimhead} ${styles.timeline__trim_start}`}
              ref={(ref) => (trimheadStartRef = ref)}
              style={`--translateX: ${trimPos.start.position}px`}
              onPointerDown={handleTrimheadDown}
            ></div>
            <div
              id="trimhead-end"
              class={`${styles.timeline__cursor} ${styles.timeline__trimhead} ${styles.timeline__trim_end}`}
              ref={(ref) => (trimheadEndRef = ref)}
              style={`--translateX: -${trimPos.end.position}px`}
              onPointerDown={handleTrimheadDown}
            ></div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
