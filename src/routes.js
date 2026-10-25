export function parseRoute(pathname) {
  if (pathname === "/") return { view: "practice" };
  if (/^\/saved\/?$/.test(pathname)) return { view: "saved" };
  if (/^\/training\/?$/.test(pathname)) return { view: "training" };
  const match = pathname.match(/^\/pr\/([a-zA-Z0-9_-]{11})(?:\/([^/]+))?\/?$/);
  if (match) {
    try {
      const phraseId = match[2] ? decodeURIComponent(match[2]) : null;
      if (phraseId && (phraseId.length > 128 || /[\x00-\x1f/]/.test(phraseId)))
        return { view: "practice", error: true };
      return { view: "practice", videoId: match[1], phraseId };
    } catch {
      /* Malformed URL encoding is an invalid route. */
    }
  }
  return { view: "practice", error: true };
}

export function practicePath(source, phraseId) {
  if (source?.kind !== "youtube") return "/";
  return `/pr/${source.videoId}${phraseId ? `/${encodeURIComponent(phraseId)}` : ""}`;
}
