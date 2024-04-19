export function gcd(a: number, b: number) {
  for (let temp = b; b !== 0; ) {
    b = a % b;
    a = temp;
    temp = b;
  }
  return a;
}

export function round(number: number, places = 2) {
  const accuracy = 10 ** places;
  return Math.round(number * accuracy) / accuracy;
}

export function minmax(min: number, number: number, max: number) {
  return Math.min(max, Math.max(number, min));
}

export function formatSeconds(seconds: number, framerate?: number) {
  const isFrames = framerate != null;

  const secondsLoopback = seconds % 3600;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor(secondsLoopback / 60);
  const s = Math.floor(secondsLoopback % 60);

  const msOrFrames = isFrames ? Math.floor((seconds * framerate) % framerate) : Math.floor((seconds * 1000) % 1000000);
  const digits = framerate != null ? Math.floor(framerate).toString().length : null;

  return (
    ("0" + h).slice(-2) +
    ":" +
    ("0" + m).slice(-2) +
    ":" +
    ("0" + s).slice(-2) +
    ";" +
    (framerate == null ? ("000" + msOrFrames).slice(-3) : ("0".repeat(digits!) + msOrFrames).slice(-digits!))
  );
}
