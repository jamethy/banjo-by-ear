import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRound,
  eligibleSamples,
  gradeAnswer,
  noteName,
  readiness,
  SCALES,
  validateSample,
} from "../src/training/model.js";

const roll = {
  id: "forward",
  kind: "roll",
  title: "A forward roll",
  roll: "Forward roll",
  key: "G",
  chord: "I",
  bpm: 80,
  audio: new Blob(["test"]),
  duration: 2,
};
const backward = {
  ...roll,
  id: "backward",
  roll: "Backward roll",
  chord: "V",
  bpm: 140,
};
const note = { ...roll, id: "note", kind: "note", degree: "3" };

test("key-relative notes retain correct major scale spelling", () => {
  assert.equal(noteName(note), "B");
  assert.equal(noteName({ key: "F", degree: "4" }), "B♭");
  assert.equal(noteName({ key: "F♯", degree: "7" }), "E♯");
  assert.equal(Object.keys(SCALES).length, 12);
});
test("recording validation rejects missing labels, invalid files, and long clips", () => {
  assert.equal(validateSample(roll), null);
  assert.equal(validateSample(note), null);
  for (const update of [
    { key: "Q" },
    { roll: "" },
    { audio: null },
    { duration: 91 },
    { bpm: 0 },
  ])
    assert.ok(validateSample({ ...roll, ...update }));
  assert.ok(validateSample({ ...note, degree: "8" }));
  assert.equal(validateSample({ ...roll, chord: "", bpm: "" }), null);
});
test("hard mode uses only labeled chords; tempo filters exclude unlabeled takes", () => {
  const samples = [
    roll,
    backward,
    { ...roll, id: "unlabeled", chord: "", bpm: "" },
    note,
  ];
  assert.equal(eligibleSamples(samples, "rolls").length, 3);
  assert.deepEqual(eligibleSamples(samples, "harmony"), [roll, backward]);
  assert.deepEqual(eligibleSamples(samples, "rolls", "G", "slow"), [roll]);
  assert.deepEqual(eligibleSamples(samples, "notes"), [note]);
  assert.equal(eligibleSamples(samples, "notes", "C").length, 0);
});
test("rounds require actual contrasting answers, not multiple copies of one take", () => {
  assert.ok(readiness([roll, { ...roll, id: "other" }], "rolls"));
  assert.ok(readiness([roll, { ...backward, chord: "I" }], "harmony"));
  assert.equal(readiness([roll, backward], "harmony"), "");
  assert.ok(readiness([note, { ...note, id: "other-key", key: "A" }], "notes"));
});
test("round generation balances categories, varies takes, and preserves inputs", () => {
  const samples = [
    roll,
    { ...roll, id: "forward2" },
    { ...roll, id: "forward3" },
    backward,
  ];
  const deck = buildRound(samples, "rolls", 20, () => 0.25);
  assert.equal(deck.length, 20);
  assert.equal(deck.filter((s) => s.roll === "Forward roll").length, 10);
  assert.equal(
    new Set(deck.filter((s) => s.roll === "Forward roll").map((s) => s.id))
      .size,
    3,
  );
  for (let i = 1; i < deck.length; i++) {
    if (deck[i].roll === "Forward roll")
      assert.notEqual(deck[i].id, deck[i - 1].id);
  }
  assert.ok(
    deck.some((sample, i) => i > 0 && sample.roll === deck[i - 1].roll),
    "Two answer categories must not force a predictable alternating pattern",
  );
  assert.equal(samples.length, 4);
  assert.deepEqual(buildRound([], "rolls", 10), []);
});
test("advanced grading requires both roll and chord and provides partial feedback", () => {
  assert.equal(
    gradeAnswer(roll, "rolls", { roll: "Forward roll" }).correct,
    true,
  );
  const partial = gradeAnswer(roll, "harmony", {
    roll: "Forward roll",
    chord: "V",
  });
  assert.equal(partial.correct, false);
  assert.equal(partial.rollCorrect, true);
  assert.equal(partial.chordCorrect, false);
  assert.equal(
    gradeAnswer(roll, "harmony", { roll: "Forward roll", chord: "I" }).correct,
    true,
  );
  assert.equal(gradeAnswer(note, "notes", { degree: "3" }).correct, true);
  assert.equal(gradeAnswer(note, "notes", { degree: "5" }).correct, false);
});
