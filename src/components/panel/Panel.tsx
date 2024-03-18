import { ComponentProps } from "solid-js";
import styles from "./Panel.module.css";
type PanelProps = {
  row?: true;
  column?: true;
} & ComponentProps<"div">;

export default function Panel(props: PanelProps) {
  return (
    <div {...props} class={(props.class || "") + ` ${styles.panel} ${props.column ? styles.panelColumn : styles.panelRow}`}>
      {props.children}
    </div>
  );
}
