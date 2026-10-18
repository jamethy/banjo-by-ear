import { useEffect, useRef, useState } from "react";
import { loadYouTube, peaksFrom } from "./audio";
import { clamp, loopBounds, shouldRepeat } from "./practice";

export default function usePlayer(source, settings) {
  const audioRef = useRef(null),
    youtube = useRef(null),
    graph = useRef(null);
  const current = useRef(settings);
  current.current = settings;
  const [phase, setPhaseState] = useState("loading");
  const phaseRef = useRef("loading");
  const setPhase = (value) => {
    phaseRef.current = value;
    setPhaseState(value);
  };
  const [position, setPosition] = useState(0),
    [duration, setDuration] = useState(24);
  const [remaining, setRemaining] = useState(0),
    [repeats, setRepeats] = useState(0);
  const [error, setError] = useState(""),
    [peaks, setPeaks] = useState([]);
  const [rates, setRates] = useState([0.25, 0.5, 0.75, 1]);
  const deadline = useRef(0),
    durationRef = useRef(24);
  const rawPause = () =>
    source?.kind === "youtube"
      ? youtube.current?.pauseVideo?.()
      : audioRef.current?.pause();
  const rawSeek = (time) => {
    if (source?.kind === "youtube") youtube.current?.seekTo?.(time, true);
    else if (audioRef.current) audioRef.current.currentTime = time;
    setPosition(time);
  };
  const rawPlay = async () => {
    try {
      if (source?.kind === "youtube") youtube.current?.playVideo?.();
      else {
        if (!graph.current) {
          const context = new AudioContext();
          const input = context.createMediaElementSource(audioRef.current);
          const low = context.createBiquadFilter();
          low.type = "highpass";
          const presence = context.createBiquadFilter();
          presence.type = "peaking";
          presence.frequency.value = 2400;
          presence.Q.value = 0.7;
          input.connect(low).connect(presence).connect(context.destination);
          graph.current = { context, low, presence };
        }
        const { context, low, presence } = graph.current;
        low.frequency.value = 20 + current.current.focus * 3.8;
        presence.gain.value = current.current.focus * 0.08;
        await context.resume();
        if (phaseRef.current !== "playing") return;
        await audioRef.current.play();
      }
    } catch {
      setPhase("paused");
      setError(
        "Playback could not start. Press play to try again, or load another recording.",
      );
    }
  };
  const repeat = () => {
    if (phaseRef.current !== "playing") return;
    setRepeats((n) => n + 1);
    if (current.current.gap > 0) {
      setPhase("waiting");
      rawPause();
      deadline.current = performance.now() + current.current.gap * 1000;
      setRemaining(current.current.gap);
    } else {
      rawSeek(current.current.start);
      rawPlay();
    }
  };
  const actions = useRef({});
  actions.current = { repeat, rawPause, rawPlay, rawSeek };

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    setError("");
    setPhase("loading");
    setPosition(0);
    setRepeats(0);
    setRemaining(0);
    setPeaks(source.peaks || []);
    durationRef.current = 0;
    setDuration(0);
    if (source.kind !== "youtube") {
      const audio = audioRef.current;
      const ready = () => {
        if (cancelled) return;
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
          setError(
            "This file does not have a playable duration. Try an MP3, WAV, or M4A recording.",
          );
          setPhase("error");
          return;
        }
        durationRef.current = audio.duration;
        setDuration(audio.duration);
        setPhase("paused");
        setRates([0.25, 0.5, 0.75, 1]);
        current.current.onDuration(audio.duration);
      };
      const ended = () => {
        if (current.current.loop && phaseRef.current === "playing")
          actions.current.repeat();
        else setPhase("paused");
      };
      const failed = () => {
        setError(
          "This recording could not be played. Try an MP3, WAV, or M4A file.",
        );
        setPhase("error");
      };
      audio.addEventListener("loadedmetadata", ready);
      audio.addEventListener("ended", ended);
      audio.addEventListener("error", failed);
      audio.src = source.url;
      audio.load();
      audio.preservesPitch = true;
      audio.playbackRate = current.current.speed;
      audio.volume = current.current.volume;
      if (source.file)
        (async () => {
          let context;
          try {
            context = new AudioContext();
            const decoded = await context.decodeAudioData(
              await source.file.arrayBuffer(),
            );
            if (!cancelled) setPeaks(peaksFrom(decoded.getChannelData(0)));
          } catch {
            /* Playback still works for formats the waveform decoder does not support. */
          } finally {
            context?.close();
          }
        })();
      return () => {
        cancelled = true;
        audio.pause();
        audio.removeEventListener("loadedmetadata", ready);
        audio.removeEventListener("ended", ended);
        audio.removeEventListener("error", failed);
      };
    }
    let player, readyTimer;
    loadYouTube()
      .then((YT) => {
        if (cancelled) return;
        const host = document.getElementById("youtube-host");
        if (!host) return;
        const target = document.createElement("div");
        host.replaceChildren(target);
        readyTimer = setTimeout(() => {
          if (!cancelled) {
            setPhase("error");
            setError(
              "The YouTube player could not connect. Check your connection, then load the link again.",
            );
          }
        }, 15000);
        player = new YT.Player(target, {
          width: "100%",
          height: "100%",
          videoId: source.videoId,
          playerVars: {
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              clearTimeout(readyTimer);
              youtube.current = e.target;
              const d = e.target.getDuration();
              durationRef.current = d;
              setDuration(d);
              setRates(e.target.getAvailablePlaybackRates());
              e.target.setVolume(current.current.volume * 100);
              e.target.setPlaybackRate(current.current.speed);
              if (d > 0) current.current.onDuration(d);
              setPhase("paused");
              const title = e.target.getVideoData?.().title;
              if (title) current.current.onTitle(title);
            },
            onStateChange: (e) => {
              if (cancelled) return;
              if (e.data === 1) {
                const d = e.target.getDuration();
                if (d > 0 && durationRef.current !== d) {
                  const firstDuration = durationRef.current <= 0;
                  durationRef.current = d;
                  setDuration(d);
                  if (firstDuration) current.current.onDuration(d);
                }
                if (phaseRef.current === "waiting") {
                  e.target.pauseVideo();
                  return;
                }
                setPhase("playing");
              } else if (e.data === 2 && phaseRef.current === "playing")
                setPhase("paused");
              else if (e.data === 0) {
                if (current.current.loop) actions.current.repeat();
                else setPhase("paused");
              }
            },
            onPlaybackRateChange: (e) => {
              if (!cancelled) current.current.onSpeed(e.data);
            },
            onError: (e) => {
              if (cancelled) return;
              clearTimeout(readyTimer);
              setPhase("error");
              setError(
                [101, 150].includes(e.data)
                  ? "This video’s owner has disabled embedded playback. Try another video or upload an audio recording."
                  : "YouTube could not play this video. It may be private, restricted, or unavailable. Try another link.",
              );
            },
          },
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setPhase("error");
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(readyTimer);
      player?.destroy();
      youtube.current = null;
    };
  }, [source?.key, source?.attempt]);

  useEffect(() => {
    const id = setInterval(() => {
      // YouTube may report zero duration until metadata arrives after onReady.
      if (source?.kind === "youtube" && durationRef.current <= 0) {
        const loadedDuration = youtube.current?.getDuration?.() || 0;
        if (loadedDuration > 0) {
          durationRef.current = loadedDuration;
          setDuration(loadedDuration);
          current.current.onDuration(loadedDuration);
        }
      }
      if (phaseRef.current === "waiting") {
        const seconds = Math.max(
          0,
          (deadline.current - performance.now()) / 1000,
        );
        setRemaining(seconds);
        if (seconds <= 0) {
          actions.current.rawSeek(current.current.start);
          setPhase("playing");
          actions.current.rawPlay();
        }
        return;
      }
      if (phaseRef.current !== "playing") return;
      const position =
        source?.kind === "youtube"
          ? youtube.current?.getCurrentTime?.() || 0
          : audioRef.current?.currentTime || 0;
      setPosition(position);
      if (
        shouldRepeat(
          position,
          current.current.end,
          current.current.loop,
          phaseRef.current,
        ) &&
        current.current.end > 0
      )
        actions.current.repeat();
    }, 30);
    return () => clearInterval(id);
  }, [source?.key, source?.attempt]);
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = settings.speed;
      audioRef.current.volume = settings.volume;
    }
    youtube.current?.setPlaybackRate?.(settings.speed);
    youtube.current?.setVolume?.(settings.volume * 100);
  }, [settings.speed, settings.volume]);
  useEffect(() => {
    if (graph.current) {
      graph.current.low.frequency.value = 20 + settings.focus * 3.8;
      graph.current.presence.gain.value = settings.focus * 0.08;
    }
  }, [settings.focus]);
  useEffect(() => {
    if (!settings.loop && phaseRef.current === "waiting") {
      setPhase("paused");
      setRemaining(0);
    }
  }, [settings.loop]);
  const pause = () => {
    setPhase("paused");
    setRemaining(0);
    rawPause();
  };
  const seek = (time) => {
    if (phaseRef.current === "waiting") pause();
    rawSeek(clamp(time, 0, duration));
  };
  const toggle = () => {
    if (["loading", "error"].includes(phaseRef.current)) return;
    if (["playing", "waiting"].includes(phaseRef.current)) {
      pause();
      return;
    }
    setError("");
    const [start, end] = loopBounds(settings.start, settings.end, duration);
    if (
      (settings.loop && (position < start || position >= end)) ||
      position >= duration
    )
      rawSeek(settings.loop ? start : 0);
    setPhase("playing");
    rawPlay();
  };
  return {
    audioRef,
    phase,
    position,
    duration,
    remaining,
    repeats,
    error,
    peaks,
    rates,
    toggle,
    pause,
    seek,
  };
}
