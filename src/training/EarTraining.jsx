import { newId } from "../id";
import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Check,
  Headphones,
  Library,
  LoaderCircle,
  Music2,
  Play,
  Repeat,
  RotateCcw,
  Square,
  Trophy,
} from "lucide-react";
import RecordingLibrary from "./RecordingLibrary";
import {
  buildRound,
  CHORDS,
  DEGREES,
  eligibleSamples,
  gradeAnswer,
  KEYS,
  MODES,
  readiness,
  sampleAnswer,
  SCALES,
} from "./model";
import { listRecordings } from "./storage";
import { useAccount, usePreference } from "../account/AccountProvider";
import useListening from "./useListening";
import { loadCatalog } from "./catalog";

function AnswerChoices({ legend, options, value, onChange, disabled }) {
  return (
    <fieldset className="answer-choices" disabled={disabled}>
      <legend>{legend}</legend>
      <div>
        {options.map((option) => (
          <label
            key={option.value}
            className={
              value === option.value
                ? "answer-choice selected"
                : "answer-choice"
            }
          >
            <input
              type="radio"
              name={legend}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
            {value === option.value && <Check size={15} />}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function EarTraining() {
  const account = useAccount();
  const history = account.scores;
  const [tab, setTab] = useState("play"),
    [drafts, setDrafts] = useState([]),
    [published, setPublished] = useState([]),
    [previewDrafts, setPreviewDrafts] = useState(false),
    [localError, setLocalError] = useState("");
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [reload, setReload] = useState(0);
  const [mode, setMode] = usePreference("mode"),
    [key, setKey] = usePreference("key"),
    [tempo, setTempo] = usePreference("tempo"),
    [answerStyle, setAnswerStyle] = usePreference("answerStyle"),
    [length, setLength] = usePreference("length");
  const [session, setSession] = useState(null),
    [notice, setNotice] = useState(""),
    [loopRecording, setLoopRecording] = useState(false);
  const listening = useListening({
    loop: loopRecording && tab === "play" && !!session && !session.complete,
  });
  const completing = useRef(false),
    focusRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    const controller = new AbortController();
    setLocalError("");
    Promise.allSettled([loadCatalog(controller.signal), listRecordings()]).then(
      ([catalog, recordings]) => {
        if (cancelled) return;
        if (catalog.status === "fulfilled") setPublished(catalog.value);
        else
          setLoadError(
            catalog.reason.message ||
              "The site recording catalog could not load. Please try again.",
          );
        if (recordings.status === "fulfilled") setDrafts(recordings.value);
        if (recordings.status === "rejected")
          setLocalError(
            "Browser storage is unavailable. Site recordings still work, but local drafts and personal scores may not be saved.",
          );
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reload]);
  useEffect(() => {
    if (session) focusRef.current?.focus();
  }, [session?.id, session?.index, session?.complete]);
  const samples = previewDrafts
    ? [
        ...published.filter(
          (sample) => !drafts.some((draft) => draft.id === sample.id),
        ),
        ...drafts,
      ]
    : published;
  const pool = eligibleSamples(
    samples,
    mode,
    key,
    mode === "notes" ? "all" : tempo,
  );
  const unavailable = readiness(pool, mode);
  const totalAnswers = history.reduce((sum, r) => sum + r.total, 0),
    totalCorrect = history.reduce((sum, r) => sum + r.correct, 0);
  const begin = (deck = null, previous = null) => {
    listening.stop();
    setNotice("");
    completing.current = false;
    const selectedMode = previous?.mode || mode;
    setSession({
      id: newId(),
      mode: selectedMode,
      answerStyle: previous?.answerStyle || answerStyle,
      deck: deck || buildRound(pool, mode, length),
      rolls:
        previous?.rolls ||
        [...new Set(pool.map((s) => s.roll).filter(Boolean))].sort(),
      index: 0,
      answer: {},
      feedback: null,
      heard: false,
      results: [],
      complete: false,
    });
  };
  const question = session?.deck[session.index];
  const hear = async () => {
    const id = session.id,
      index = session.index;
    const success = await listening.play(question);
    if (success)
      setSession((s) =>
        s?.id === id && s.index === index ? { ...s, heard: true } : s,
      );
  };
  const choose = (field, value) =>
    setSession((s) =>
      s.feedback ? s : { ...s, answer: { ...s.answer, [field]: value } },
    );
  const submit = (event) => {
    event.preventDefault();
    if (!session.heard || session.feedback) return;
    const complete =
      session.mode === "notes"
        ? !!session.answer.degree
        : !!session.answer.roll &&
          (session.mode !== "harmony" || !!session.answer.chord);
    if (!complete) return;
    listening.stop();
    const feedback = gradeAnswer(question, session.mode, session.answer);
    setSession((s) => ({
      ...s,
      feedback,
      results: [
        ...s.results,
        { sampleId: question.id, answer: { ...s.answer }, ...feedback },
      ],
    }));
  };
  const next = async () => {
    if (!session.feedback || completing.current) return;
    listening.stop();
    if (session.index < session.deck.length - 1) {
      setSession((s) => ({
        ...s,
        index: s.index + 1,
        answer: {},
        feedback: null,
        heard: false,
      }));
      return;
    }
    completing.current = true;
    const result = {
      id: session.id,
      mode: session.mode,
      total: session.results.length,
      correct: session.results.filter((r) => r.correct).length,
      finishedAt: Date.now(),
    };
    setSession((s) => ({ ...s, complete: true }));
    try {
      await account.save("scores", result);
    } catch {
      setNotice(
        "Your round is complete, but its score could not be saved. Please check your connection or browser storage.",
      );
    }
  };
  const leave = () => {
    listening.stop();
    setSession(null);
    setNotice("");
  };
  const canSubmit =
    session?.heard &&
    (session.mode === "notes"
      ? !!session.answer.degree
      : !!session.answer.roll &&
        (session.mode !== "harmony" || !!session.answer.chord));
  const missed = session?.complete
    ? session.deck.filter((_, i) => !session.results[i].correct)
    : [];
  return (
    <div className="ear-training">
      <div className="training-toolbar">
        <div className="training-tabs" aria-label="Ear training sections">
          <button
            aria-pressed={tab === "play"}
            onClick={() => {
              listening.stop();
              setTab("play");
            }}
          >
            <Headphones size={16} />
            Play by ear
          </button>
          <button
            disabled={!!session && !session.complete}
            aria-pressed={tab === "library"}
            onClick={() => {
              leave();
              setTab("library");
            }}
          >
            <Library size={16} />
            Recording library<span>{published.length}</span>
          </button>
        </div>
        <span className="training-local">
          Recordings included with the site
        </span>
      </div>
      {localError && (
        <p className="training-error" role="status">
          {localError}
        </p>
      )}
      {loading ? (
        <div className="card training-loading" role="status">
          <LoaderCircle size={20} className="spin" />
          Opening your listening library…
        </div>
      ) : loadError ? (
        <section className="card training-loading">
          <p className="training-error" role="alert">
            {loadError}
          </p>
          <button
            className="secondary-button"
            onClick={() => setReload((n) => n + 1)}
          >
            Try again
          </button>
        </section>
      ) : tab === "library" ? (
        <RecordingLibrary
          samples={drafts}
          setSamples={setDrafts}
          published={published}
        />
      ) : session ? (
        <>
          {session.complete ? (
            <section className="card round-summary">
              <span className="training-medallion">
                <Trophy size={30} />
              </span>
              <span className="eyebrow small">ROUND COMPLETE</span>
              <h2 ref={focusRef} tabIndex={-1}>
                {session.results.filter((r) => r.correct).length} out of{" "}
                {session.deck.length}. Keep listening.
              </h2>
              <p className="training-copy">
                {missed.length
                  ? "The tricky ones are where your ears grow. Give them another listen."
                  : "Every phrase found its place. Try another key or a faster recording next."}
              </p>
              <div className="training-form-actions">
                <button
                  className="primary"
                  onClick={() => {
                    leave();
                  }}
                >
                  <ArrowRight size={16} />
                  Choose another round
                </button>
                {missed.length > 0 && (
                  <button
                    className="secondary-button"
                    onClick={() => begin(missed, session)}
                  >
                    <RotateCcw size={16} />
                    Practice missed questions
                  </button>
                )}
              </div>
              <div className="round-review">
                <h3>Your listening notes</h3>
                {session.deck.map((sample, i) => (
                  <div key={`${sample.id}-${i}`}>
                    <span
                      className={
                        session.results[i].correct
                          ? "review-correct"
                          : "review-missed"
                      }
                    >
                      {session.results[i].correct ? "✓" : "↻"}
                    </span>
                    <div>
                      <strong>{sampleAnswer(sample, session.mode)}</strong>
                      <small>
                        {sample.title} · {sample.key} major
                        {!session.results[i].correct
                          ? ` · You chose: ${session.mode === "notes" ? session.results[i].answer.degree : [session.results[i].answer.roll, session.results[i].answer.chord].filter(Boolean).join(" · ")}`
                          : ""}
                      </small>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Replay question ${i + 1}`}
                      onClick={() => listening.play(sample)}
                    >
                      <Play size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="card question-card">
              <div className="question-topline">
                <span>{MODES[session.mode].name}</span>
                <span>
                  Question {session.index + 1} of {session.deck.length}
                </span>
                <button className="text-button" onClick={leave}>
                  End round
                </button>
              </div>
              <progress
                max={session.deck.length}
                value={session.index}
                aria-label="Round progress"
              />
              <div className="question-heading">
                <span className="training-medallion">
                  <AudioLines size={32} />
                </span>
                <h2 ref={focusRef} tabIndex={-1}>
                  {session.mode === "notes"
                    ? "Where does this note belong?"
                    : session.mode === "harmony"
                      ? "Which roll? Which chord?"
                      : "What’s that roll?"}
                </h2>
                <p className="training-copy">
                  {session.mode === "rolls" ? (
                    "Listen for the picking pattern. Replay as often as you like."
                  ) : (
                    <>
                      Key: <strong>{question.key} major</strong>. Hear the
                      tonic, then listen to the recording.
                    </>
                  )}
                </p>
              </div>
              <div className="question-listen">
                <button
                  className="primary"
                  onClick={() =>
                    listening.playing ? listening.stop() : hear()
                  }
                >
                  {listening.playing ? (
                    <Square size={17} />
                  ) : (
                    <Play size={17} />
                  )}{" "}
                  {listening.playing
                    ? "Stop recording"
                    : session.heard
                      ? "Listen again"
                      : "Listen to recording"}
                </button>
                <button
                  className="secondary-button recording-loop"
                  aria-label="Loop recording"
                  aria-pressed={loopRecording}
                  onClick={() => setLoopRecording((enabled) => !enabled)}
                >
                  <Repeat size={16} />
                  Loop {loopRecording ? "on" : "off"}
                </button>
                {session.mode !== "rolls" && (
                  <button
                    className="secondary-button"
                    onClick={() => listening.tonic(question.key)}
                  >
                    <Music2 size={16} />
                    Hear tonic ({question.key})
                  </button>
                )}
              </div>
              {session.mode !== "rolls" && (
                <p className="reference-caption">
                  Tonic reference is a generated tone, not a banjo recording.
                  Octave doesn’t affect your answer.
                </p>
              )}
              <form className="question-form" onSubmit={submit}>
                {session.mode === "notes" ? (
                  <AnswerChoices
                    legend={
                      session.answerStyle === "names"
                        ? "Name the note"
                        : "Choose the scale degree"
                    }
                    value={session.answer.degree}
                    onChange={(v) => choose("degree", v)}
                    disabled={!session.heard || !!session.feedback}
                    options={DEGREES.map((degree, i) => ({
                      value: degree,
                      label:
                        session.answerStyle === "names"
                          ? SCALES[question.key][i]
                          : degree === "1"
                            ? "1 · tonic"
                            : degree,
                    }))}
                  />
                ) : (
                  <>
                    <AnswerChoices
                      legend="Name the roll"
                      value={session.answer.roll}
                      onChange={(v) => choose("roll", v)}
                      disabled={!session.heard || !!session.feedback}
                      options={session.rolls.map((roll) => ({
                        value: roll,
                        label: roll,
                      }))}
                    />
                    {session.mode === "harmony" && (
                      <AnswerChoices
                        legend="Choose the chord relative to the key"
                        value={session.answer.chord}
                        onChange={(v) => choose("chord", v)}
                        disabled={!session.heard || !!session.feedback}
                        options={CHORDS.map((chord) => ({
                          value: chord,
                          label: chord,
                        }))}
                      />
                    )}
                  </>
                )}
                {!session.heard && (
                  <p className="training-copy listen-first">
                    Listen once to unlock the answers.
                  </p>
                )}
                {session.feedback ? (
                  <div
                    className={
                      "answer-feedback " +
                      (session.feedback.correct ? "correct" : "incorrect")
                    }
                    role="status"
                  >
                    <strong>
                      {session.feedback.correct
                        ? "You’ve got it."
                        : "Keep this sound in mind."}
                    </strong>
                    <p>The answer: {sampleAnswer(question, session.mode)}.</p>
                    {session.mode === "harmony" &&
                      !session.feedback.correct && (
                        <p>
                          {session.feedback.rollCorrect
                            ? "You identified the roll correctly."
                            : "The roll needs another listen."}{" "}
                          {session.feedback.chordCorrect
                            ? "You identified the chord correctly."
                            : "Listen to how the chord relates to the tonic."}
                        </p>
                      )}
                    <small>
                      {question.key} major
                      {question.bpm ? ` · ${question.bpm} BPM` : ""} ·{" "}
                      {question.title}
                    </small>
                    <button className="primary" type="button" onClick={next}>
                      {session.index === session.deck.length - 1
                        ? "See results"
                        : "Next question"}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="primary check-answer"
                    type="submit"
                    disabled={!canSubmit}
                  >
                    <Check size={16} />
                    Check answer
                  </button>
                )}
              </form>
            </section>
          )}
          {(notice || listening.error) && (
            <p className="training-error" role="status">
              {notice || listening.error}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="training-intro">
            <span className="eyebrow small">
              LISTEN. RECOGNIZE. MAKE IT YOURS.
            </span>
            <p>
              Pick a challenge, put the labels away, and let your ears lead.
            </p>
          </div>
          {drafts.length > 0 && (
            <label className="draft-preview-toggle">
              <input
                type="checkbox"
                checked={previewDrafts}
                onChange={(event) => setPreviewDrafts(event.target.checked)}
              />{" "}
              Preview my local drafts in games{" "}
              <span>Not part of the published site</span>
            </label>
          )}
          <div className="game-mode-grid">
            {Object.entries(MODES).map(([id, item]) => (
              <button
                key={id}
                className={"card game-mode " + (mode === id ? "chosen" : "")}
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
              >
                <span className="mode-icon">
                  {id === "rolls" ? (
                    <AudioLines size={24} />
                  ) : id === "harmony" ? (
                    <Music2 size={24} />
                  ) : (
                    <Headphones size={24} />
                  )}
                </span>
                <span className="mode-level">
                  {id === "rolls"
                    ? "PATTERN RECOGNITION"
                    : id === "harmony"
                      ? "THE NEXT CHALLENGE"
                      : "RELATIVE PITCH"}
                </span>
                <strong>{item.name}</strong>
                <span className="mode-description">{item.description}</span>
                <span className="mode-footer">
                  {eligibleSamples(samples, id).length} recordings{" "}
                  <span>
                    {mode === id ? (
                      <Check size={16} />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="training-setup-grid">
            <section className="card round-setup">
              <div className="training-section-title">
                <h2>Make it your kind of practice.</h2>
                <span className="outline-tag">{MODES[mode].name}</span>
              </div>
              <div className="training-fields">
                <label className="training-field">
                  Practice key
                  <select value={key} onChange={(e) => setKey(e.target.value)}>
                    <option value="all">Mix all keys</option>
                    {KEYS.map((k) => (
                      <option value={k} key={k}>
                        {k} major
                      </option>
                    ))}
                  </select>
                </label>
                {mode !== "notes" ? (
                  <label className="training-field">
                    Recorded tempo
                    <select
                      value={tempo}
                      onChange={(e) => setTempo(e.target.value)}
                    >
                      <option value="all">
                        All speeds (including unlabeled)
                      </option>
                      <option value="slow">Slow · under 90 BPM</option>
                      <option value="medium">Steady · 90–129 BPM</option>
                      <option value="fast">Fast · 130+ BPM</option>
                    </select>
                  </label>
                ) : (
                  <label className="training-field">
                    Answer with
                    <select
                      value={answerStyle}
                      onChange={(e) => setAnswerStyle(e.target.value)}
                    >
                      <option value="degrees">Scale degrees · 1, 2, 3…</option>
                      <option value="names">Note names · G, A, B…</option>
                    </select>
                  </label>
                )}
                <label className="training-field">
                  Round length
                  <select
                    value={length}
                    onChange={(e) => setLength(Number(e.target.value))}
                  >
                    {[5, 10, 20].map((n) => (
                      <option key={n} value={n}>
                        {n} questions
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="training-copy">
                {pool.length} matching recordings.{" "}
                {pool.length < length
                  ? "Short libraries repeat takes across the round."
                  : "Each round mixes your takes."}{" "}
                {mode === "harmony"
                  ? "Both the roll and chord must be right to earn a point."
                  : ""}
              </p>
              {unavailable && (
                <div className="training-empty-callout">
                  <Headphones size={20} />
                  <div>
                    <strong>{unavailable}</strong>
                    <p>
                      {mode === "harmony"
                        ? "Label each roll’s chord in the library. For a fair challenge, use the same rolls on different chords."
                        : "Use the site recording library, or broaden the key and tempo filters."}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => setTab("library")}
                    >
                      Open recording library
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}
              <button
                className="primary start-round"
                disabled={!!unavailable || !account.ready}
                onClick={() => begin()}
              >
                Start listening
                <ArrowRight size={17} />
              </button>
            </section>
            <aside className="card listening-progress">
              <span className="training-medallion">
                <Trophy size={22} />
              </span>
              <h2>A little practice adds up.</h2>
              <div className="training-stats">
                <div>
                  <strong>{history.length}</strong>
                  <span>rounds finished</span>
                </div>
                <div>
                  <strong>
                    {totalAnswers
                      ? `${Math.round((totalCorrect / totalAnswers) * 100)}%`
                      : "—"}
                  </strong>
                  <span>answers correct</span>
                </div>
              </div>
              <p>
                Your completed rounds are saved{" "}
                {account.user ? "to your account" : "in this browser"}. Replays
                are always welcome.
              </p>
              <div className="training-tip">
                <strong>Listen for the shape.</strong>
                <p>
                  For rolls, follow the repeating rhythm. For notes and chords,
                  hear the tonic first, then listen for how the sound relates to
                  it.
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
