import { ComponentProps } from "solid-js";
import styles from "./Overlay.module.css";

type OverlayProps = {
  strength?: number;
} & ComponentProps<"div">;

export default function Overlay(props: OverlayProps) {
  return (
    <div {...props} class={`${styles.overlay} ${props.class}`} style={`--strength: ${props.strength || "0.5"}`}>
      {props.children}
    </div>
  );
}
