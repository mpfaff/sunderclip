import { ComponentProps, createContext, createSignal, onCleanup, onMount, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

import Menubar from "../classes/Menubar";
import { MediaData, RenderInfo, RenderSizeLimit, TrimRange } from "../../types";
import Renderer from "../classes/Renderer";

function createAppContext() {
  const [videoElement, setVideoElement] = createSignal<HTMLVideoElement | undefined>();
  const [videoFile, setVideoFile] = createSignal<string | null>(null);
  const [mediaData, setMediaData] = createSignal<MediaData | null>(null);
  const [trim, setTrim] = createStore<TrimRange>({ start: 0, end: Infinity });
  const [renderData, setRenderData] = createStore<{ rendering: boolean; renderer: Renderer | null }>({
    rendering: false,
    renderer: null,
  });

  async function render(settings: RenderInfo, sizeLimit: RenderSizeLimit | null) {}

  return [
    { videoElement, videoFile, mediaData, renderData, trim },
    { setVideoElement, setVideoFile, setMediaData, setTrim, setRenderData },
    { render },
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

const html = document.querySelector("html")!;

export default function AppProvider(props: AppProvider) {
  const [videoElement, setVideoElement] = createSignal<HTMLVideoElement | undefined>();
  const [videoFile, setVideoFile] = createSignal<string | null>(null);
  const [mediaData, setMediaData] = createSignal<MediaData | null>(null);
  const [trim, setTrim] = createStore<TrimRange>({ start: 0, end: Infinity });
  const [renderData, setRenderData] = createStore<{ rendering: boolean; renderer: Renderer | null }>({
    rendering: false,
    renderer: null,
  });

  function newProject() {
    // TODO: implement actual new project dialog
    setVideoFile(null);
    setMediaData(null);
    setTrim({ start: 0, end: Infinity });
  }

  async function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case "F11": {
        await invoke("toggle_fullscreen");
        break;
      }
      case "+":
      case "=": {
        if (event.ctrlKey) zoomIn();
        else return;

        break;
      }
      case "-": {
        if (event.ctrlKey) zoomOut();
        else return;

        break;
      }
      default:
        return;
    }
    event.preventDefault();
  }

  function zoom(out: boolean) {
    html.style.setProperty("--zoom", Math.min(2, Math.max(0.25, Number(html.style.getPropertyValue("--zoom") || 1) + (out ? -0.1 : 0.1))).toString());
  }
  function zoomIn() {
    zoom(false);
  }
  function zoomOut() {
    zoom(true);
  }

  async function render(settings: RenderInfo, sizeLimit: RenderSizeLimit | null) {
    setRenderData("rendering", true);

    const renderer = new Renderer(
      {
        ...settings,
        trimStart: trim.start,
        trimEnd: trim.end,
      },
      sizeLimit,
      {
        totalDuration: trim.end - trim.start,
      }
    );

    await renderer.init();

    setRenderData("renderer", renderer);

    await renderer.render();
  }

  function openPreferences() {
    alert("Preferences: coming soon");
  }

  onMount(async () => {
    await Menubar.init();
    Menubar.addEventListener("new_proj", newProject);
    Menubar.addEventListener("prefs", openPreferences);
    Menubar.addEventListener("zoom_in", zoomIn);
    Menubar.addEventListener("zoom_out", zoomOut);

    window.addEventListener("keydown", handleKeydown);

    await invoke("close_splashscreen");
  });

  onCleanup(() => {
    Menubar.cleanup();
    window.removeEventListener("keydown", handleKeydown);
  });

  return (
    <AppContext.Provider
      value={[{ videoElement, videoFile, mediaData, renderData, trim }, { setVideoElement, setVideoFile, setMediaData, setRenderData, setTrim }, { render }]}
    >
      {props.children}
    </AppContext.Provider>
  );
}
