import { useEffect, useRef, useState } from "react";
import { KEYS } from "./model";

export default function useListening() {
  const audio = useRef(null),
    url = useRef(null),
    context = useRef(null),
    oscillator = useRef(null),
    request = useRef(0);
  const [playing, setPlaying] = useState(false),
    [error, setError] = useState("");
  const stop = () => {
    request.current++;
    if (audio.current) {
      audio.current.pause();
      audio.current.removeAttribute("src");
      audio.current.load();
    }
    if (url.current) {
      URL.revokeObjectURL(url.current);
      url.current = null;
    }
    if (oscillator.current) {
      try {
        oscillator.current.stop();
      } catch {
        /* Already ended. */
      }
      oscillator.current = null;
    }
    setPlaying(false);
  };
  useEffect(() => {
    audio.current = new Audio();
    audio.current.onended = () => setPlaying(false);
    audio.current.onerror = () => {
      setPlaying(false);
      setError(
        "This recording could not be played. Check it in the recording library.",
      );
    };
    return () => {
      request.current++;
      audio.current.onended = audio.current.onerror = null;
      audio.current.pause();
      if (url.current) URL.revokeObjectURL(url.current);
      context.current?.close();
    };
  }, []);
  const play = async (sample) => {
    stop();
    setError("");
    const token = request.current;
    try {
      if (sample.published) audio.current.src = sample.audioUrl;
      else {
        url.current = URL.createObjectURL(sample.audio);
        audio.current.src = url.current;
      }
      await audio.current.play();
      if (request.current !== token) return false;
      setPlaying(true);
      return true;
    } catch {
      if (request.current === token)
        setError("Playback could not start. Try listening again.");
      return false;
    }
  };
  const tonic = async (key) => {
    stop();
    setError("");
    const token = request.current;
    try {
      if (!context.current) context.current = new AudioContext();
      await context.current.resume();
      if (token !== request.current) return;
      const ctx = context.current,
        tone = ctx.createOscillator(),
        gain = ctx.createGain();
      tone.type = "sine";
      tone.frequency.value = 261.625565 * 2 ** (KEYS.indexOf(key) / 12);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + 0.8);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.1);
      tone.connect(gain).connect(ctx.destination);
      tone.start();
      tone.stop(ctx.currentTime + 1.15);
      oscillator.current = tone;
      tone.onended = () => {
        tone.disconnect();
        gain.disconnect();
      };
    } catch {
      setError("The reference tone could not play. Try again.");
    }
  };
  return { play, stop, tonic, playing, error };
}
