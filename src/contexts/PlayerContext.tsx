import { ComponentProps, createContext, createSignal, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { AudioTrack } from "../../types";

function createPlayerContextType() {
  const [currentTime, setCurrentTime] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  const [audioTracks, setAudioTracks] = createStore<AudioTrack[]>([]);
  const audioContext = new AudioContext();

  return [
    { currentTime, playing, audioTracks, audioContext },
    { setCurrentTime, setPlaying, setAudioTracks },
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
  const [currentTime, setCurrentTime] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  const [audioTracks, setAudioTracks] = createStore<AudioTrack[]>([]);

  const audioContext = new AudioContext();

  return (
    <PlayerContext.Provider
      value={[
        { currentTime, playing, audioTracks, audioContext },
        { setCurrentTime, setPlaying, setAudioTracks },
      ]}
    >
      {props.children}
    </PlayerContext.Provider>
  );
}
