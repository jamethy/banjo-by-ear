import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  setLogLevel,
} from "firebase/firestore";

let environment;
before(async () => {
  setLogLevel("silent"); // Permission-denied writes below are expected assertions.
  environment = await initializeTestEnvironment({
    projectId: "demo-slowfolk",
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
});
after(async () => environment?.cleanup());
const loop = {
  id: "phrase",
  name: "Forward roll",
  sourceKey: "demo-forward-roll",
  kind: "demo",
  title: "Demo",
  start: 3,
  end: 9,
  speed: 0.5,
  gap: 3,
};
const score = {
  id: "round",
  mode: "rolls",
  correct: 4,
  total: 5,
  finishedAt: 1700000000000,
};

test("each user's collections are private, including queries and deletes", async () => {
  const alice = environment.authenticatedContext("alice").firestore();
  const bob = environment.authenticatedContext("bob").firestore();
  const guest = environment.unauthenticatedContext().firestore();
  for (const [kind, id, data] of [
    ["loops", "phrase", loop],
    ["links", "dQw4w9WgXcQ", { id: "dQw4w9WgXcQ", title: "Banjo" }],
    ["scores", "round", score],
    ["settings", "preferences", { speed: 0.5 }],
  ]) {
    const path = `users/alice/${kind}/${id}`;
    await assertSucceeds(setDoc(doc(alice, path), data));
    await assertSucceeds(getDoc(doc(alice, path)));
    if (kind !== "settings")
      await assertSucceeds(getDocs(collection(alice, `users/alice/${kind}`)));
    else await assertFails(getDocs(collection(alice, "users/alice/settings")));
    for (const outsider of [bob, guest]) {
      await assertFails(getDoc(doc(outsider, path)));
      await assertFails(getDocs(collection(outsider, `users/alice/${kind}`)));
      await assertFails(setDoc(doc(outsider, path), data));
      await assertFails(deleteDoc(doc(outsider, path)));
    }
    await assertSucceeds(deleteDoc(doc(alice, path)));
  }
  await assertFails(getDocs(collection(alice, "users")));
  await assertFails(
    setDoc(doc(alice, "users/alice/unknown/stuff"), { value: true }),
  );
});

test("loop rules reject invalid bounds, unexpected fields and unsafe links", async () => {
  const db = environment.authenticatedContext("alice").firestore();
  const ref = doc(db, "users/alice/loops/phrase");
  for (const patch of [
    { start: -1 },
    { end: 2 },
    { speed: 4 },
    { gap: 61 },
    { id: "other" },
    { audio: "blob:data" },
    { name: "" },
    { kind: "youtube", videoId: "bad" },
    { start: "3" },
    { title: "x".repeat(1001) },
  ]) {
    await assertFails(setDoc(ref, { ...loop, ...patch }));
  }
  await assertSucceeds(
    setDoc(ref, { ...loop, kind: "youtube", videoId: "dQw4w9WgXcQ" }),
  );
  await assertFails(
    setDoc(doc(db, "users/alice/links/invalid"), {
      id: "invalid",
      title: "No",
    }),
  );
});

test("settings enforce supported controls and merge individual changes", async () => {
  const db = environment.authenticatedContext("alice").firestore();
  const ref = doc(db, "users/alice/settings/preferences");
  await assertSucceeds(setDoc(ref, { speed: 0.75, key: "F♯", mode: "notes" }));
  await assertSucceeds(
    setDoc(ref, { gap: 6, volume: 0.4, loop: false }, { merge: true }),
  );
  for (const data of [
    { gap: -1 },
    { focus: 101 },
    { speed: 2 },
    { volume: 2 },
    { loop: "yes" },
    { key: "H" },
    { length: 100 },
    { mode: "fake" },
    { tempo: "fake" },
    { answerStyle: "fake" },
    { admin: true },
  ]) {
    await assertFails(setDoc(ref, data, { merge: true }));
  }
});

test("completed scores validate totals and only allow identical re-imports", async () => {
  const db = environment.authenticatedContext("alice").firestore();
  const ref = doc(db, "users/alice/scores/round");
  for (const patch of [
    { total: 0 },
    { total: 21 },
    { total: 5.5 },
    { correct: 6 },
    { correct: -1 },
    { correct: 2.5 },
    { finishedAt: -1 },
    { mode: "fake" },
    { privateAudio: true },
  ]) {
    await assertFails(setDoc(ref, { ...score, ...patch }));
  }
  await assertSucceeds(setDoc(ref, score));
  await assertSucceeds(setDoc(ref, score));
  await assertFails(setDoc(ref, { ...score, correct: 5 }));
});
