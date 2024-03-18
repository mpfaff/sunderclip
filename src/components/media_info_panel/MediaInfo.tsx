import { Show, createEffect } from "solid-js";

import { FfprobeOutput, FfprobeVideoStream, MediaData } from "../../../types";
import Panel from "../panel/Panel";

import panelStyles from "../panel/PanelCommon.module.css";
import styles from "./MediaInfo.module.css";
import { invoke } from "@tauri-apps/api/core";
import { gcd, round } from "../../util";
import { useAppContext } from "../../contexts/AppContext";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

export default function MediaInfo() {
  const [{ videoFile, mediaData }, { setMediaData }] = useAppContext();

  createEffect(async () => {
    const file = videoFile();

    if (file == null) return;

    setMediaData(null);

    const rawData: string = await invoke("ffprobe_cmd", {
      filepath: file,
    });

    try {
      const json = JSON.parse(rawData) as FfprobeOutput;

      const videoStream = json.streams.find((stream) => stream.codec_type === "video")! as FfprobeVideoStream;

      const fpsFraction = videoStream.avg_frame_rate.split("/");
      const aspectRatioGcd = gcd(videoStream.width, videoStream.height);
      const size = Number(json.format.size);

      const data: MediaData = {
        filename: file,
        width: videoStream.width,
        height: videoStream.height,
        videoCodec: videoStream.codec_name,
        fps: round(Number(fpsFraction[0]) / Number(fpsFraction[1])),
        streams: json.streams,
        aspectRatioX: round(videoStream.width / aspectRatioGcd),
        aspectRatioY: round(videoStream.height / aspectRatioGcd),
        dateCreated: new Date(json.format.tags.creation_time || 0),
        size,
        size_mb: round(size / 1e6),
        duration: round(Number(videoStream.duration), 3),
      };

      setMediaData(data);
    } catch (err) {
      console.error(err);
      alert("An error occurred getting the media info for the video: " + err);
    }
  });

  return (
    <Panel column>
      <h2 class={panelStyles.heading}>Media Information</h2>
      <Show when={mediaData() != null} fallback={<p class={panelStyles.content_fallback}>{videoFile() != null ? "Loading..." : "No video selected"}</p>}>
        <ul class={styles.media_info}>
          {(() => {
            const data = mediaData()!;

            return (
              <>
                <li class={styles.media_info__item}>
                  <span class={styles.media_info__text}>Width</span>
                  <span class={styles.media_info__text}>{data.width}</span>
                </li>
                <li class={styles.media_info__item}>
                  <span class={styles.media_info__text}>Height</span>
                  <span class={styles.media_info__text}>{data.height}</span>
                </li>
                <li class={styles.media_info__item}>
                  <span class={styles.media_info__text}>V-Codec</span>
                  <span class={styles.media_info__text}>{data.videoCodec}</span>
                </li>
                <li class={styles.media_info__item}>
                  <span class={styles.media_info__text}>FPS</span>
                  <span class={styles.media_info__text}>{data.fps}</span>
                </li>
                <li class={styles.media_info__item}>
                  <span class={styles.media_info__text}>Total Streams</span>
                  <span class={styles.media_info__text}>{data.streams.length}</span>
                </li>
                <li class={styles.media_info__item}>
                  <span class={styles.media_info__text}>Aspect Ratio</span>
                  <span class={styles.media_info__text}>
                    {data.aspectRatioX}:{data.aspectRatioY}
                  </span>
                </li>
                <li class={styles.media_info__item}>
                  <span class={styles.media_info__text}>Duration</span>
                  <span class={styles.media_info__text}>{data.duration}s</span>
                </li>
                <li class={styles.media_info__item}>
                  <span class={styles.media_info__text}>Size</span>
                  <span class={styles.media_info__text}>{data.size_mb}MB</span>
                </li>
                <li class={styles.media_info__item}>
                  <span class={styles.media_info__text}>Date Created</span>
                  <span class={styles.media_info__text}>{data.dateCreated.getTime() ? dateFormatter.format(data.dateCreated) : "Unknown"}</span>
                </li>
                <li class={styles.media_info__item}>
                  <span class={styles.media_info__text}>File</span>
                  <span class={styles.media_info__text}>{data.filename}</span>
                </li>
              </>
            );
          })()}
        </ul>
      </Show>
    </Panel>
  );
}
