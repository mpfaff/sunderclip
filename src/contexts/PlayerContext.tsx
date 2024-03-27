import { ComponentProps, createContext, createSignal, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { AudioTrack } from "../../types";
import { useAppContext } from "./AppContext";

function createPlayerContextType() {
  const [currentTime, setCurrentTime] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  const [audioTracks, setAudioTracks] = createStore<AudioTrack[]>([]);
  const audioContext = new AudioContext();

  function pause() {
    new HTMLVideoElement().pause();
  }
  function resume() {
    new HTMLVideoElement().play();
  }
  function togglePlayback() {
    const video = new HTMLVideoElement();
    video.paused ? resume() : pause();
  }

  return [
    { currentTime, playing, audioTracks, audioContext },
    { setCurrentTime, setPlaying, setAudioTracks, video: { pause, resume, togglePlayback } },
  ] as const;
}
type PlayerContextType = ReturnType<typeof createPlayerContextType>;

export const PlayerContext = createContext<PlayerContextType>();

export function usePlayerContext() {
  const context = useContext(PlayerContext);

  if (context == null) throw new Error("Cannot access player context outside ContextProvider");

  return context;
}

export default function PlayerProvider(props: ComponentProps<"div">) {
  const [{ videoElement }] = useAppContext();

  const [currentTime, setCurrentTime] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  const [audioTracks, setAudioTracks] = createStore<AudioTrack[]>([]);

  const audioContext = new AudioContext();

  function pause() {
    videoElement()!.pause();
  }
  function resume() {
    videoElement()!.play();
  }
  function togglePlayback() {
    const video = videoElement()!;
    video.paused ? resume() : pause();
  }

  return (
    <PlayerContext.Provider
      value={[
        { currentTime, playing, audioTracks, audioContext },
        { setCurrentTime, setPlaying, setAudioTracks, video: { pause, resume, togglePlayback } },
      ]}
    >
      {props.children}
    </PlayerContext.Provider>
  );
}
