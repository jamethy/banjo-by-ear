import React from "react";
import { Headphones, Play, Square } from "lucide-react";
import { noteName } from "./model";

export default function SiteRecordings({
  samples,
  listening,
  preview,
  setPreview,
}) {
  return (
    <section className="card training-library-card site-recordings">
      <div className="training-section-title">
        <div>
          <h2>Site recordings</h2>
          <p className="training-copy">
            {samples.length} permanent{" "}
            {samples.length === 1 ? "asset" : "assets"} · included in the site
            for every visitor
          </p>
        </div>
        <span className="outline-tag">SITE CATALOG</span>
      </div>
      {listening.error && (
        <p className="training-error" role="alert">
          {listening.error}
        </p>
      )}
      {!samples.length ? (
        <div className="training-empty">
          <Headphones size={30} />
          <h3>The recording catalog is ready.</h3>
          <p>
            No recordings have been added to the site yet. Prepare and label
            clips below, export them, and include them in the next site build.
          </p>
        </div>
      ) : (
        <div className="recording-list">
          {samples.map((sample) => (
            <article className="recording-row" key={sample.id}>
              <button
                className="recording-preview"
                aria-label={`Preview site recording ${sample.title}`}
                onClick={() => {
                  if (listening.playing && preview === `site:${sample.id}`)
                    listening.stop();
                  else {
                    setPreview(`site:${sample.id}`);
                    listening.play(sample);
                  }
                }}
              >
                {listening.playing && preview === `site:${sample.id}` ? (
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
                    : `Note ${noteName(sample)} · degree ${sample.degree}`}{" "}
                  · {sample.key} major
                  {sample.kind === "roll" && sample.chord
                    ? ` · ${sample.chord}`
                    : ""}
                  {sample.bpm ? ` · ${sample.bpm} BPM` : ""} ·{" "}
                  {sample.duration.toFixed(1)}s
                </span>
              </div>
              <span className="outline-tag">SITE ASSET</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
