import { ComponentProps, createContext, createSignal, onMount, useContext } from "solid-js";
import { MediaData, TrimRange } from "../../types";
import { createStore } from "solid-js/store";
import { listen } from "@tauri-apps/api/event";

function createAppContext() {
  const [videoElement, setVideoElement] = createSignal<HTMLVideoElement | undefined>();
  const [videoFile, setVideoFile] = createSignal<string | null>(null);
  const [mediaData, setMediaData] = createSignal<MediaData | null>(null);
  const [trim, setTrim] = createStore<TrimRange>({ start: 0, end: Infinity });

  return [
    { videoElement, videoFile, mediaData, trim },
    { setVideoElement, setVideoFile, setMediaData, setTrim },
  ] as const;
}
type AppContextType = ReturnType<typeof createAppContext>;

export const AppContext = createContext<AppContextType>();

export function useAppContext() {
  const context = useContext(AppContext);

  if (context == null) throw new Error("Cannot access app context outside ContextProvider");

  return context;
}

type AppProvider = {} & ComponentProps<"div">;
export default function AppProvider(props: AppProvider) {
  const [videoElement, setVideoElement] = createSignal<HTMLVideoElement | undefined>();
  const [videoFile, setVideoFile] = createSignal<string | null>(null);
  const [mediaData, setMediaData] = createSignal<MediaData | null>(null);
  const [trim, setTrim] = createStore<TrimRange>({ start: 0, end: Infinity });

  function newProject() {
    // TODO: implement actual new project dialog
    setVideoFile(null);
  }

  onMount(async () => {
    await listen("new_proj", newProject);
  });

  return (
    <AppContext.Provider
      value={[
        { videoElement, videoFile, mediaData, trim },
        { setVideoElement, setVideoFile, setMediaData, setTrim },
      ]}
    >
      {props.children}
    </AppContext.Provider>
  );
}
