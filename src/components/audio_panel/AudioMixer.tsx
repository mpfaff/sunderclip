import { Accessor, For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import Panel from "../panel/Panel";

import styles from "./AudioMixer.module.css";
import panelStyles from "../panel/PanelCommon.module.css";
import { MediaData, PlayerData } from "../../../types";

export default function AudioMixer({
  videoElement,
  mediaData,
  playerData,
  file,
}: {
  videoElement: Accessor<HTMLVideoElement | undefined>;
  mediaData: Accessor<MediaData | null>;
  playerData: Accessor<PlayerData>;
  file: Accessor<string | null>;
}) {
  const [audioMeters, setAudioMeters] = createSignal<number[]>([]);
  const playing = createMemo(() => playerData().playing);
  const [computers, setComputers] = createSignal<Set<() => number>>(new Set());
  const [sources, setSources] = createSignal<Set<MediaElementAudioSourceNode>>(new Set());
  const [audioContext] = createSignal(new AudioContext());

  function addAnalyserToAudioTrack(source: HTMLMediaElement) {
    const mediaSource = audioContext().createMediaElementSource(source!);
    const analyserNode = audioContext().createAnalyser();

    mediaSource.connect(analyserNode);
    analyserNode.connect(audioContext().destination);

    const pcmData = new Float32Array(analyserNode.fftSize);

    function compute() {
      analyserNode.getFloatTimeDomainData(pcmData);
      let sumSquares = 0;

      for (const amplitude of pcmData) sumSquares += amplitude ** 2;
      return Math.sqrt(sumSquares / pcmData.length);
    }

    return { compute, source: mediaSource };
  }

  function render() {
    const result: number[] = [];
    for (const computer of computers()) result.push(computer());
    setAudioMeters(result);

    if (playing()) requestAnimationFrame(render);
  }

  createEffect(() => {
    if (playing()) requestAnimationFrame(render);
  });

  function mount() {
    if (!sources().values().next().value) {
      const { compute, source } = addAnalyserToAudioTrack(videoElement()!);

      setComputers((prev) => prev.add(compute));
      setSources((prev) => prev.add(source));
    }

    render();
  }

  onMount(mount);

  onCleanup(async () => {
    // await audioContext().close();
  });

  return (
    <Panel class={styles.audio_mixer} column>
      <h2 class={panelStyles.heading}>Audio Mixer</h2>
      <ol class={styles.audio_mixer__streams}>
        <Show when={mediaData() != null} fallback={<p class={panelStyles.content_fallback}>{file() != null ? "Loading..." : "No video selected"}</p>}>
          <For each={mediaData()?.streams?.filter((stream) => stream.codec_type === "audio") || []}>
            {(stream, i) => (
              <li class={styles.audio_mixer__stream}>
                <span class={styles.audio_mixer__stream_label}>
                  Track {i() + 1}
                  <br />
                  <span class={styles.audio_mixer__stream_internal}>(stream {stream.index})</span>
                </span>

                <div class={styles.audio_mixer__btns}>
                  <button class={styles.audio_mixer__btn}>Mute</button>
                </div>
                <div class={styles.audio_mixer__visualizer} role="meter" style={`--silence: ${100 - audioMeters()[i()] * 100}%`}></div>
              </li>
            )}
          </For>
        </Show>
      </ol>
    </Panel>
  );
}
