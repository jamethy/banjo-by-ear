import test from "node:test";
import assert from "node:assert/strict";
import {
  youtubeId,
  parseTime,
  formatTime,
  loopBounds,
  shouldRepeat,
} from "../src/practice.js";

test("accepts supported YouTube URLs and rejects unrelated hosts", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=20",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ",
    "https://youtube.com/live/dQw4w9WgXcQ",
  ])
    assert.equal(youtubeId(url), "dQw4w9WgXcQ");
  for (const url of [
    "",
    "hello",
    "https://evil.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/playlist?list=123",
    "https://youtu.be/abc",
  ])
    assert.equal(youtubeId(url), null);
});
test("parses precise musical phrase timestamps", () => {
  assert.equal(parseTime("1:23.5"), 83.5);
  assert.equal(parseTime("12.3"), 12.3);
  assert.equal(parseTime("0:00"), 0);
  for (const text of ["-1", "1:99", "abc", "", "1:2:3"])
    assert.equal(parseTime(text), null);
  assert.equal(formatTime(83.5, true), "1:23.5");
});
test("loop bounds remain nonempty and within recording duration", () => {
  assert.deepEqual(loopBounds(-5, 100, 24), [0, 24]);
  assert.deepEqual(loopBounds(10, 2, 24), [10, 10.3]);
  assert.deepEqual(loopBounds(100, 200, 24), [23.7, 24]);
  assert.deepEqual(loopBounds(0, 8, 0.1), [0, 0.1]);
});
test("repeats only when enabled, playing, and at the phrase end", () => {
  assert.equal(shouldRepeat(9, 9, true, "playing"), true);
  assert.equal(shouldRepeat(8.99, 9, true, "playing"), false);
  assert.equal(shouldRepeat(10, 9, false, "playing"), false);
  assert.equal(shouldRepeat(10, 9, true, "waiting"), false);
  assert.equal(shouldRepeat(10, 9, true, "paused"), false);
});
