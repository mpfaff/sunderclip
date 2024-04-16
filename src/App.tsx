import styles from "./App.module.css";
import MediaInfo from "./components/media_info_panel/MediaInfo";
import Player from "./components/video_player/Player";
import Export from "./components/export_panel/Export";
import Welcome from "./components/welcome_overlay/Welcome";
import Timeline from "./components/timeline/Timeline";
import AudioMixer from "./components/audio_panel/AudioMixer";

import AppProvider from "./contexts/AppContext";
import PlayerProvider from "./contexts/PlayerContext";
import ExportOverlayContainer from "./components/export_overlay/ExportOverlayContainer";

function App() {
  return (
    <AppProvider>
      <main class={styles.app}>
        <Welcome />
        <ExportOverlayContainer />

        <PlayerProvider>
          <div class={styles.app__top}>
            <MediaInfo />
            <Player />
            <Export />
          </div>
          <div class={styles.app__bottom}>
            <Timeline />
            <AudioMixer />
          </div>
        </PlayerProvider>
      </main>
    </AppProvider>
  );
}

export default App;
