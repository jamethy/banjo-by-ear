export const ROLLS = [
  "Forward roll",
  "Backward roll",
  "Forward-backward roll",
  "Alternating thumb roll",
  "Foggy Mountain roll",
];
export const CHORDS = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
export const DEGREES = ["1", "2", "3", "4", "5", "6", "7"];
export const SCALES = {
  C: ["C", "D", "E", "F", "G", "A", "B"],
  "D♭": ["D♭", "E♭", "F", "G♭", "A♭", "B♭", "C"],
  D: ["D", "E", "F♯", "G", "A", "B", "C♯"],
  "E♭": ["E♭", "F", "G", "A♭", "B♭", "C", "D"],
  E: ["E", "F♯", "G♯", "A", "B", "C♯", "D♯"],
  F: ["F", "G", "A", "B♭", "C", "D", "E"],
  "F♯": ["F♯", "G♯", "A♯", "B", "C♯", "D♯", "E♯"],
  G: ["G", "A", "B", "C", "D", "E", "F♯"],
  "A♭": ["A♭", "B♭", "C", "D♭", "E♭", "F", "G"],
  A: ["A", "B", "C♯", "D", "E", "F♯", "G♯"],
  "B♭": ["B♭", "C", "D", "E♭", "F", "G", "A"],
  B: ["B", "C♯", "D♯", "E", "F♯", "G♯", "A♯"],
};
export const KEYS = Object.keys(SCALES);
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_DURATION = 90;
export const MODES = {
  rolls: {
    name: "Name that roll",
    description: "Hear the pattern. Name the roll.",
    kind: "roll",
  },
  harmony: {
    name: "Roll + chord",
    description: "Identify the roll and its chord: I, IV, V, and more.",
    kind: "roll",
  },
  notes: {
    name: "Find the note",
    description: "Hear one note in the context of a key.",
    kind: "note",
  },
};
export function noteName(sample) {
  return SCALES[sample.key]?.[Number(sample.degree) - 1] || "";
}
export function sampleAnswer(sample, mode) {
  return mode === "notes"
    ? `${sample.degree} (${noteName(sample)})`
    : mode === "harmony"
      ? `${sample.roll} · ${sample.chord}`
      : sample.roll;
}
export function validateSampleMetadata(sample) {
  if (!sample || typeof sample !== "object")
    return "Invalid recording metadata.";
  if (!["roll", "note"].includes(sample.kind))
    return "Choose a roll or single-note recording.";
  if (
    typeof sample.title !== "string" ||
    !sample.title.trim() ||
    sample.title.length > 100
  )
    return "Give the recording a title of 1–100 characters.";
  if (!KEYS.includes(sample.key)) return "Choose a supported major key.";
  if (
    sample.kind === "roll" &&
    (typeof sample.roll !== "string" ||
      !sample.roll.trim() ||
      sample.roll.trim().length > 60)
  )
    return "Name the roll (up to 60 characters).";
  if (sample.kind === "roll" && sample.chord && !CHORDS.includes(sample.chord))
    return "Choose a chord relative to the key.";
  if (sample.kind === "note" && !DEGREES.includes(sample.degree))
    return "Choose the note’s scale degree.";
  if (
    sample.bpm !== "" &&
    sample.bpm !== null &&
    sample.bpm !== undefined &&
    (!Number.isFinite(Number(sample.bpm)) ||
      Number(sample.bpm) < 20 ||
      Number(sample.bpm) > 400)
  )
    return "Tempo must be between 20 and 400 BPM, or left blank.";
  if (
    !Number.isFinite(sample.duration) ||
    sample.duration <= 0 ||
    sample.duration > MAX_DURATION
  )
    return "Use a recording up to 90 seconds long.";
  return null;
}
export function validateSample(sample) {
  const invalid = validateSampleMetadata(sample);
  if (invalid) return invalid;
  if (
    !(sample.audio instanceof Blob) ||
    !sample.audio.size ||
    sample.audio.size > MAX_FILE_BYTES
  )
    return "Choose an audio recording smaller than 25 MB.";
  return null;
}
export function eligibleSamples(samples, mode, key = "all", tempo = "all") {
  return samples.filter(
    (sample) =>
      sample.kind === MODES[mode].kind &&
      (mode !== "harmony" || CHORDS.includes(sample.chord)) &&
      (key === "all" || sample.key === key) &&
      (tempo === "all" ||
        (sample.bpm &&
          (tempo === "slow"
            ? sample.bpm < 90
            : tempo === "medium"
              ? sample.bpm >= 90 && sample.bpm < 130
              : sample.bpm >= 130))),
  );
}
export function readiness(samples, mode) {
  if (samples.length < 2)
    return "Add at least two matching recordings to start a round.";
  if (
    new Set(samples.map((s) => (mode === "notes" ? s.degree : s.roll))).size < 2
  )
    return mode === "notes"
      ? "Add recordings of at least two different scale degrees."
      : "Add recordings of at least two different roll types.";
  if (mode === "harmony" && new Set(samples.map((s) => s.chord)).size < 2)
    return "Add recordings on at least two different chords for this challenge.";
  return "";
}
export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
// Balance answer categories so a roll with many takes does not dominate a round.
export function buildRound(samples, mode, count, random = Math.random) {
  if (!samples.length || count < 1) return [];
  const groups = new Map();
  for (const sample of samples) {
    const answer =
      mode === "notes"
        ? sample.degree
        : mode === "harmony"
          ? `${sample.roll}|${sample.chord}`
          : sample.roll;
    if (!groups.has(answer)) groups.set(answer, []);
    groups.get(answer).push(sample);
  }
  const queues = new Map();
  const categories = [...groups.keys()];
  const schedule = shuffle(
    Array.from({ length: count }, (_, i) => categories[i % categories.length]),
    random,
  );
  const round = [];
  for (const category of schedule) {
    let queue = queues.get(category);
    if (!queue?.length) queue = shuffle(groups.get(category), random);
    if (queue[0]?.id === round.at(-1)?.id && queue.length > 1)
      queue.push(queue.shift());
    round.push(queue.shift());
    queues.set(category, queue);
  }
  return round;
}

export function gradeAnswer(sample, mode, answer) {
  const rollCorrect = mode === "notes" || answer.roll === sample.roll;
  const chordCorrect = mode !== "harmony" || answer.chord === sample.chord;
  const noteCorrect = mode !== "notes" || answer.degree === sample.degree;
  return {
    correct: rollCorrect && chordCorrect && noteCorrect,
    rollCorrect,
    chordCorrect,
    noteCorrect,
  };
}
