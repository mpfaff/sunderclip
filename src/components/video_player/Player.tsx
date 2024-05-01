import { convertFileSrc } from "@tauri-apps/api/core";

import Panel from "../panel/Panel";

import styles from "./Player.module.css";
import { usePlayerContext } from "../../contexts/PlayerContext";
import { useAppContext } from "../../contexts/AppContext";
import { Show, createEffect, createSignal, onMount } from "solid-js";
import { createAudioAnalyser } from "../audio_panel/AudioMixer";

export default function Player() {
  const [{ videoElement, videoFile, trim }, { setVideoElement }] = useAppContext();
  const [{ playing, audioContext }, { setCurrentTime, setPlaying, setAudioTracks, video }] = usePlayerContext();

  const [canPlay, setCanPlay] = createSignal<null | boolean>(null);

  function updateTime() {
    const seconds = videoElement()!.currentTime;
    setCurrentTime(seconds);

    if (playing()) requestAnimationFrame(updateTime);
  }

  function jumpToTrim(start = true) {
    const seconds = start ? trim.start : trim.end;
    video.setTime(seconds);
    setCurrentTime(seconds);
  }

  function jumpToEdge(start = true) {
    const seconds = video.setTime(start ? 0 : Infinity);
    setCurrentTime(seconds);
  }

  onMount(() => {
    const { computeAmplitude, source } = createAudioAnalyser(audioContext, videoElement()!);

    setAudioTracks(0, {
      trackIndex: -1,
      muted: false,
      getCurrentAmplitude: computeAmplitude,
      sourceNode: source,
      sourceElement: videoElement(),
    });
  });

  createEffect(() => {
    if (videoFile() != null) {
      setCanPlay(false);
    }
  });

  return (
    <Panel class={styles.player} column>
      <div class={styles.player__container}>
        <Show when={canPlay() != null && !canPlay()}>
          <img src="/images/media_pending.png" alt="Media pending" class={styles.player__poster} />
        </Show>
        <video
          class={styles.player__video}
          preload="auto"
          onCanPlay={() => setCanPlay(true)}
          src={videoFile() != null ? convertFileSrc(videoFile()!) : ""}
          ref={(ref) => setVideoElement(ref)}
          onPause={() => setPlaying(false)}
          onPlay={() => {
            setPlaying(true);
            updateTime();
          }}
          onEnded={() => setPlaying(false)}
          crossorigin="anonymous"
        ></video>
      </div>
      <div class={styles.player__btns}>
        <button class={styles.player__btn} title="Jump to start" data-capture-partial-focus onClick={() => jumpToEdge(true)}>
          <i class="fa-sharp fa-solid fa-backward-fast"></i>
        </button>
        <button class={styles.player__btn} title="Jump to trim start" onClick={() => jumpToTrim()} data-capture-partial-focus>
          <i class="fa-sharp fa-solid fa-backward-step"></i>
        </button>
        <button class={styles.player__btn} onClick={video.togglePlayback} title={`${playing() ? "Pause" : "Resume"} video`} data-capture-partial-focus>
          <i class={"fa-sharp fa-solid " + (playing() ? "fa-pause" : "fa-play")}></i>
        </button>
        <button class={styles.player__btn} title="Jump to trim end" onClick={() => jumpToTrim(false)} data-capture-partial-focus>
          <i class="fa-sharp fa-solid fa-forward-step"></i>
        </button>
        <button class={styles.player__btn} title="Jump to end" data-capture-partial-focus onClick={() => jumpToEdge(false)}>
          <i class="fa-sharp fa-solid fa-forward-fast"></i>
        </button>
      </div>
    </Panel>
  );
}
