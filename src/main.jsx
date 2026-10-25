import { newId } from "./id";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  AudioLines,
  Check,
  CircleHelp,
  Clock3,
  Headphones,
  Keyboard,
  Link2,
  ListMusic,
  LoaderCircle,
  Minus,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Upload,
  Volume2,
  X,
  Youtube,
} from "lucide-react";
import usePlayer from "./usePlayer";
import useLocation from "./useLocation";
import { practicePath } from "./routes";
import Modal from "./Modal";
import PhraseDialog from "./PhraseDialog";
import EarTraining from "./training/EarTraining";
import AccountProvider, {
  useAccount,
  usePreference,
} from "./account/AccountProvider";
import AccountControls, { AccountStatus } from "./account/AccountControls";
import { createDemo } from "./audio";
import {
  clamp,
  formatTime,
  groupPhrases,
  loopBounds,
  parseTime,
  youtubeId,
} from "./practice";
import "./styles.css";
import "./training/training.css";

function Banjo({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 180 230"
      fill="none"
      aria-hidden="true"
    >
      <g transform="rotate(27 90 115)">
        <path
          d="M82 132V22l-4-9 3-10h18l3 10-4 9v110"
          fill="#d7ae71"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M78 19h-8m30 0h9M78 31h-8m30 0h9"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle
          cx="90"
          cy="169"
          r="51"
          fill="#dcc8a5"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          cx="90"
          cy="169"
          r="44"
          fill="#f3e6ce"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          cx="90"
          cy="169"
          r="38"
          stroke="currentColor"
          strokeOpacity=".2"
        />
        <path
          d="M82 191h16M83 152h14M83 22h14M83 43h14M83 58h14M83 72h14M83 86h14M83 99h14M83 111h14"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M86 10v186m4-186v186m4-186v186"
          stroke="currentColor"
          strokeWidth=".75"
        />
        <path d="m83 207 3-13h8l3 13z" fill="currentColor" />
        {Array.from({ length: 12 }, (_, i) => (
          <circle
            key={i}
            cx={90 + 48 * Math.sin((i * Math.PI) / 6)}
            cy={169 + 48 * Math.cos((i * Math.PI) / 6)}
            r="2"
            fill="currentColor"
          />
        ))}
      </g>
    </svg>
  );
}
function TimeInput({ label, value, onChange, disabled }) {
  const [draft, setDraft] = useState(formatTime(value, true));
  useEffect(() => setDraft(formatTime(value, true)), [value]);
  const commit = () => {
    const time = parseTime(draft);
    setDraft(formatTime(value, true));
    if (time !== null) onChange(time);
  };
  return (
    <label className="time-field">
      <span>{label}</span>
      <input
        aria-label={label}
        disabled={disabled}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
function App() {
  const account = useAccount();
  const saved = account.loops;
  const [location, navigate] = useLocation();
  const handledLocation = useRef(null);
  const [routeNotice, setRouteNotice] = useState("");
  const [selectedPhrase, setSelectedPhrase] = useState(null);
  const [phraseName, setPhraseName] = useState("");
  const [phraseError, setPhraseError] = useState("");
  const phrasePanel = useRef(null);
  const writeLocation = (path, options) => {
    handledLocation.current = navigate(path, options);
    setRouteNotice("");
  };
  const [source, setSource] = useState(null),
    [title, setTitle] = useState("A little forward roll");
  const [start, setStart] = useState(3),
    [end, setEnd] = useState(9);
  const [loop, setLoop] = usePreference("loop");
  const [speed, setSpeed] = usePreference("speed"),
    [gap, setGap] = usePreference("gap"),
    [focus, setFocus] = usePreference("focus"),
    [volume, setVolume] = usePreference("volume");
  const [url, setUrl] = useState(""),
    [urlError, setUrlError] = useState("");
  const [modal, setModal] = useState(null),
    [loopName, setLoopName] = useState("");
  const [savingPhrase, setSavingPhrase] = useState(false);
  const [phraseAction, setPhraseAction] = useState(null);
  const [toast, setToast] = useState(""),
    [activeNav, setActiveNav] = useState("practice");
  const fileRef = useRef(null),
    waveformRef = useRef(null),
    sourceRef = useRef(null),
    restore = useRef(null),
    pendingFile = useRef(null),
    drag = useRef(null);
  const notify = (message) => setToast(message);
  const onDuration = (duration) => {
    const bounds = restore.current
      ? loopBounds(restore.current.start, restore.current.end, duration)
      : sourceRef.current?.kind === "demo"
        ? [3, 9]
        : [0, Math.min(8, duration)];
    setStart(bounds[0]);
    setEnd(bounds[1]);
    restore.current = null;
  };
  const player = usePlayer(source, {
    start,
    end,
    loop,
    speed,
    gap,
    focus,
    volume,
    onDuration,
    onTitle: setTitle,
    onSpeed: setSpeed,
  });
  const ready = !!source && !["loading", "error"].includes(player.phase),
    isYouTube = source?.kind === "youtube";
  const canSelect = ready && player.duration > 0;
  const active = ["playing", "waiting"].includes(player.phase);
  const sourceLoops = saved.filter((item) => item.sourceKey === source?.key);
  const setRecording = (recording) => {
    setSelectedPhrase(null);
    setPhraseName("");
    setPhraseError("");
    player.pause();
    if (sourceRef.current?.url) URL.revokeObjectURL(sourceRef.current.url);
    sourceRef.current = recording;
    setStart(0);
    setEnd(0);
    setSource(recording);
    setTitle(recording.title);
    setActiveNav("practice");
  };
  const demo = () => {
    const generated = createDemo();
    setRecording({
      ...generated,
      kind: "demo",
      key: "demo-forward-roll",
      attempt: Date.now(),
      title: "A little forward roll",
    });
  };
  useEffect(() => {
    return () => {
      if (sourceRef.current?.url) URL.revokeObjectURL(sourceRef.current.url);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const changeBounds = (a, b) => {
    if (!canSelect) return;
    const [nextStart, nextEnd] = loopBounds(a, b, player.duration);
    setStart(nextStart);
    setEnd(nextEnd);
    if (player.phase === "waiting") player.pause();
  };
  const loadUrl = (e) => {
    e.preventDefault();
    const id = youtubeId(url.trim());
    if (!id) {
      setUrlError(
        "Paste a valid YouTube video link, like youtube.com/watch?v=…",
      );
      return;
    }
    setUrlError("");
    openVideo(id);
  };
  const openVideo = (id, videoTitle = "Your YouTube tune", write = true) => {
    restore.current = null;
    setSelectedPhrase(null);
    setPhraseName("");
    setPhraseError("");
    setUrl(`https://www.youtube.com/watch?v=${id}`);
    if (source?.key === `youtube-${id}` && ready) {
      player.pause();
      setStart(0);
      setEnd(Math.min(8, player.duration));
      player.seek(0);
      setActiveNav("practice");
    } else
      setRecording({
        kind: "youtube",
        videoId: id,
        key: `youtube-${id}`,
        attempt: Date.now(),
        title: videoTitle,
      });
    if (write) writeLocation(`/pr/${id}`);
  };
  const upload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 150 * 1024 * 1024) {
      notify("Choose an audio file smaller than 150 MB.");
      return;
    }
    const fileKey = `file-${file.name}-${file.size}-${file.lastModified}`;
    const phrase =
      pendingFile.current?.sourceKey === fileKey ? pendingFile.current : null;
    restore.current = phrase;
    pendingFile.current = null;
    setRecording({
      kind: "file",
      key: `file-${file.name}-${file.size}-${file.lastModified}`,
      url: URL.createObjectURL(file),
      file,
      title: file.name.replace(/\.[^.]+$/, ""),
    });
    if (phrase) {
      setSelectedPhrase(phrase);
      setPhraseName(phrase.name);
    }
    writeLocation("/");
  };
  const savePhrase = async (e) => {
    e.preventDefault();
    if (!loopName.trim() || savingPhrase) return;
    const next = {
      id: newId(),
      name: loopName.trim(),
      sourceKey: source.key,
      kind: source.kind,
      videoId: source.videoId,
      title,
      start,
      end,
      speed,
      gap,
    };
    setSavingPhrase(true);
    try {
      await account.save("loops", next);
      setModal(null);
      setSelectedPhrase(next);
      setPhraseName(next.name);
      writeLocation(practicePath(source, next.id));
      notify("Phrase saved. Come back to it anytime.");
    } catch {
      notify("This phrase could not be saved. Please try again.");
    } finally {
      setSavingPhrase(false);
    }
  };
  const openPhrase = (item, { write = true, focusPanel = false } = {}) => {
    if (item.kind === "file" && source?.key !== item.sourceKey) {
      pendingFile.current = item;
      setSpeed(item.speed);
      setGap(item.gap);
      setLoop(true);
      notify(`Upload “${item.title}” again to use this phrase.`);
      fileRef.current.click();
      return;
    }
    player.pause();
    if (source?.key !== item.sourceKey) {
      restore.current = item;
      if (item.kind === "demo") demo();
      else
        setRecording({
          kind: "youtube",
          key: item.sourceKey,
          videoId: item.videoId,
          title: item.title,
        });
    } else if (canSelect) {
      restore.current = null;
      player.seek(item.start);
    } else restore.current = item;
    const bounds =
      source?.key === item.sourceKey && canSelect
        ? loopBounds(item.start, item.end, player.duration)
        : [item.start, item.end];
    setStart(bounds[0]);
    setEnd(bounds[1]);
    setSelectedPhrase(item);
    setPhraseName(item.name);
    setPhraseError("");
    setSpeed(item.speed);
    setGap(item.gap);
    setLoop(true);
    setActiveNav("practice");
    setModal(null);
    if (item.kind === "youtube")
      setUrl(`https://www.youtube.com/watch?v=${item.videoId}`);
    if (write) writeLocation(practicePath(item, item.id));
    if (focusPanel)
      requestAnimationFrame(() => {
        phrasePanel.current?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
        phrasePanel.current
          ?.querySelector("input")
          ?.focus({ preventScroll: true });
      });
  };
  const saveChanges = async () => {
    if (!selectedPhrase || savingPhrase || !canSelect || !account.ready) return;
    if (!phraseName.trim()) return setPhraseError("Give this phrase a name.");
    if (!saved.some((item) => item.id === selectedPhrase.id))
      return setPhraseError(
        "This phrase was deleted. Save it as a new phrase to keep these settings.",
      );
    const next = {
      ...selectedPhrase,
      name: phraseName.trim(),
      start,
      end,
      speed,
      gap,
    };
    setSavingPhrase(true);
    setPhraseError("");
    try {
      await account.save("loops", next);
      setSelectedPhrase(next);
      setPhraseName(next.name);
      notify("Phrase updated.");
    } catch {
      setPhraseError("Your changes could not be saved. Please try again.");
    } finally {
      setSavingPhrase(false);
    }
  };
  const phraseDirty =
    !!selectedPhrase &&
    (phraseName.trim() !== selectedPhrase.name ||
      start !== selectedPhrase.start ||
      end !== selectedPhrase.end ||
      speed !== selectedPhrase.speed ||
      gap !== selectedPhrase.gap);
  const showSection = (view) => {
    if (view !== "practice") player.pause();
    setActiveNav(view);
    writeLocation(
      view === "practice"
        ? practicePath(source, selectedPhrase?.id)
        : `/${view}`,
    );
  };
  // History navigation and initial loads resolve only after the user's library
  // is ready. Ordinary snapshot updates must not overwrite an in-progress edit.
  useEffect(() => {
    if (handledLocation.current === location) return;
    setModal(null);
    setPhraseAction(null);
    setRouteNotice("");
    setActiveNav(location.view);
    player.pause();
    if (location.view !== "practice") {
      if (!source) demo();
      setActiveNav(location.view);
      handledLocation.current = location;
      return;
    }
    if (location.error) {
      setRouteNotice(
        "This practice link is invalid. Open a YouTube video or choose a saved phrase.",
      );
      if (!source) demo();
      handledLocation.current = location;
      return;
    }
    if (!location.videoId) {
      if (!source || source.kind === "youtube") demo();
      handledLocation.current = location;
      return;
    }
    if (location.phraseId) {
      if (!account.ready) {
        if (source?.videoId !== location.videoId)
          openVideo(location.videoId, undefined, false);
        setRouteNotice("Opening your saved phrase…");
        return;
      }
      const item = saved.find(
        (item) =>
          item.id === location.phraseId &&
          item.kind === "youtube" &&
          item.videoId === location.videoId,
      );
      if (item) {
        openPhrase(item, { write: false });
        handledLocation.current = location;
      } else {
        if (source?.videoId !== location.videoId || selectedPhrase)
          openVideo(location.videoId, undefined, false);
        setRouteNotice(
          account.user
            ? "This phrase isn't in your account. It may have been deleted or saved under another account. You can still practice the video."
            : "This phrase isn't saved in this browser. Sign in to the account that saved it, or practice the video on its own.",
        );
      }
    } else {
      openVideo(location.videoId, undefined, false);
      handledLocation.current = location;
    }
  }, [location, account.ready, saved]);
  useEffect(() => {
    const keydown = (e) => {
      if (
        modal ||
        activeNav !== "practice" ||
        document.querySelector("dialog[open]") ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName) ||
        e.target.isContentEditable
      )
        return;
      if (e.key === "?") {
        setModal("shortcuts");
        return;
      }
      if (!ready) return;
      if (e.code === "Space") {
        e.preventDefault();
        player.toggle();
      }
      if (e.key.toLowerCase() === "l") setLoop((v) => !v);
      if (e.key.toLowerCase() === "r") player.seek(start);
      if (e.key === "[") changeBounds(player.position, end);
      if (e.key === "]") changeBounds(start, player.position);
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        player.seek(player.position + (e.key === "ArrowLeft" ? -1 : 1));
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });
  const pointerTime = (e) => {
    const box = waveformRef.current.getBoundingClientRect();
    return clamp((e.clientX - box.left) / box.width, 0, 1) * player.duration;
  };
  const pointerDown = (e) => {
    if (!canSelect) return;
    e.preventDefault();
    const edge = e.target.dataset.edge;
    const time = pointerTime(e);
    drag.current = {
      edge: edge || "selection",
      origin: time,
      x: e.clientX,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const pointerMove = (e) => {
    if (!drag.current) return;
    if (Math.abs(e.clientX - drag.current.x) > 4) drag.current.moved = true;
    const time = pointerTime(e),
      { edge, origin } = drag.current;
    if (edge === "start") changeBounds(Math.min(time, end - 0.3), end);
    else if (edge === "end") changeBounds(start, time);
    else if (drag.current.moved) {
      changeBounds(Math.min(origin, time), Math.max(origin, time));
      setLoop(true);
    }
  };
  const pointerUp = (e) => {
    if (drag.current?.edge === "selection" && !drag.current.moved)
      player.seek(pointerTime(e));
    drag.current = null;
  };
  const selectionStyle = {
    left: `${(start / (player.duration || 24)) * 100}%`,
    width: `${((end - start) / (player.duration || 24)) * 100}%`,
  };
  const phraseList = (items) =>
    items.length ? (
      items.map((item) => (
        <div
          className={`saved-item${selectedPhrase?.id === item.id ? " selected-phrase" : ""}`}
          key={item.id}
        >
          <button className="saved-open" onClick={() => openPhrase(item)}>
            <span className="saved-icon">
              <Repeat2 size={17} />
            </span>
            <span>
              <strong>{item.name}</strong>
              <small>
                {formatTime(item.start, true)} – {formatTime(item.end, true)} ·{" "}
                {item.speed}×
              </small>
            </span>
            <Play size={15} />
          </button>
          <button
            className="icon-button"
            aria-label={`Edit ${item.name}`}
            disabled={!account.ready}
            onClick={() => openPhrase(item, { focusPanel: true })}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-button delete"
            aria-label={`Delete ${item.name}`}
            disabled={!account.ready}
            onClick={() => setPhraseAction({ action: "delete", item })}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))
    ) : (
      <div className="empty-saved">
        <span className="empty-icon">
          <BookmarkIcon />
        </span>
        <p>A good phrase is worth keeping.</p>
        <small>Save a loop and make it your own.</small>
      </div>
    );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Slowfolk home">
          <span className="brand-mark">
            <Banjo />
          </span>
          slowfolk<span className="brand-period">.</span>
        </a>
        <div className="workspace-label">YOUR PRACTICE SPACE</div>
        <nav>
          <button
            className={
              activeNav === "practice" ? "nav-item selected" : "nav-item"
            }
            onClick={() => showSection("practice")}
          >
            <AudioLines size={19} />
            Practice room
            <span className="nav-dot" />
          </button>
          <button
            className={activeNav === "saved" ? "nav-item selected" : "nav-item"}
            onClick={() => {
              showSection("saved");
            }}
          >
            <ListMusic size={19} />
            Saved phrases<span className="nav-count">{saved.length}</span>
          </button>
          <button
            className={
              activeNav === "training" ? "nav-item selected" : "nav-item"
            }
            onClick={() => {
              showSection("training");
            }}
          >
            <Headphones size={19} />
            Ear training
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="daily-note">
            <span className="little-spark">✳</span>
            <p>
              A little slower.
              <br />A little closer.
            </p>
            <small>
              Good music takes its time.
              <br />
              So can you.
            </small>
          </div>
          <button
            className="nav-item help-link"
            onClick={() => setModal("guide")}
          >
            <CircleHelp size={18} />A quick field guide
            <ArrowRight size={15} />
          </button>
          <div className="sidebar-foot">
            <span className="green-dot" />
            Made for the love of picking
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            <span className="breadcrumb">Your workspace</span>
            <span className="slash">/</span>
            {activeNav === "training"
              ? "Ear training"
              : activeNav === "saved"
                ? "Saved phrases"
                : "Practice room"}
          </span>
          <div className="topbar-actions">
            {activeNav !== "training" && (
              <button
                className="shortcut-button"
                onClick={() => setModal("shortcuts")}
              >
                <Keyboard size={16} />
                <span>Keyboard shortcuts</span>
                <kbd>?</kbd>
              </button>
            )}
            <AccountControls />
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div className="eyebrow">
              <span />
              LESS RUSH. MORE MUSIC.
            </div>
            <h1>
              {activeNav === "training"
                ? "Let your ears lead."
                : activeNav === "saved"
                  ? "Keep the good bits."
                  : "Find your own rhythm."}
            </h1>
            <p>
              {activeNav === "training"
                ? "Know the roll. Hear the chord. Find the note."
                : activeNav === "saved"
                  ? "Your collection of phrases, ready for another listen."
                  : "Slow it down. Pick it out. Play it back."}
            </p>
            <div className="heading-doodle" aria-hidden="true">
              <svg viewBox="0 0 130 65">
                <path d="M3 35c20-40 14 40 32 0s17 40 33 0 15 40 31 0 17 26 27-7" />
                <path d="m105 8 5 9m10-8-3 8" />
              </svg>
            </div>
          </div>
          <AccountStatus />
          {routeNotice && (
            <p className="practice-route-notice" role="status">
              {routeNotice}
            </p>
          )}
          {activeNav === "training" && <EarTraining />}
          {activeNav === "saved" && (
            <section className="card library">
              <div className="section-heading">
                <h2>
                  <ListMusic size={20} />
                  Your saved phrases
                </h2>
                <span className="subtle">
                  {saved.length} {saved.length === 1 ? "phrase" : "phrases"}
                </span>
              </div>
              {saved.length
                ? groupPhrases(saved, account.links).map((group) => (
                    <section
                      className="phrase-group"
                      key={group.key}
                      aria-label={group.title}
                    >
                      <div className="phrase-group-heading">
                        {group.kind === "youtube" ? (
                          <Youtube size={20} />
                        ) : (
                          <Music2 size={20} />
                        )}
                        <div>
                          <h3>{group.title}</h3>
                          <p>
                            {group.kind === "youtube"
                              ? "YouTube"
                              : group.kind === "demo"
                                ? "Practice sample"
                                : "Uploaded recording"}{" "}
                            · {group.items.length}{" "}
                            {group.items.length === 1 ? "phrase" : "phrases"}
                          </p>
                        </div>
                      </div>
                      {phraseList(group.items)}
                    </section>
                  ))
                : phraseList([])}
              <p className="library-note">
                {account.user
                  ? "Saved to your account."
                  : "Saved in this browser."}{" "}
                For uploaded recordings, load the same file to revisit its
                phrases.
              </p>
            </section>
          )}
          {activeNav === "saved" && (
            <section className="card library saved-tunes">
              <div className="section-heading">
                <h2>
                  <Youtube size={20} /> Your saved tunes
                </h2>
                <span className="subtle">{account.links.length} tunes</span>
              </div>
              {account.links.length ? (
                account.links.map((item) => (
                  <div className="saved-item" key={item.id}>
                    <button
                      className="saved-open"
                      onClick={() => {
                        openVideo(item.id, item.title);
                      }}
                    >
                      <span className="saved-icon">
                        <Youtube size={18} />
                      </span>
                      <span>{item.title}</span>
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Delete tune ${item.title}`}
                      onClick={() =>
                        account
                          .remove("links", item.id)
                          .catch(() =>
                            notify(
                              "The tune could not be deleted. Please try again.",
                            ),
                          )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="library-note">
                  Load a YouTube tune and choose “Save tune” to keep its link
                  here.
                </p>
              )}
            </section>
          )}
          <div hidden={activeNav !== "practice"}>
            <section className="source-bar">
              <div className="source-label">
                <span className="source-icon">
                  <Youtube size={21} />
                </span>
                <div>
                  <strong>Bring a tune</strong>
                  <small>Start with a YouTube link</small>
                </div>
              </div>
              <form onSubmit={loadUrl} className="url-form">
                <div className={"url-input " + (urlError ? "invalid" : "")}>
                  <Link2 size={16} />
                  <input
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setUrlError("");
                    }}
                    placeholder="Paste a YouTube link…"
                    aria-label="YouTube video URL"
                    aria-describedby={urlError ? "url-error" : undefined}
                  />
                </div>
                <button className="primary load-button" type="submit">
                  Load tune
                  <ArrowRight size={16} />
                </button>
              </form>
              <span className="or">or</span>
              <button
                className="upload-button"
                onClick={() => fileRef.current.click()}
              >
                <Upload size={16} />
                Upload audio
              </button>
            </section>
            {urlError && (
              <p id="url-error" className="error-message" role="alert">
                {urlError}
              </p>
            )}
            <div className="practice-grid">
              <div className="main-column">
                <section className="card player-card">
                  <div className="track-heading">
                    <div>
                      <div className="eyebrow small">ON THE RECORD</div>
                      <h2>{title}</h2>
                      {isYouTube && (
                        <button
                          className="text-button save-tune"
                          disabled={
                            !account.ready ||
                            account.links.some(
                              (item) => item.id === source.videoId,
                            )
                          }
                          onClick={() =>
                            account
                              .save("links", { id: source.videoId, title })
                              .then(() => notify("Tune saved to your library."))
                              .catch(() =>
                                notify(
                                  "This tune could not be saved. Please try again.",
                                ),
                              )
                          }
                        >
                          <Plus size={15} />
                          {account.links.some(
                            (item) => item.id === source.videoId,
                          )
                            ? "Tune saved"
                            : "Save tune"}
                        </button>
                      )}
                      <p>
                        {isYouTube ? (
                          <>
                            <Youtube size={13} />
                            YouTube video
                          </>
                        ) : source?.kind === "file" ? (
                          <>
                            <Music2 size={13} />
                            Your recording · stays on your device
                          </>
                        ) : (
                          <>
                            <span className="sample-dot" />G major · Synthesized
                            practice sample
                          </>
                        )}
                      </p>
                    </div>
                    <span className="source-badge">
                      {isYouTube
                        ? "YOUTUBE"
                        : source?.kind === "file"
                          ? "LOCAL AUDIO"
                          : "TRY IT OUT"}
                    </span>
                  </div>
                  {isYouTube ? (
                    <div className="youtube-container">
                      <div id="youtube-host" />
                    </div>
                  ) : (
                    <div className="record-art">
                      <div className="art-text">
                        <span className="art-kicker">
                          THE SLOWFOLK SESSIONS
                        </span>
                        <h3>
                          {source?.kind === "file"
                            ? "Your tune."
                            : "Small steps."}
                          <br />
                          <em>
                            {source?.kind === "file"
                              ? "Your own pace."
                              : "Sweet sounds."}
                          </em>
                        </h3>
                        <span className="art-caption">
                          ONE PHRASE AT A TIME <span>↗</span>
                        </span>
                      </div>
                      <div className="art-circle" />
                      <div className="art-rings" />
                      <Banjo className="hero-banjo" />
                      <span className="art-star star-one">✳</span>
                      <span className="art-star star-two">✧</span>
                      <span className="art-edition">
                        VOL. 001 / KEEP ON PICKING
                      </span>
                    </div>
                  )}
                  {player.error && (
                    <div className="playback-error" role="alert">
                      <CircleHelp size={18} />
                      <span>{player.error}</span>
                    </div>
                  )}
                  <div className="timeline-section">
                    <div className="timeline-top">
                      <span>
                        <span className="tiny-square" />
                        {isYouTube ? "PHRASE TIMELINE" : "FIND YOUR PHRASE"}
                      </span>
                      <small>
                        {isYouTube && ready && !canSelect
                          ? "Press play to load the timeline"
                          : "Drag to select a section"}
                      </small>
                    </div>
                    <div
                      className={"waveform " + (loop ? "" : "loop-off")}
                      ref={waveformRef}
                      onPointerDown={pointerDown}
                      onPointerMove={pointerMove}
                      onPointerUp={pointerUp}
                      onPointerCancel={() => {
                        drag.current = null;
                      }}
                      aria-label="Audio timeline: drag to select a loop"
                    >
                      <div className="wave-bars" aria-hidden="true">
                        {(player.peaks.length
                          ? player.peaks
                          : Array.from({ length: 160 }, () => 0.22)
                        ).map((peak, i) => (
                          <i
                            key={i}
                            style={{ height: `${Math.max(7, peak * 81)}%` }}
                          />
                        ))}
                      </div>
                      <div className="selection" style={selectionStyle}>
                        <button
                          data-edge="start"
                          className="loop-handle start-handle"
                          aria-label="Loop start handle"
                          onKeyDown={(e) => {
                            if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                              e.preventDefault();
                              changeBounds(
                                start + (e.key === "ArrowRight" ? 0.1 : -0.1),
                                end,
                              );
                            }
                          }}
                        >
                          <span data-edge="start">A</span>
                        </button>
                        <button
                          data-edge="end"
                          className="loop-handle end-handle"
                          aria-label="Loop end handle"
                          onKeyDown={(e) => {
                            if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                              e.preventDefault();
                              changeBounds(
                                start,
                                end + (e.key === "ArrowRight" ? 0.1 : -0.1),
                              );
                            }
                          }}
                        >
                          <span data-edge="end">B</span>
                        </button>
                      </div>
                      <div
                        className="playhead"
                        style={{
                          left: `${(player.position / (player.duration || 24)) * 100}%`,
                        }}
                      >
                        <span />
                      </div>
                    </div>
                    <div className="timeline-ticks">
                      {Array.from({ length: 7 }, (_, i) => (
                        <span key={i}>
                          {formatTime(((player.duration || 24) * i) / 6)}
                        </span>
                      ))}
                    </div>
                    <div className="transport">
                      <div className="transport-left">
                        <button
                          className="icon-button"
                          aria-label="Return to loop start"
                          disabled={!ready}
                          onClick={() => player.seek(start)}
                        >
                          <RotateCcw size={19} />
                        </button>
                        <button
                          className="play-button"
                          aria-label={
                            active ? "Pause playback" : "Play recording"
                          }
                          disabled={!ready}
                          onClick={player.toggle}
                        >
                          {player.phase === "loading" ? (
                            <LoaderCircle className="spin" size={20} />
                          ) : active ? (
                            <Pause size={21} fill="currentColor" />
                          ) : (
                            <Play size={21} fill="currentColor" />
                          )}
                        </button>
                        <span className="time-display">
                          {formatTime(player.position)}{" "}
                          <span>/ {formatTime(player.duration)}</span>
                        </span>
                      </div>
                      <div className="transport-right">
                        <button
                          className={"loop-button " + (loop ? "enabled" : "")}
                          onClick={() => setLoop((v) => !v)}
                          aria-pressed={loop}
                        >
                          <Repeat2 size={17} />
                          <span>Loop {loop ? "on" : "off"}</span>
                        </button>
                        <label className="volume">
                          <Volume2 size={17} />
                          <input
                            aria-label="Volume"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => setVolume(+e.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div
                    className={
                      "practice-status " +
                      (player.phase === "waiting" ? "your-turn" : "")
                    }
                    aria-live="polite"
                  >
                    <span className="status-icon">
                      {player.phase === "waiting" ? (
                        <Music2 size={17} />
                      ) : (
                        <Headphones size={17} />
                      )}
                    </span>
                    <span>
                      {player.phase === "waiting" ? (
                        <>
                          <strong>Your turn to pick.</strong> Playing again in{" "}
                          {Math.ceil(player.remaining)}s
                        </>
                      ) : player.phase === "playing" ? (
                        <>
                          <strong>Listen for the little details.</strong>{" "}
                          {loop
                            ? "Your turn is coming up."
                            : "Let the tune play."}
                        </>
                      ) : (
                        <>
                          <strong>Make room for your own playing.</strong>{" "}
                          {gap > 0
                            ? `A ${gap}s breather between every loop.`
                            : "The phrase will repeat without a pause."}
                        </>
                      )}
                    </span>
                    {player.repeats > 0 && (
                      <span className="repeat-count">
                        {player.repeats}{" "}
                        {player.repeats === 1 ? "repeat" : "repeats"}
                      </span>
                    )}
                  </div>
                </section>
                <section className="card focus-card">
                  <div className="focus-heading">
                    <span className="focus-icon">
                      <SlidersHorizontal size={20} />
                    </span>
                    <div>
                      <h2>Bring the banjo forward</h2>
                      <p>A little less rumble. A little more ring.</p>
                    </div>
                    <span className="outline-tag">BANJO FOCUS</span>
                  </div>
                  {isYouTube ? (
                    <div className="focus-unavailable">
                      <p>
                        YouTube supports looping and speed changes. To reduce
                        low-end sound and bring out the picking, upload an audio
                        recording.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => fileRef.current.click()}
                      >
                        Upload audio <ArrowRight size={15} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="focus-control">
                        <span>Original</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={focus}
                          aria-label="Banjo focus"
                          onChange={(e) => setFocus(+e.target.value)}
                        />
                        <span>More banjo</span>
                        <strong>{focus}%</strong>
                      </div>
                      <p className="fine-print">
                        <CircleHelp size={12} />
                        Focus shapes the EQ; it doesn’t separate instruments
                        from the mix.
                      </p>
                    </>
                  )}
                </section>
              </div>
              <div className="settings-column">
                <section
                  className="card loop-settings"
                  ref={phrasePanel}
                  aria-label="Phrase settings"
                >
                  <div className="section-heading">
                    <h2>
                      <Repeat2 size={18} />
                      Make it a loop
                    </h2>
                    <span className="step-label">A → B</span>
                  </div>
                  {selectedPhrase && (
                    <div className="selected-phrase-editor">
                      <label
                        className="dialog-label"
                        htmlFor="selected-phrase-name"
                      >
                        Phrase name
                      </label>
                      <input
                        id="selected-phrase-name"
                        className="dialog-input"
                        value={phraseName}
                        maxLength={200}
                        onChange={(event) => setPhraseName(event.target.value)}
                      />
                      <p className="setting-note">
                        {phraseDirty ? "Unsaved changes" : "Saved phrase"}
                      </p>
                    </div>
                  )}
                  <div className="loop-times">
                    <TimeInput
                      label="START · A"
                      value={start}
                      disabled={!canSelect}
                      onChange={(v) => changeBounds(v, end)}
                    />
                    <span className="time-dash">—</span>
                    <TimeInput
                      label="END · B"
                      value={end}
                      disabled={!canSelect}
                      onChange={(v) => changeBounds(start, v)}
                    />
                  </div>
                  <div className="selection-duration">
                    {(end - start).toFixed(1)} seconds of good practice
                  </div>
                  <div className="setting-divider" />
                  <div className="setting-label">
                    <label htmlFor="speed">Playback speed</label>
                    <span>{speed.toFixed(2).replace(/0$/, "")}×</span>
                  </div>
                  <div className="speed-options" id="speed">
                    {[0.25, 0.5, 0.75, 1].map((n) => (
                      <button
                        disabled={!ready || !player.rates.includes(n)}
                        key={n}
                        className={speed === n ? "chosen" : ""}
                        onClick={() => setSpeed(n)}
                      >
                        {n === 1 ? "1×" : `${n}×`}
                      </button>
                    ))}
                  </div>
                  <p className="setting-note">
                    <Check size={12} />
                    Original pitch, just a little slower
                  </p>
                  <div className="setting-divider" />
                  <div className="setting-label">
                    <label htmlFor="gap">Your turn between loops</label>
                    <Clock3 size={15} />
                  </div>
                  <div className="gap-control">
                    <button
                      aria-label="Shorten pause"
                      disabled={gap === 0}
                      onClick={() => setGap((v) => Math.max(0, v - 1))}
                    >
                      <Minus size={16} />
                    </button>
                    <div>
                      <input
                        id="gap"
                        aria-label="Pause between loops in seconds"
                        type="number"
                        min="0"
                        max="60"
                        value={gap}
                        onChange={(e) =>
                          setGap(clamp(Number(e.target.value), 0, 60))
                        }
                      />
                      <span>seconds</span>
                    </div>
                    <button
                      aria-label="Lengthen pause"
                      disabled={gap === 60}
                      onClick={() => setGap((v) => Math.min(60, v + 1))}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <p className="setting-note">
                    Listen. Have a go. Do it again.
                  </p>
                  {selectedPhrase && (
                    <div className="phrase-save-actions">
                      {phraseError && (
                        <p className="phrase-dialog-error" role="alert">
                          {phraseError}
                        </p>
                      )}
                      <button
                        className="primary"
                        onClick={saveChanges}
                        disabled={
                          !phraseDirty ||
                          !canSelect ||
                          !account.ready ||
                          savingPhrase ||
                          !phraseName.trim()
                        }
                      >
                        <Check size={16} />{" "}
                        {savingPhrase ? "Saving…" : "Save changes"}
                      </button>
                      <button
                        className="text-button"
                        disabled={!phraseDirty || savingPhrase}
                        onClick={() =>
                          openPhrase(
                            saved.find(
                              (item) => item.id === selectedPhrase.id,
                            ) || selectedPhrase,
                          )
                        }
                      >
                        Discard changes
                      </button>
                    </div>
                  )}
                  <button
                    className="save-button"
                    disabled={!canSelect || !account.ready}
                    onClick={() => {
                      setLoopName(
                        selectedPhrase
                          ? `${phraseName.trim()} (copy)`
                          : `Phrase ${sourceLoops.length + 1}`,
                      );
                      setModal("save");
                    }}
                  >
                    <Plus size={16} />
                    {selectedPhrase ? "Save as new phrase" : "Save this phrase"}
                  </button>
                </section>
                <section className="card saved-card">
                  <div className="section-heading">
                    <h2>Your phrases</h2>
                    <span className="count-badge">{sourceLoops.length}</span>
                  </div>
                  {phraseList(sourceLoops)}
                </section>
                <div className="practice-tip">
                  <span>✧</span>
                  <div>
                    <strong>One small phrase at a time.</strong>
                    <p>
                      Try 2–4 seconds. Listen until you can hum it, then let
                      your fingers find it.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bottom-note">
              <span>
                <Headphones size={14} />A good pair of headphones goes a long
                way.
              </span>
              <button onClick={() => setModal("guide")}>
                A few tips for learning by ear
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <footer>
            <span>Made for the moments when it finally clicks.</span>
            <span>
              SLOWFOLK <span className="footer-star">✳</span> TAKE YOUR TIME
            </span>
          </footer>
        </main>
      </div>
      <audio ref={player.audioRef} preload="auto" />
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
        hidden
        onChange={upload}
      />
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {phraseAction && (
        <PhraseDialog
          key={`${phraseAction.action}-${phraseAction.item.id}`}
          {...phraseAction}
          account={account}
          close={() => setPhraseAction(null)}
          onDeleted={() => {
            if (selectedPhrase?.id === phraseAction.item.id) {
              setSelectedPhrase(null);
              setPhraseName("");
              setPhraseError("");
              if (activeNav === "practice")
                writeLocation(practicePath(source), { replace: true });
            }
          }}
        />
      )}
      {modal === "save" && (
        <Modal title="Keep this little phrase" close={() => setModal(null)}>
          <p className="modal-copy">
            {formatTime(start, true)} – {formatTime(end, true)} from {title}
          </p>
          <form onSubmit={savePhrase}>
            <label className="dialog-label" htmlFor="phrase-name">
              Phrase name
            </label>
            <input
              id="phrase-name"
              autoFocus
              className="dialog-input"
              value={loopName}
              maxLength={80}
              required
              onChange={(e) => setLoopName(e.target.value)}
            />
            <button
              className="primary modal-submit"
              type="submit"
              disabled={savingPhrase || !account.ready}
            >
              {savingPhrase ? "Saving…" : "Save phrase"}
              <Check size={16} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "shortcuts" && (
        <Modal
          title="Less clicking. More picking."
          close={() => setModal(null)}
        >
          <p className="modal-copy">
            Use these while the practice page is focused.
          </p>
          <div className="shortcut-list">
            {[
              ["Space", "Play / pause"],
              ["R", "Return to phrase start"],
              ["L", "Turn looping on / off"],
              ["[", "Set start at playhead"],
              ["]", "Set end at playhead"],
              ["← / →", "Seek backward / forward 1 second"],
            ].map(([key, text]) => (
              <div key={key}>
                <span>{text}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <p className="fine-print">
            Click outside the YouTube video first to use these shortcuts.
          </p>
        </Modal>
      )}
      {modal === "guide" && (
        <Modal title="A little field guide" close={() => setModal(null)}>
          <div className="guide-list">
            <div>
              <span>01</span>
              <p>
                <strong>Bring something you love.</strong>Paste a YouTube video
                link, or upload an audio file from your device.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Find a small phrase.</strong>Drag across the timeline to
                select a few seconds. Move A and B to get the edges just right.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Listen, then answer.</strong>Try half speed and give
                yourself a few seconds between loops. Hum the notes, then find
                them on your banjo.
              </p>
            </div>
            <div>
              <span>04</span>
              <p>
                <strong>Clear a little space.</strong>For uploaded audio, Banjo
                Focus reduces bass and boosts picking detail. It’s an EQ, not
                instrument isolation. YouTube audio can’t be filtered here.
              </p>
            </div>
          </div>
          <button
            className="primary modal-submit"
            onClick={() => setModal(null)}
          >
            Let’s make some music
            <ArrowRight size={16} />
          </button>
          <button
            className="text-button demo-link"
            onClick={() => {
              restore.current = null;
              demo();
              writeLocation("/");
              setModal(null);
            }}
          >
            Try the built-in practice sample
          </button>
        </Modal>
      )}
    </div>
  );
}
function BookmarkIcon() {
  return (
    <svg width="21" height="24" viewBox="0 0 21 24" fill="none">
      <path
        d="M5 3h11a1 1 0 0 1 1 1v17l-6.5-4L4 21V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M8 8h5m-5 4h5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
createRoot(document.getElementById("root")).render(
  <AccountProvider>
    <App />
  </AccountProvider>,
);
