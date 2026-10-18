import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkCatalog, importBundle } from "../scripts/recordings.mjs";
import { validateCatalog } from "../src/training/catalog.js";

const sample = {
  id: "forward-g",
  kind: "roll",
  title: "Forward in G",
  roll: "Forward roll",
  key: "G",
  chord: "I",
  bpm: 80,
  duration: 1,
  src: "audio/forward.wav",
};
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "slowfolk-catalog-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    path.join(root, "catalog.json"),
    JSON.stringify({ version: 1, recordings: [] }),
  );
  return root;
}
test("site catalog rejects invalid labels, duplicate IDs, and nonlocal paths", () => {
  assert.equal(
    validateCatalog({ version: 1, recordings: [sample] }).recordings.length,
    1,
  );
  for (const src of [
    "https://example.com/clip.wav",
    "../clip.wav",
    "audio/../../clip.wav",
    "audio/test.exe",
    "audio/%2e%2e/clip.wav",
  ])
    assert.throws(() =>
      validateCatalog({ version: 1, recordings: [{ ...sample, src }] }),
    );
  assert.throws(() =>
    validateCatalog({ version: 1, recordings: [sample, sample] }),
  );
  assert.throws(() =>
    validateCatalog({ version: 1, recordings: [{ ...sample, key: "Q" }] }),
  );
});
test("import extracts audio and updates an additive static catalog idempotently", async (t) => {
  const root = await fixture(t),
    bundle = path.join(root, "bundle.json");
  const bytes = Buffer.from("RIFF-example-recording-bytes");
  const item = {
    ...sample,
    fileName: "forward.wav",
    audioBase64: bytes.toString("base64"),
  };
  await writeFile(bundle, JSON.stringify({ version: 1, recordings: [item] }));
  assert.equal(await importBundle(bundle, root), 1);
  const catalog = await checkCatalog(root);
  assert.equal(catalog.recordings.length, 1);
  assert.match(
    catalog.recordings[0].src,
    /^audio\/forward-g-[a-f0-9]{16}\.wav$/,
  );
  assert.deepEqual(
    await readFile(path.join(root, catalog.recordings[0].src)),
    bytes,
  );
  assert.equal(catalog.recordings[0].audioBase64, undefined);
  await importBundle(bundle, root);
  assert.equal((await checkCatalog(root)).recordings.length, 1);
  await writeFile(
    bundle,
    JSON.stringify({
      version: 1,
      recordings: [{ ...item, id: "backward-g", roll: "Backward roll" }],
    }),
  );
  await importBundle(bundle, root);
  assert.equal((await checkCatalog(root)).recordings.length, 2);
});
test("invalid imports do not modify the catalog or partially write audio", async (t) => {
  const root = await fixture(t),
    bundle = path.join(root, "bundle.json");
  const before = await readFile(path.join(root, "catalog.json"), "utf8");
  await writeFile(
    bundle,
    JSON.stringify({
      version: 1,
      recordings: [
        { ...sample, fileName: "clip.wav", audioBase64: "YWJj" },
        { ...sample, id: "bad", audioBase64: "%%%" },
      ],
    }),
  );
  await assert.rejects(importBundle(bundle, root));
  assert.equal(await readFile(path.join(root, "catalog.json"), "utf8"), before);
  assert.equal((await readdir(root)).includes("audio"), false);
});
test("build validation fails when a catalog audio file is missing or empty", async (t) => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, "catalog.json"),
    JSON.stringify({ version: 1, recordings: [sample] }),
  );
  await assert.rejects(checkCatalog(root));
  await mkdir(path.join(root, "audio"));
  await writeFile(path.join(root, "audio/forward.wav"), "");
  await assert.rejects(checkCatalog(root));
});
