import { Accessor } from "solid-js";

import Panel from "../panel/Panel";
import { MediaData } from "../../../types";

import panelStyles from "../panel/PanelCommon.module.css";
import styles from "./Export.module.css";

export default function Export({ data }: { data: Accessor<string | null> }) {
  return (
    <Panel column>
      <h2 class={panelStyles.heading}>Export Settings</h2>

      <button class={styles.export__btn}>Export</button>
    </Panel>
  );
}
