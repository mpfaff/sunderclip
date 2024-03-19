import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { emit } from "@tauri-apps/api/event";

import Panel from "../panel/Panel";

import { useAppContext } from "../../contexts/AppContext";
import { usePlayerContext } from "../../contexts/PlayerContext";
import { FfprobeAudioStream } from "../../../types";

import styles from "./AudioMixer.module.css";
import panelStyles from "../panel/PanelCommon.module.css";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export function createAudioAnalyser(audioContext: AudioContext, source: HTMLMediaElement) {
  const mediaSource = audioContext.createMediaElementSource(source);
  const analyserNode = audioContext.createAnalyser();

  mediaSource.connect(analyserNode);
  analyserNode.connect(audioContext.destination);

  const pcmData = new Float32Array(analyserNode.fftSize);

  function computeAmplitude() {
    analyserNode.getFloatTimeDomainData(pcmData);
    let sumSquares = 0;

    for (const amplitude of pcmData) sumSquares += amplitude ** 2;
    return Math.sqrt(sumSquares / pcmData.length);
  }

  return { computeAmplitude, source: mediaSource };
}

const MAX_AUDIO_DIFF = 0.1;

export default function AudioMixer() {
  const [{ videoFile, mediaData }] = useAppContext();
  const [{ playing, currentTime, audioTracks, audioContext }, { setAudioTracks }] = usePlayerContext();

  const [audioMeters, setAudioMeters] = createSignal<number[]>([]);

  function updateAudioTracks() {
    const result: number[] = [];
    for (let i = 0; i < audioTracks.length; i++) {
      const audioTrack = audioTracks[i];
      result.push(audioTrack.getCurrentAmplitude());

      if (i > 0) {
        audioTrack!.audio!.play();
      }
    }
    setAudioMeters(result);

    if (playing()) {
      requestAnimationFrame(updateAudioTracks);
    } else {
      for (let i = 0; i < audioTracks.length; i++) {
        const audioTrack = audioTracks[i];

        if (i > 0) audioTrack!.audio!.pause();
      }
    }
  }

  createEffect(() => {
    if (playing()) updateAudioTracks();
  });

  createEffect(() => {
    const videoTime = currentTime();

    audioTracks.slice(1).forEach((track) => {
      if (Math.abs(videoTime - track!.audio!.currentTime) > MAX_AUDIO_DIFF) track!.audio!.currentTime = videoTime;
    });
  });

  async function requestAudioExtract(videoSource: string, audioTrackIndex: number) {
    const response = await invoke<string>("extract_audio", {
      videoSource,
      audioTrackIndex,
    });

    try {
      const data = JSON.parse(response) as { audio_source: string };

      return data.audio_source;
    } catch (err) {
      console.error(err);

      return null;
    }
  }

  createEffect(() => {
    const data = mediaData();
    const video = videoFile();
    if (data == null || video == null) return;

    (data.streams.filter((stream) => stream.codec_type === "audio") as FfprobeAudioStream[]).forEach(async (stream, i) => {
      if (i === 0) return setAudioTracks(0, "trackIndex", stream.index);

      const extractedSource = await requestAudioExtract(video, stream.index);
      if (extractedSource == null) return;

      const audio = new Audio(convertFileSrc(extractedSource));
      audio.crossOrigin = "anonymous";
      // Todo: make audio sync with video

      const { computeAmplitude, source } = createAudioAnalyser(audioContext, audio);

      // Slightly bugged as pushes to array on hot reload
      setAudioTracks(i, {
        trackIndex: stream.index,
        muted: false,
        getCurrentAmplitude: computeAmplitude,
        audio,
        source,
      });
    });
  });

  onCleanup(() => {
    emit("discard-audio-sources", {
      videoSource: videoFile(),
    });
  });

  return (
    <Panel class={styles.audio_mixer} column>
      <h2 class={panelStyles.heading}>Audio Mixer</h2>
      <ol class={styles.audio_mixer__streams}>
        <Show when={mediaData() != null} fallback={<p class={panelStyles.content_fallback}>{videoFile() != null ? "Loading..." : "No video selected"}</p>}>
          <For each={audioTracks}>
            {(stream, i) => (
              <li class={styles.audio_mixer__stream}>
                <span class={styles.audio_mixer__stream_label}>
                  Track {i() + 1}
                  <br />
                  <span class={styles.audio_mixer__stream_internal}>(stream {stream.trackIndex == -1 ? "?" : stream.trackIndex})</span>
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
