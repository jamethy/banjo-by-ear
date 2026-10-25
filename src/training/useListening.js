import { useEffect, useRef, useState } from "react";
import { KEYS } from "./model";

export default function useListening({ loop = false } = {}) {
  const source = useRef(null),
    cached = useRef(null),
    loading = useRef(null),
    looping = useRef(loop),
    context = useRef(null),
    oscillator = useRef(null),
    request = useRef(0);
  const [playing, setPlaying] = useState(false),
    [error, setError] = useState("");
  const halt = () => {
    request.current++;
    loading.current?.abort();
    loading.current = null;
    if (source.current) {
      source.current.onended = null;
      source.current.stop();
      source.current.disconnect();
      source.current = null;
    }
    if (oscillator.current) {
      try {
        oscillator.current.stop();
      } catch {
        /* Already ended. */
      }
      oscillator.current = null;
    }
  };
  const stop = () => {
    halt();
    setPlaying(false);
  };
  useEffect(() => {
    return () => {
      halt();
      context.current?.close();
      context.current = null;
      cached.current = null;
    };
  }, []);
  useEffect(() => {
    looping.current = loop;
    if (source.current) source.current.loop = loop;
  }, [loop]);
  const play = async (sample) => {
    stop();
    setError("");
    const token = request.current;
    try {
      if (!context.current) context.current = new AudioContext();
      const ctx = context.current;
      await ctx.resume();
      if (request.current !== token) return false;
      const key = sample.published ? sample.audioUrl : sample.audio;
      let buffer = cached.current?.key === key ? cached.current.buffer : null;
      if (!buffer) {
        let bytes;
        if (sample.published) {
          const controller = new AbortController();
          loading.current = controller;
          const response = await fetch(sample.audioUrl, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("Recording could not load.");
          bytes = await response.arrayBuffer();
        } else bytes = await sample.audio.arrayBuffer();
        if (request.current !== token) return false;
        buffer = await ctx.decodeAudioData(bytes);
        if (request.current !== token) return false;
        // Keep only the current clip so replay is instant without retaining
        // the entire recording library in decoded form.
        cached.current = { key, buffer };
      }
      loading.current = null;
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.loop = looping.current;
      node.connect(ctx.destination);
      node.onended = () => {
        node.disconnect();
        if (source.current !== node) return;
        source.current = null;
        setPlaying(false);
      };
      source.current = node;
      node.start();
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
