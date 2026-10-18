import { validateSampleMetadata } from "./model.js";

export const AUDIO_PATH =
  /^audio\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(mp3|wav|m4a|ogg|flac|webm|mp4|aac|oga)$/i;
export function validateCatalog(catalog) {
  if (catalog?.version !== 1 || !Array.isArray(catalog.recordings))
    throw new Error(
      "The recording catalog must have version 1 and a recordings list.",
    );
  const ids = new Set();
  for (const sample of catalog.recordings) {
    const invalid = validateSampleMetadata(sample);
    if (invalid)
      throw new Error(
        `Invalid recording ${sample?.id || "(unknown)"}: ${invalid}`,
      );
    if (
      typeof sample.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(sample.id) ||
      ids.has(sample.id)
    )
      throw new Error(
        "Each site recording needs a unique ID using letters, numbers, underscores, or hyphens.",
      );
    if (!AUDIO_PATH.test(sample.src || ""))
      throw new Error(
        `Invalid audio path for ${sample.id}. Use audio/filename with a supported audio extension.`,
      );
    ids.add(sample.id);
  }
  return catalog;
}

export async function loadCatalog(signal) {
  const root = `${import.meta.env.BASE_URL}recordings/`;
  const response = await fetch(`${root}catalog.json`, {
    signal,
    cache: "no-cache",
  });
  if (!response.ok)
    throw new Error(
      `The site recording catalog could not load (${response.status}). Please try again.`,
    );
  let catalog;
  try {
    catalog = validateCatalog(await response.json());
  } catch {
    throw new Error(
      "The site recording catalog is invalid. Its files need to be checked before publishing.",
    );
  }
  return catalog.recordings.map((sample) => ({
    ...sample,
    published: true,
    audioUrl: `${root}${sample.src}`,
  }));
}

export async function exportDrafts(samples) {
  if (!samples.length) return;
  // One portable authoring file. The importer extracts ordinary static audio assets.
  const recordings = [];
  for (const sample of samples) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(sample.audio);
    });
    const { audio, ...metadata } = sample;
    recordings.push({
      ...metadata,
      mimeType: audio.type,
      audioBase64: dataUrl.slice(dataUrl.indexOf(",") + 1),
    });
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ version: 1, recordings })], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "slowfolk-recordings.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
