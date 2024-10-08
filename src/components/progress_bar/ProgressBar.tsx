import { Accessor } from "solid-js";
import styles from "./ProgressBar.module.css";

export default function LoadingBar({
  value,
  done,
  min,
  max,
  name,
  fillColor,
  scaleOrigin,
}: {
  value: (() => number) | Accessor<number>;
  done: (() => boolean) | Accessor<boolean>;
  name: string;
  min: number;
  max: number;
  fillColor: string;
  scaleOrigin?: "left" | "center" | "right" | "top" | "bottom";
}) {
  return (
    <div class={styles.bar}>
      <span class={styles.bar__text}>{value()}%</span>
      <div
        class={styles.bar__progress}
        style={`--progress: ${value()}%; --origin: ${scaleOrigin || "left"}; --fill: ${fillColor}; --state: ${done() ? "hidden" : "visible"}`}
        role="meter"
        aria-label={name}
        aria-valuenow={value()}
        aria-valuemax={max}
        aria-valuemin={min}
      ></div>
    </div>
  );
}
