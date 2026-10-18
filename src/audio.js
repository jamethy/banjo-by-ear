// An original, synthesized G-major roll; no external recordings are bundled.
export function createDemo() {
  const sampleRate = 22050;
  const duration = 24;
  const samples = new Float32Array(sampleRate * duration);
  const notes = [196, 246.94, 293.66, 392, 246.94, 293.66, 196, 392];
  let random = 17;
  const noise = () => {
    random = (random * 16807) % 2147483647;
    return (random / 2147483647) * 2 - 1;
  };
  for (let note = 0; note < 64; note++) {
    const frequency =
      notes[note % notes.length] * (note >= 32 && note < 48 ? 4 / 3 : 1);
    const period = Math.round(sampleRate / frequency);
    const ring = Float32Array.from({ length: period }, noise);
    const offset = Math.round(note * 0.375 * sampleRate);
    for (let i = 0; i < sampleRate * 1.4 && offset + i < samples.length; i++) {
      const p = i % period;
      const value = ring[p];
      ring[p] = (value + ring[(p + 1) % period]) * 0.493;
      samples[offset + i] += value * 0.48 * Math.min(1, i / 24);
    }
  }
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const string = (offset, text) =>
    [...text].forEach((char, i) =>
      view.setUint8(offset + i, char.charCodeAt(0)),
    );
  string(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  string(8, "WAVE");
  string(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  string(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((n, i) =>
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, n)) * 32767, true),
  );
  return {
    url: URL.createObjectURL(new Blob([buffer], { type: "audio/wav" })),
    peaks: peaksFrom(samples),
    duration,
  };
}
export function peaksFrom(data, count = 240) {
  const block = Math.max(1, Math.floor(data.length / count));
  const values = Array.from({ length: count }, (_, i) => {
    let peak = 0;
    for (let j = i * block; j < Math.min(data.length, (i + 1) * block); j++)
      peak = Math.max(peak, Math.abs(data[j]));
    return peak;
  });
  const max = Math.max(...values, 0.01);
  return values.map((p) => p / max);
}
let youtubePromise;
export function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubePromise)
    youtubePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timeout = setTimeout(() => {
        youtubePromise = null;
        script.remove();
        reject(
          new Error(
            "YouTube took too long to connect. Check your connection and try again.",
          ),
        );
      }, 15000);
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timeout);
        resolve(window.YT);
      };
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => {
        clearTimeout(timeout);
        youtubePromise = null;
        script.remove();
        reject(
          new Error(
            "Could not connect to YouTube. Check your connection and try again.",
          ),
        );
      };
      document.head.appendChild(script);
    });
  return youtubePromise;
}
