import { convertFileSrc } from "@tauri-apps/api/core";

import Panel from "../panel/Panel";

import styles from "./Player.module.css";
import { usePlayerContext } from "../../contexts/PlayerContext";
import { useAppContext } from "../../contexts/AppContext";

export default function Player() {
  const [{ videoElement, videoFile }, { setVideoElement }] = useAppContext();
  const [{ playing }, { setCurrentTime, setPlaying }] = usePlayerContext();

  function updatePlaying(playing: boolean) {
    setPlaying(playing);
  }

  function updateTime() {
    const seconds = videoElement()!.currentTime;
    setCurrentTime(seconds);

    if (playing()) requestAnimationFrame(updateTime);
  }

  return (
    <Panel class={styles.player}>
      <div class={styles.player__container}>
        <video
          class={styles.player__video}
          src={videoFile() != null ? convertFileSrc(videoFile()!) : ""}
          ref={(el) => setVideoElement(el)}
          controls
          onPause={() => updatePlaying(false)}
          onPlay={() => {
            updatePlaying(true);
            updateTime();
          }}
          onEnded={() => updatePlaying(false)}
          crossorigin="anonymous"
        ></video>
      </div>
    </Panel>
  );
}
