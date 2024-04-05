export type MediaData = {
  [key: string];

  filename: string;
  filepath: string;
  fileExt: string;
  width: number;
  height: number;
  videoCodec: string;
  fps: number;
  aspectRatioX: number;
  aspectRatioY: number;
  dateCreated: Date;
  streams: (FfprobeVideoStream | FfprobeAudioStream)[];
  size: number;
  size_mb: number;
  duration: number;
};

export type FfprobeVideoStream = {
  index: number;
  codec_name: string;
  codec_long_name: string;
  profile?: string;
  codec_type: string;
  codec_tag_string: string;
  codec_tag: string;
  width: number;
  height: number;
  coded_width?: number;
  coded_height?: number;
  closed_captions?: 0 | 1;
  film_grain: 0 | 1;
  has_b_frames: 0 | 1;
  sample_aspect_ratio?: string;
  display_aspect_ratio?: string;
  pix_fmt: string;
  level: number;
  color_range: string;
  color_space: string;
  color_transfer: string;
  color_primaries: string;
  chroma_location: string;
  field_order: string;
  refs: number;
  is_avc: "true" | "false";
  nal_length_size: string;
  id: string;
  r_frame_rate: string;
  avg_frame_rate: string;
  time_base: string;
  start_pts: number;
  start_time: string;
  duration_ts: 4057390;
  duration: string;
  bit_rate: string;
  bits_per_raw_sample: string;
  nb_frames: string;
  extradata_size: 42;
  disposition: {
    default: 0 | 1;
    dub: 0 | 1;
    original: 0 | 1;
    comment: 0 | 1;
    lyrics: 0 | 1;
    karaoke: 0 | 1;
    forced: 0 | 1;
    hearing_impaired: 0 | 1;
    visual_impaired: 0 | 1;
    clean_effects: 0 | 1;
    attached_pic: 0 | 1;
    timed_thumbnails: 0 | 1;
    non_diegetic: 0 | 1;
    captions: 0 | 1;
    descriptions: 0 | 1;
    metadata: 0 | 1;
    dependent: 0 | 1;
    still_image: 0 | 1;
  };
  tags: {
    creation_time?: string;
    language: string;
    handler_name: string;
    vendor_id: string;
  };
};

export type FfprobeAudioStream = {
  avg_frame_rate: "0/0";
  bit_rate: "192013";
  bits_per_sample: number;
  channel_layout: "stereo" | "mono";
  channels: number;
  codec_long_name: string;
  codec_name: string;
  codec_tag: string;
  codec_tag_string: string;
  codec_type: string;
  disposition: {
    attached_pic: 0 | 1;
    captions: 0 | 1;
    clean_effects: 0 | 1;
    comment: 0 | 1;
    default: 0 | 1;
    dependent: 0 | 1;
    descriptions: 0 | 1;
    dub: 0 | 1;
    forced: 0 | 1;
    hearing_impaired: 0 | 1;
    karaoke: 0 | 1;
    lyrics: 0 | 1;
    metadata: 0 | 1;
    non_diegetic: 0 | 1;
    original: 0 | 1;
    still_image: 0 | 1;
    timed_thumbnails: 0 | 1;
    visual_impaired: 0 | 1;
  };
  duration: string;
  duration_ts: number;
  extradata_size: number;
  id: string;
  index: number;
  initial_padding: number;
  nb_frames: string;
  profile: string;
  r_frame_rate: string;
  sample_fmt: string;
  sample_rate: string;
  start_pts: number;
  start_time: string;
  tags: {
    creation_time: string;
    handler_name: string;
    language: string;
    vendor_id: string;
  };

  time_base: string;
};

export type FfprobeOutput = {
  streams: (FfprobeVideoStream | FfprobeAudioStream)[];
  format: {
    filename: string;
    nb_streams: number;
    nb_programs: number;
    nb_stream_groups: number;
    format_name: string;
    format_long_name: string;
    start_time: string;
    duration: string;
    size: string;
    bit_rate: string;
    probe_score: number;
    tags: {
      major_brand: string;
      minor_version: string;
      encoder?: string;
      compatible_brands: string;
      creation_time?: string;
      date?: string;
    };
  };
};

export type AudioTrack = {
  trackIndex: number;
  muted: boolean;
  sourceNode: MediaElementAudioSourceNode;
  sourceElement: HTMLMediaElement;
  getCurrentAmplitude: () => number;
};

export type TrimRange = {
  start: number;
  end: number;
};

export type ExportInfo = {
  filepath: string | null;
  filename: string | null;
  absolutePath: string | null;

  videoCodec: string | null;
  audioCodec: string | null;

  mergeAudioTracks: number[];

  limitSize: boolean;
  sizeLimitDetails: {
    maxSize: number;
    rateControl: "cbr" | "vbr";
  };
};
