import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";

import Panel from "../panel/Panel";

import { useAppContext } from "../../contexts/AppContext";
import { usePlayerContext } from "../../contexts/PlayerContext";
import { FfprobeAudioStream } from "../../../types";

import styles from "./AudioMixer.module.css";
import panelStyles from "../panel/PanelCommon.module.css";

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

      if (i === 0) continue;
      if (playing()) {
        if (audioTrack.sourceElement.paused) audioTrack.sourceElement.play();

        requestAnimationFrame(updateAudioTracks);
      } else {
        audioTrack.sourceElement.pause();
      }
    }

    setAudioMeters(result);
  }

  createEffect(() => {
    // Keep updating audio meters while playing
    if (playing()) updateAudioTracks();
  });

  createEffect(() => {
    audioTracks.forEach((stream) => {
      stream.sourceElement.muted = stream.muted;
    });
  });

  createEffect(() => {
    // Sync audio tracks to video
    const videoTime = currentTime();

    audioTracks.slice(1).forEach((track) => {
      if (Math.abs(videoTime - track.sourceElement.currentTime) > MAX_AUDIO_DIFF) {
        track.sourceElement.currentTime = videoTime;
      }
    });
  });

  createEffect(() => {
    const data = mediaData();
    const video = videoFile();
    if (data == null || video == null) return;

    (data.streams.filter((stream) => stream.codec_type === "audio") as FfprobeAudioStream[]).forEach(async (stream, i) => {
      if (i === 0) return setAudioTracks(0, "trackIndex", stream.index);

      const blob = await (await fetch(`${location.protocol}//extract-audio.${location.hostname}/${encodeURIComponent(video)}/${stream.index}`)).blob();

      const audio = new Audio(URL.createObjectURL(blob));
      audio.crossOrigin = "anonymous";

      const { computeAmplitude, source } = createAudioAnalyser(audioContext, audio);

      setAudioTracks(i, {
        trackIndex: stream.index,
        muted: false,
        getCurrentAmplitude: computeAmplitude,
        sourceElement: audio,
        sourceNode: source,
      });
    });
  });

  onCleanup(() => {
    audioTracks.slice(1).forEach((track) => {
      track.sourceNode.disconnect();

      // Remove audio: https://stackoverflow.com/questions/3258587/how-to-properly-unload-destroy-a-video-element
      // This will explicitly work only after about a second of the component being loaded
      track.sourceElement.pause();
      track.sourceElement.removeAttribute("src");
      track.sourceElement.load();
      track.sourceElement.src = "";
      track.sourceElement.srcObject = null;
      track.sourceElement.remove();

      URL.revokeObjectURL(track.sourceElement.src);
    });

    setAudioTracks([audioTracks[0]]);
  });

  return (
    <Panel class={styles.audio_mixer} column>
      <h2 class={panelStyles.heading}>Audio Mixer</h2>
      <ol class={styles.audio_mixer__streams}>
        <Show when={mediaData() != null} fallback={<p class={panelStyles.content_fallback}>{videoFile() != null ? "Loading..." : "No video selected"}</p>}>
          <For each={audioTracks}>
            {(stream, i) => (
              <li class={styles.audio_mixer__stream}>
                <span class={styles.audio_mixer__stream_label} contentEditable>
                  Track {i() + 1}
                </span>
                <span class={styles.audio_mixer__stream_internal}>(stream {stream.trackIndex == -1 ? "?" : stream.trackIndex})</span>

                <div class={styles.audio_mixer__btns}>
                  <button class={styles.audio_mixer__btn} onClick={() => setAudioTracks(i(), "muted", !stream.muted)}>
                    {stream.muted ? "Muted" : "Mute"}
                  </button>
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
