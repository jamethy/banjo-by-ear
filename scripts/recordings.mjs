import { createHash, randomUUID } from "node:crypto";
import {
  readFile,
  writeFile,
  mkdir,
  rename,
  stat,
  realpath,
} from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { validateCatalog } from "../src/training/catalog.js";
import {
  MAX_FILE_BYTES,
  validateSampleMetadata,
} from "../src/training/model.js";

export const assetRoot = fileURLToPath(
  new URL("../public/recordings/", import.meta.url),
);
const extensions = new Set([
  "mp3",
  "wav",
  "m4a",
  "ogg",
  "flac",
  "webm",
  "mp4",
  "aac",
  "oga",
]);
const mimeExtensions = {
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/webm": "webm",
  "audio/aac": "aac",
};
export async function checkCatalog(root = assetRoot) {
  const catalog = validateCatalog(
    JSON.parse(await readFile(path.join(root, "catalog.json"), "utf8")),
  );
  const actualRoot = await realpath(root);
  for (const sample of catalog.recordings) {
    const file = path.join(root, sample.src);
    const actualFile = await realpath(file);
    if (!actualFile.startsWith(actualRoot + path.sep))
      throw new Error(
        `Audio must stay inside the recording folder: ${sample.id}`,
      );
    const info = await stat(file);
    if (!info.isFile() || !info.size || info.size > MAX_FILE_BYTES)
      throw new Error(`Missing, empty, or oversized audio for ${sample.id}.`);
  }
  return catalog;
}
export async function importBundle(bundlePath, root = assetRoot) {
  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  if (
    bundle?.version !== 1 ||
    !Array.isArray(bundle.recordings) ||
    !bundle.recordings.length
  )
    throw new Error("Choose a nonempty Slowfolk recording bundle (version 1).");
  const catalog = await checkCatalog(root);
  const ids = new Set();
  // Validate every item before writing any assets.
  const staged = bundle.recordings.map((sample) => {
    const invalid = validateSampleMetadata(sample);
    if (invalid) throw new Error(invalid);
    if (
      typeof sample.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(sample.id) ||
      ids.has(sample.id)
    )
      throw new Error(
        "Recording IDs must be unique and contain only letters, numbers, underscores, or hyphens.",
      );
    ids.add(sample.id);
    if (
      typeof sample.audioBase64 !== "string" ||
      sample.audioBase64.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 ||
      sample.audioBase64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(sample.audioBase64)
    )
      throw new Error(`Invalid or oversized audio data for ${sample.id}.`);
    const bytes = Buffer.from(sample.audioBase64, "base64");
    if (
      !bytes.length ||
      bytes.length > MAX_FILE_BYTES ||
      bytes.toString("base64") !== sample.audioBase64
    )
      throw new Error(`Invalid audio size for ${sample.id}.`);
    let extension = path
      .extname(sample.fileName || "")
      .slice(1)
      .toLowerCase();
    if (!extensions.has(extension)) extension = mimeExtensions[sample.mimeType];
    if (!extension)
      throw new Error(
        `Unknown audio format for ${sample.id}. Use a supported filename or MIME type.`,
      );
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const metadata = {
      id: sample.id,
      title: sample.title.trim(),
      kind: sample.kind,
      key: sample.key,
      duration: sample.duration,
      bpm: sample.bpm === "" || sample.bpm == null ? "" : Number(sample.bpm),
      src: `audio/${sample.id}-${hash}.${extension}`,
    };
    if (sample.kind === "roll") {
      metadata.roll = sample.roll.trim();
      metadata.chord = sample.chord || "";
    } else metadata.degree = sample.degree;
    return { bytes, metadata };
  });
  const merged = new Map(
    catalog.recordings.map((sample) => [sample.id, sample]),
  );
  for (const { metadata } of staged) merged.set(metadata.id, metadata);
  const next = validateCatalog({
    version: 1,
    recordings: [...merged.values()],
  });
  await mkdir(path.join(root, "audio"), { recursive: true });
  const actualRoot = await realpath(root);
  if (
    !(await realpath(path.join(root, "audio"))).startsWith(
      actualRoot + path.sep,
    )
  )
    throw new Error("The audio directory must be inside the recording folder.");
  for (const { bytes, metadata } of staged) {
    const file = path.join(root, metadata.src);
    try {
      await writeFile(file, bytes, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (
        !(await realpath(file)).startsWith(actualRoot + path.sep) ||
        !(await readFile(file)).equals(bytes)
      )
        throw new Error(
          `Refusing to overwrite unexpected asset ${metadata.src}.`,
        );
    }
  }
  const temporary = path.join(root, `catalog-${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(next, null, 2) + "\n");
  await rename(temporary, path.join(root, "catalog.json"));
  return staged.length;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    if (process.argv[2] === "check") {
      const catalog = await checkCatalog();
      console.log(
        `Recording catalog checked: ${catalog.recordings.length} site assets.`,
      );
    } else if (process.argv[2] === "import" && process.argv[3]) {
      const count = await importBundle(process.argv[3]);
      console.log(
        `Added or updated ${count} recordings in public/recordings/. Run npm run build to include them in the site.`,
      );
    } else
      throw new Error(
        "Usage: node scripts/recordings.mjs check | import /path/to/slowfolk-recordings.json",
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
