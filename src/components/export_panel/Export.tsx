import Panel from "../panel/Panel";

import panelStyles from "../panel/PanelCommon.module.css";
import styles from "./Export.module.css";

export default function Export() {
  return (
    <Panel column>
      <h2 class={panelStyles.heading}>Export Settings</h2>

      <button class={styles.export__btn}>Export</button>
    </Panel>
  );
}
