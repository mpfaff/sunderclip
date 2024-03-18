import { Show, createEffect, createSignal, onMount } from "solid-js";

import { MediaData, PlayerData, TrimRange } from "../types";
import styles from "./App.module.css";
import Panel from "./components/panel/Panel";
import MediaInfo from "./components/media_info_panel/MediaInfo";
import Player from "./components/video_player/Player";
import Export from "./components/export_panel/Export";
import Welcome from "./components/welcome_overlay/Welcome";
import Timeline from "./components/timeline/Timeline";
import AudioMixer from "./components/audio_panel/AudioMixer";
import { listen } from "@tauri-apps/api/event";

function App() {
  const [video, setVideo] = createSignal<HTMLVideoElement | undefined>();
  const [videoFile, setVideoFile] = createSignal<string | null>(null);
  const [playerData, setPlayerData] = createSignal<PlayerData>({ currentTime: 0, audioTracks: [], playing: true });
  const [mediaData, setMediaData] = createSignal<MediaData | null>(null);
  const [trim, setTrim] = createSignal<TrimRange>({ start: 0, end: Infinity });

  return (
    <main class={styles.app}>
      <Show when={videoFile() == null}>
        <Welcome setVideoFile={setVideoFile} />
      </Show>

      <div class={styles.app__top}>
        <MediaInfo setMediaData={setMediaData} mediaData={mediaData} file={videoFile} />
        <Player videoElement={video} setVideoElement={setVideo} data={playerData} setPlayerData={setPlayerData} file={videoFile} />
        <Export data={videoFile} />
      </div>
      <div class={styles.app__bottom}>
        <Timeline playerData={playerData} mediaData={mediaData} />
        <AudioMixer videoElement={video} mediaData={mediaData} playerData={playerData} file={videoFile} />
      </div>
    </main>
  );
}

export default App;
