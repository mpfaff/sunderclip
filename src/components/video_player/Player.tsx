import { convertFileSrc } from "@tauri-apps/api/core";

import Panel from "../panel/Panel";

import styles from "./Player.module.css";
import { usePlayerContext } from "../../contexts/PlayerContext";
import { useAppContext } from "../../contexts/AppContext";
import { onMount } from "solid-js";
import { createAudioAnalyser } from "../audio_panel/AudioMixer";

export default function Player() {
  const [{ videoElement, videoFile }, { setVideoElement }] = useAppContext();
  const [{ playing, audioContext }, { setCurrentTime, setPlaying, setAudioTracks, video }] = usePlayerContext();

  function updatePlaying(playing: boolean) {
    setPlaying(playing);
  }

  function updateTime() {
    const seconds = videoElement()!.currentTime;
    setCurrentTime(seconds);

    if (playing()) requestAnimationFrame(updateTime);
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

  return (
    <Panel class={styles.player} column>
      <div class={styles.player__container}>
        <video
          class={styles.player__video}
          preload="auto"
          src={videoFile() != null ? convertFileSrc(videoFile()!) : ""}
          ref={(ref) => setVideoElement(ref)}
          onPause={() => updatePlaying(false)}
          onPlay={() => {
            updatePlaying(true);
            updateTime();
          }}
          onEnded={() => updatePlaying(false)}
          crossorigin="anonymous"
        ></video>
      </div>
      <div class={styles.player__btns}>
        <button class={styles.player__btn} aria-label="Step backward">
          <i class="fa-sharp fa-regular fa-backward"></i>
        </button>
        <button class={styles.player__btn} aria-label="Jump to start of trim">
          <i class="fa-sharp fa-solid fa-backward-step"></i>
        </button>
        <button class={styles.player__btn} onClick={video.togglePlayback} title={`${playing() ? "Pause" : "Resume"} video`}>
          <i class={"fa-sharp fa-solid " + (playing() ? "fa-pause" : "fa-play")}></i>
        </button>
        <button class={styles.player__btn} aria-label="Jump to end of trim">
          <i class="fa-sharp fa-solid fa-forward-step"></i>
        </button>
        <button class={styles.player__btn} aria-label="Step forward">
          <i class="fa-sharp fa-regular fa-forward"></i>
        </button>
      </div>
    </Panel>
  );
}
