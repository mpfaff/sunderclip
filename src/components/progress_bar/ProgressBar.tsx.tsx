import { Accessor } from "solid-js";
import styles from "./ProgressBar.module.css";

export default function LoadingBar({
  value,
  min,
  max,
  name,
  fillColor,
  scaleOrigin,
}: {
  value: Accessor<number>;
  name: string;
  min: number;
  max: number;
  fillColor: string;
  scaleOrigin?: "left" | "center" | "right" | "top" | "bottom";
}) {
  return (
    <div class={styles.bar}>
      <div
        class={styles.bar__progress}
        style={`--progress: ${value()}%; --origin: ${scaleOrigin || "left"}; --fill: ${fillColor}`}
        role="meter"
        aria-label={name}
        aria-valuenow={`${value()}%`}
        aria-valuemax={max}
        aria-valuemin={min}
      ></div>
    </div>
  );
}
