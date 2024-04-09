export type VideoCodec = keyof typeof VideoCodecs;
export const VideoCodecs = {
  h264: {
    container: "mp4",
    cpu: "libx264",
    hwPrefix: "h264",
    friendlyName: "H.264",
    rateControl: {
      cbr: ["-x264-params", `"nal-hrd=cbr"`, "-b:v", "TARGET_BITRATE", "-minrate", "MIN_BITRATE", "-maxrate", "MAX_BITRATE", "-bufsize", "BUF_SIZE"],
      abr: ["-b:v", "TARGET_BITRATE"],
      vbr: null,
      crf: ["-crf", "CRF_VALUE"],
    },
    crf: {
      default: 23,
      min: 0,
      max: 51,
    },
  },

  h265: {
    container: "mp4",
    cpu: "libx265",
    hwPrefix: "hevc",
    friendlyName: "H.265",
    rateControl: {
      cbr: null,
      vbr: [],
      abr: ["-b:v", "TARGET_BITRATE"],
      crf: ["-crf", "CRF_VALUE"],
    },
    crf: {
      default: 28,
      min: 0,
      max: 51,
    },
  },

  av1: {
    container: "mp4",
    cpu: "libaom-av1",
    hwPrefix: "av1",
    friendlyName: "AV1",
    rateControl: {
      cbr: null,
      abr: ["-b:v", "TARGET_BITRATE"],
      vbr: ["-b:v", "TARGET_BITRATE", "-minrate", "MIN_BITRATE", "-maxrate", "MAX_BITRATE"],
      crf: ["-crf", "CRF_VALUE"],
    },
    crf: {
      default: 30,
      min: 0,
      max: 64,
    },
  },

  gif: {
    container: "gif",
    cpu: "gif",
    hwPrefix: null,
    friendlyName: "GIF",
    rateControl: {
      cbr: [],
      abr: ["-b:v", "TARGET_BITRATE"],
      vbr: [],
    },
    crf: null,
  },

  vp9: {
    container: "webm",
    cpu: "libvpx-vp9",
    hwPrefix: "vp9",
    friendlyName: "VP9",
    rateControl: {
      cbr: ["-b:v", "TARGET_BITRATE", "-minrate", "TARGET_BITRATE", "-maxrate", "TARGET_BITRATE"],
      abr: ["-b:v", "TARGET_BITRATE"],
      vbr: ["-b:v", "TARGET_BITRATE", "-minrate", "MIN_BITRATE", "-maxrate", "MAX_BITRATE"],
      crf: ["-crf", "CRF_VALUE", "-b:v", "0"],
    },
    crf: {
      default: 30,
      min: 0,
      max: 63,
    },
  },
} as const;

export type VendorSuffix = keyof typeof VideoCodecHwVendorSuffixes;
export const VideoCodecHwVendorSuffixes = {
  nvenc: "Nvidia",
  amf: "AMD",
  qsv: "Intel",
  videotoolbox: "Apple",
} as const;

export type AudioCodec = keyof typeof AudioCodecs;
export const AudioCodecs = {
  aac: {
    container: "mp4a",
    id: "aac",
    friendlyName: "AAC",
  },
  mp3: {
    container: "mp3",
    id: "libmp3lame",
    friendlyName: "MP3",
  },
  ogg: {
    container: "ogg",
    id: "ogg",
    friendlyName: "OGG",
  },
  vorbis: {
    container: "ogg",
    id: "vorbis",
    friendlyName: "Vorbis",
  },
  opus: {
    container: "opus",
    id: "opus",
    friendlyName: "Opus",
  },
  flac: {
    container: "flac",
    id: "flac",
    friendlyName: "FLAC (lossless)",
  },
  alac: {
    container: "mp4",
    id: "alac",
    friendlyName: "ALAC (lossless)",
  },
} as const;
