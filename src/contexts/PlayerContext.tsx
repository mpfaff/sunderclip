import { ComponentProps, createContext, createSignal, useContext } from "solid-js";

function createPlayerContextType() {
  const [currentTime, setCurrentTime] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);

  return [
    { currentTime, playing },
    { setCurrentTime, setPlaying },
  ] as const;
}
type PlayerContextType = ReturnType<typeof createPlayerContextType>;

export const PlayerContext = createContext<PlayerContextType>();

export function usePlayerContext() {
  const context = useContext(PlayerContext);

  if (context == null) throw new Error("Cannot access app context outside ContextProvider");

  return context;
}

export default function PlayerProvider(props: ComponentProps<"div">) {
  const [currentTime, setCurrentTime] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);

  return (
    <PlayerContext.Provider
      value={[
        { currentTime, playing },
        { setCurrentTime, setPlaying },
      ]}
    >
      {props.children}
    </PlayerContext.Provider>
  );
}
