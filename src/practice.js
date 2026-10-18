export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export function formatTime(value, precise = false) {
  const raw = Math.max(0, Number(value) || 0);
  const tenths = Math.round(raw * 10);
  const n = precise ? tenths / 10 : raw;
  return `${Math.floor(n / 60)}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}${precise ? `.${tenths % 10}` : ""}`;
}
export function parseTime(value) {
  value = value.trim();
  if (!/^\d+(?::[0-5]\d)?(?:\.\d+)?$/.test(value.trim())) return null;
  const parts = value.split(":").map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
}
export function youtubeId(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    let id;
    if (host === "youtu.be") id = url.pathname.split("/")[1];
    else if (
      ["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)
    ) {
      id =
        url.pathname === "/watch"
          ? url.searchParams.get("v")
          : /^\/(shorts|embed|live)\//.test(url.pathname)
            ? url.pathname.split("/")[2]
            : null;
    }
    return /^[\w-]{11}$/.test(id || "") ? id : null;
  } catch {
    return null;
  }
}
export function loopBounds(start, end, duration) {
  const minimum = Math.min(0.3, duration);
  const a = clamp(start, 0, Math.max(0, duration - minimum));
  return [a, clamp(end, a + minimum, duration)];
}
export function shouldRepeat(position, end, enabled, phase) {
  return enabled && phase === "playing" && position >= end;
}
export function readSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem("slowfolk-loops") || "[]");
    return Array.isArray(saved)
      ? saved
          .filter(
            (x) =>
              x &&
              typeof x.id === "string" &&
              typeof x.name === "string" &&
              typeof x.sourceKey === "string" &&
              ["demo", "file", "youtube"].includes(x.kind) &&
              (x.kind !== "youtube" || /^[\w-]{11}$/.test(x.videoId)) &&
              Number.isFinite(x.start) &&
              Number.isFinite(x.end) &&
              x.end > x.start &&
              x.start >= 0,
          )
          .map((x) => ({
            ...x,
            speed: [0.25, 0.5, 0.75, 1].includes(x.speed) ? x.speed : 0.75,
            gap: Number.isFinite(x.gap) ? clamp(x.gap, 0, 60) : 3,
          }))
      : [];
  } catch {
    return [];
  }
}
