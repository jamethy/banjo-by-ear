import { newId } from "../id";
import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  Headphones,
  LoaderCircle,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  CHORDS,
  DEGREES,
  KEYS,
  MAX_DURATION,
  MAX_FILE_BYTES,
  ROLLS,
  SCALES,
  validateSample,
} from "./model";
import { deleteRecording, inspectAudio, saveRecording } from "./storage";
import useListening from "./useListening";
import { exportDrafts } from "./catalog";
import SiteRecordings from "./SiteRecordings";

function Editor({ sample, onSaved, onClose, rollNames }) {
  const [draft, setDraft] = useState(
    sample || {
      kind: "roll",
      title: "",
      roll: ROLLS[0],
      key: "G",
      chord: "",
      degree: "1",
      bpm: "",
      audio: null,
      duration: 0,
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0),
    titleRef = useRef(null);
  const listening = useListening();
  useEffect(() => {
    titleRef.current?.focus();
    return () => {
      generation.current++;
    };
  }, []);
  const update = (field, value) => setDraft((d) => ({ ...d, [field]: value }));
  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const token = ++generation.current;
    listening.stop();
    setError("");
    setDraft((d) => ({
      ...d,
      audio: null,
      duration: 0,
      fileName: file.name,
      title: d.title || file.name.replace(/\.[^.]+$/, "").slice(0, 100),
    }));
    if (file.size > MAX_FILE_BYTES || !file.size) {
      setError("Choose a nonempty audio file smaller than 25 MB.");
      return;
    }
    setBusy(true);
    try {
      const duration = await inspectAudio(file);
      if (token !== generation.current) return;
      if (duration > MAX_DURATION)
        throw new Error(
          "Keep each recording to 90 seconds or less. One roll or one note is plenty.",
        );
      setDraft((d) => ({ ...d, audio: file, duration }));
    } catch (e) {
      if (token === generation.current) setError(e.message);
    } finally {
      if (token === generation.current) setBusy(false);
    }
  };
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    const next = {
      ...draft,
      title: draft.title.trim(),
      roll: (draft.roll || "").trim(),
      bpm: draft.bpm === "" ? "" : Number(draft.bpm),
      id: sample?.id || newId(),
      updatedAt: Date.now(),
    };
    const invalid = validateSample(next);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveRecording(next);
      listening.stop();
      onSaved(next);
    } catch {
      setError(
        "The recording could not be saved. Browser storage may be full or disabled. Your original file is unchanged.",
      );
      setBusy(false);
    }
  };
  return (
    <section
      className="card recording-editor"
      aria-label={sample ? "Edit recording" : "Add recording"}
    >
      <div className="training-section-title">
        <div>
          <span className="eyebrow small">BUILD YOUR LISTENING LIBRARY</span>
          <h2>
            {sample
              ? "Get the labels just right."
              : "Give your ears something to work with."}
          </h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close recording editor"
        >
          <X size={20} />
        </button>
      </div>
      <p className="training-copy">
        One roll or one note per clip. Add separate takes for different speeds,
        keys, and chords. Labels and filenames stay hidden during questions.
      </p>
      <form onSubmit={save}>
        <fieldset disabled={busy} className="training-fields">
          <label className="training-field">
            Recording title
            <input
              ref={titleRef}
              value={draft.title}
              required
              maxLength={100}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Forward roll, G, slow take"
            />
          </label>
          <label className="training-field">
            Recording type
            <select
              value={draft.kind}
              onChange={(e) => {
                listening.stop();
                update("kind", e.target.value);
              }}
            >
              <option value="roll">Banjo roll</option>
              <option value="note">Single note</option>
            </select>
          </label>
          <label className="training-field">
            Key (major)
            <select
              value={draft.key}
              onChange={(e) => update("key", e.target.value)}
            >
              {KEYS.map((key) => (
                <option key={key} value={key}>
                  {key} major
                </option>
              ))}
            </select>
          </label>
          {draft.kind === "roll" ? (
            <>
              <label className="training-field">
                Roll type
                <input
                  list="roll-types"
                  value={draft.roll}
                  required
                  maxLength={60}
                  onChange={(e) => update("roll", e.target.value)}
                />
                <datalist id="roll-types">
                  {rollNames.map((roll) => (
                    <option key={roll} value={roll} />
                  ))}
                </datalist>
              </label>
              <label className="training-field">
                Chord relative to key
                <select
                  value={draft.chord}
                  onChange={(e) => update("chord", e.target.value)}
                >
                  <option value="">Not labeled · roll-only game</option>
                  {CHORDS.map((chord, i) => (
                    <option key={chord} value={chord}>
                      {chord} · {SCALES[draft.key][i]}
                      {[1, 2, 5].includes(i)
                        ? " minor"
                        : i === 6
                          ? " diminished"
                          : " major"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="training-field">
                Tempo (BPM, optional)
                <input
                  type="number"
                  min="20"
                  max="400"
                  value={draft.bpm}
                  onChange={(e) => update("bpm", e.target.value)}
                  placeholder="e.g. 80"
                />
              </label>
            </>
          ) : (
            <label className="training-field">
              Correct note / scale degree
              <select
                value={draft.degree}
                onChange={(e) => update("degree", e.target.value)}
              >
                {DEGREES.map((degree, i) => (
                  <option value={degree} key={degree}>
                    {degree} · {SCALES[draft.key][i]}
                    {degree === "1" ? " (tonic)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="training-field recording-file">
            <span>
              <Upload size={16} />{" "}
              {sample ? "Replace audio (optional)" : "Audio recording"}
            </span>
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
              onChange={chooseFile}
            />
            <small>
              {draft.audio
                ? `${draft.fileName || "Stored recording"} · ${draft.duration.toFixed(1)} seconds`
                : "MP3, WAV, M4A, or another browser-supported format · up to 25 MB / 90 seconds"}
            </small>
          </label>
        </fieldset>
        {(error || listening.error) && (
          <p className="training-error" role="alert">
            {error || listening.error}
          </p>
        )}
        <div className="training-form-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={!draft.audio || busy}
            onClick={() =>
              listening.playing ? listening.stop() : listening.play(draft)
            }
          >
            {listening.playing ? <Square size={15} /> : <Play size={15} />}
            Preview recording
          </button>
          <button
            className="primary"
            type="submit"
            disabled={busy || !draft.audio}
          >
            {busy ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Check size={15} />
            )}
            Save draft
          </button>
        </div>
      </form>
    </section>
  );
}

export default function RecordingLibrary({ samples, setSamples, published }) {
  const [editor, setEditor] = useState(null),
    [filter, setFilter] = useState("all"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(null);
  const listening = useListening();
  const rolls = [
    ...new Set([
      ...ROLLS,
      ...samples.filter((s) => s.kind === "roll").map((s) => s.roll),
    ]),
  ];
  const shown = samples
    .filter((s) => filter === "all" || s.kind === filter)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const edit = (item) => {
    listening.stop();
    setEditor(item);
    setNotice("");
    setError("");
  };
  const remove = async (sample) => {
    setBusy(true);
    setError("");
    listening.stop();
    try {
      await deleteRecording(sample.id);
      setSamples((prev) => prev.filter((s) => s.id !== sample.id));
      setNotice("Recording removed from this browser.");
      setDeleting(null);
    } catch {
      setError("Could not remove the recording. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="recording-library">
      {!editor && (
        <SiteRecordings
          samples={published}
          listening={listening}
          preview={preview}
          setPreview={setPreview}
        />
      )}

      {editor && (
        <Editor
          key={editor.id || "new"}
          sample={editor.id ? editor : null}
          rollNames={rolls}
          onClose={() => setEditor(null)}
          onSaved={(sample) => {
            setSamples((prev) => [
              ...prev.filter((s) => s.id !== sample.id),
              sample,
            ]);
            setEditor(null);
            setNotice(
              "Draft saved in this browser. Export it to include it in the site.",
            );
          }}
        />
      )}
      <section className="card training-library-card">
        <div className="training-section-title">
          <div>
            <h2>Local recording drafts</h2>
            <p className="training-copy">
              {samples.length} {samples.length === 1 ? "clip" : "clips"} · audio
              and labels saved only in this browser · not site assets yet
            </p>
          </div>
          <button
            className="primary"
            disabled={!!editor}
            onClick={() => edit({})}
          >
            <Plus size={16} />
            Add draft recording
          </button>
        </div>
        <div className="draft-publishing">
          <p>
            To make drafts permanent, export them and add the bundle to the
            project before building the site.
          </p>
          <button
            className="secondary-button"
            disabled={!samples.length || busy || !!editor}
            onClick={async () => {
              setBusy(true);
              setError("");
              listening.stop();
              try {
                await exportDrafts(samples);
                setNotice(
                  "Bundle downloaded. Import it into the project, then build and deploy the site.",
                );
              } catch {
                setError("The bundle could not be exported. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Upload size={16} />
            Export draft bundle
          </button>
          <details>
            <summary>Site owner: make these recordings permanent</summary>
            <p>
              Run this from the project folder using your downloaded bundle:
            </p>
            <code>
              npm run recordings:import -- /path/to/slowfolk-recordings.json
            </code>
            <p>
              Then run <code>npm run build</code>. Deploy the contents of{" "}
              <code>dist/</code> together, including the recordings folder.
              Existing drafts are preserved until you remove them.
            </p>
          </details>
        </div>
        <div className="training-filter-tabs" aria-label="Filter recordings">
          {[
            ["all", "All recordings"],
            ["roll", "Rolls"],
            ["note", "Notes"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => {
                listening.stop();
                setFilter(value);
              }}
            >
              {label}
              <span>
                {
                  samples.filter((s) => value === "all" || s.kind === value)
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        {notice && (
          <p className="training-notice" role="status">
            {notice}
          </p>
        )}
        {(error || listening.error) && (
          <p className="training-error" role="alert">
            {error || listening.error}
          </p>
        )}
        {!shown.length ? (
          <div className="training-empty">
            <Headphones size={30} />
            <h3>
              {samples.length
                ? "No drafts in this category yet."
                : "Prepare the next set of recordings."}
            </h3>
            <p>
              Upload and label your clips here, then export a bundle for the
              site. Drafts are for preparation; they are not shared with
              visitors.
            </p>
            <p>
              For harder rounds, record each roll on several chords, such as I,
              IV, and V, in the same key.
            </p>
            {!editor && (
              <button className="secondary-button" onClick={() => edit({})}>
                <Upload size={16} />
                Add your first draft
              </button>
            )}
          </div>
        ) : (
          <div className="recording-list">
            {shown.map((sample) => (
              <article className="recording-row" key={sample.id}>
                <button
                  className="recording-preview"
                  aria-label={`Preview ${sample.title}`}
                  onClick={() => {
                    if (listening.playing && preview === sample.id)
                      listening.stop();
                    else {
                      setPreview(sample.id);
                      listening.play(sample);
                    }
                  }}
                >
                  {listening.playing && preview === sample.id ? (
                    <Square size={17} />
                  ) : (
                    <Play size={17} />
                  )}
                </button>
                <div className="recording-info">
                  <strong>{sample.title}</strong>
                  <span>
                    {sample.kind === "roll"
                      ? sample.roll
                      : `Note ${SCALES[sample.key][Number(sample.degree) - 1]} · degree ${sample.degree}`}{" "}
                    · {sample.key} major
                    {sample.kind === "roll" && sample.chord
                      ? ` · ${sample.chord}`
                      : ""}
                    {sample.bpm ? ` · ${sample.bpm} BPM` : ""} ·{" "}
                    {sample.duration.toFixed(1)}s
                  </span>
                  {sample.kind === "roll" && !sample.chord && (
                    <small>
                      Add a chord label to include this take in harder rounds.
                    </small>
                  )}
                </div>
                {deleting === sample.id ? (
                  <div className="delete-confirm">
                    <span>Delete this clip?</span>
                    <button disabled={busy} onClick={() => remove(sample)}>
                      Delete
                    </button>
                    <button disabled={busy} onClick={() => setDeleting(null)}>
                      Keep
                    </button>
                  </div>
                ) : (
                  <div className="recording-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${sample.title}`}
                      disabled={!!editor}
                      onClick={() => edit(sample)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Delete ${sample.title}`}
                      disabled={!!editor}
                      onClick={() => setDeleting(sample.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <p className="training-storage-note">
        Site recordings are permanent files included with the app. Drafts stay
        in this browser until you export and import them into the project. Keep
        your originals: clearing site data removes drafts, but not site assets.
      </p>
    </div>
  );
}
