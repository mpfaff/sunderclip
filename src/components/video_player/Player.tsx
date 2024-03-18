import { Accessor, Setter, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { convertFileSrc } from "@tauri-apps/api/core";

import Panel from "../panel/Panel";

import { PlayerData } from "../../../types";
import styles from "./Player.module.css";

export default function Player({
  videoElement,
  setVideoElement,
  data,
  setPlayerData,
  file,
}: {
  videoElement: Accessor<HTMLVideoElement | undefined>;
  setVideoElement: Setter<HTMLVideoElement>;
  data: Accessor<PlayerData>;
  setPlayerData: Setter<PlayerData>;
  file: Accessor<string | null>;
}) {
  function updatePlaying(playing: boolean) {
    setPlayerData((prev) => ({ ...prev, playing }));
  }

  function updateTime() {
    const seconds = videoElement()!.currentTime;

    setPlayerData((prev) => ({ ...prev, currentTime: seconds }));

    if (data().playing) requestAnimationFrame(updateTime);
  }

  return (
    <Panel class={styles.player}>
      <div class={styles.player__container}>
        <video
          class={styles.player__video}
          src={file() != null ? convertFileSrc(file()!) : ""}
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
