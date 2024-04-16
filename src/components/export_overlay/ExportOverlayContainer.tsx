import { Show } from "solid-js";
import { useAppContext } from "../../contexts/AppContext";
import ExportOverlay from "./ExportOverlay";

export default function ExportOverlayContainer() {
  const [{ renderData }] = useAppContext();

  return (
    <Show when={renderData.rendering}>
      <ExportOverlay />
    </Show>
  );
}
