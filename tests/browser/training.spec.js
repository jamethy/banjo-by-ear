import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Tests that need recordings install their own catalog in seed().
  await page.route("**/recordings/catalog.json", (route) =>
    route.fulfill({ json: { version: 1, recordings: [] } }),
  );
});

function wav() {
  const rate = 8000,
    count = 4000,
    buffer = Buffer.alloc(44 + count * 2);
  buffer.write("RIFF");
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++)
    buffer.writeInt16LE(
      Math.sin((i / rate) * 440 * Math.PI * 2) *
        8000 *
        Math.min(1, i / 50, (count - i) / 50),
      44 + i * 2,
    );
  return buffer;
}
async function training(page) {
  await page.getByRole("button", { name: "Ear training", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start listening", exact: true }),
  ).toBeVisible();
}
async function seed(page, { storageBlocked = false } = {}) {
  await page.addInitScript((blocked) => {
    Math.random = () => 0.25;
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
    if (blocked)
      Object.defineProperty(window, "indexedDB", {
        get() {
          throw new Error("Storage unavailable");
        },
        configurable: true,
      });
  }, storageBlocked);
  const base = { key: "G", bpm: 80, duration: 0.5, src: "audio/fixture.wav" };
  const catalog = {
    version: 1,
    recordings: [
      {
        ...base,
        id: "a",
        kind: "roll",
        title: "Secret backward take",
        roll: "Backward roll",
        chord: "I",
      },
      {
        ...base,
        id: "b",
        kind: "roll",
        title: "Secret forward take",
        roll: "Forward roll",
        chord: "V",
      },
      {
        ...base,
        id: "c",
        kind: "note",
        title: "Secret tonic take",
        degree: "1",
      },
      {
        ...base,
        id: "d",
        kind: "note",
        title: "Secret fifth take",
        degree: "5",
      },
    ],
  };
  await page.route("**/recordings/catalog.json", (route) =>
    route.fulfill({ json: catalog }),
  );
  await page.route("**/recordings/audio/fixture.wav", (route) =>
    route.fulfill({ contentType: "audio/wav", body: wav() }),
  );
  await page.goto("/");
  await training(page);
}

test("imports, plays, exports, edits, and deletes a local recording draft", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await training(page);
  await expect(
    page.getByRole("button", { name: "Start listening" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Recording library/ }).click();
  await page
    .getByRole("button", { name: "Add draft recording", exact: true })
    .click();
  await page.getByLabel("Recording title").fill("My forward roll");
  await page.getByLabel("Chord relative to key").selectOption("IV");
  await page.getByLabel("Tempo (BPM, optional)").fill("95");
  await page
    .locator(".recording-editor input[type=file]")
    .setInputFiles({ name: "banjo.wav", mimeType: "audio/wav", buffer: wav() });
  await page.getByRole("button", { name: "Preview recording" }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText(
      "Draft saved in this browser. Export it to include it in the site.",
    ),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export draft bundle", exact: true })
    .click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const { readFile } = await import("node:fs/promises");
  const bundle = JSON.parse(await readFile(downloadPath, "utf8"));
  expect(bundle.recordings).toHaveLength(1);
  expect(Buffer.from(bundle.recordings[0].audioBase64, "base64")).toEqual(
    wav(),
  );
  expect(bundle.recordings[0].chord).toBe("IV");
  await page.reload();
  await training(page);
  await page.getByRole("button", { name: /Recording library/ }).click();
  await expect(page.locator(".recording-info")).toContainText(
    "My forward roll",
  );
  await expect(page.locator(".recording-info")).toContainText("IV · 95 BPM");
  await page.getByRole("button", { name: "Edit My forward roll" }).click();
  await page.getByLabel("Chord relative to key").selectOption("V");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.locator(".recording-info")).toContainText("V · 95 BPM");
  await page
    .getByRole("button", { name: "Delete My forward roll", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByText("Prepare the next set of recordings."),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("recording loop repeats audio, toggles during playback, and stops between questions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const start = AudioBufferSourceNode.prototype.start;
    const stop = AudioBufferSourceNode.prototype.stop;
    window.recordingStarts = 0;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.context instanceof AudioContext) {
        window.trainingAudio = this;
        window.recordingStarts++;
        this.startedAt = this.context.currentTime;
        this.finished = false;
        this.addEventListener("ended", () => (this.finished = true));
      }
      return start.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (...args) {
      this.finished = true;
      return stop.apply(this, args);
    };
  });
  await seed(page);
  await page.getByRole("button", { name: "Start listening" }).click();
  const loop = page.getByRole("button", {
    name: "Loop recording",
    exact: true,
  });
  await expect(loop).toHaveAttribute("aria-pressed", "false");
  await loop.click();
  await expect(loop).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Listen to recording", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const node = window.trainingAudio;
        return node
          ? (node.context.currentTime - node.startedAt) / node.buffer.duration
          : 0;
      }),
    )
    .toBeGreaterThan(1);
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.recordingStarts)).toBe(1);
  // Render the same decoded buffer and loop settings to verify that every
  // sample crosses the wrap without any inserted silence or missing frames.
  const continuous = await page.evaluate(async () => {
    const node = window.trainingAudio;
    const buffer = node.buffer;
    const offline = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length * 3,
      buffer.sampleRate,
    );
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.loop = node.loop;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const expected = buffer.getChannelData(channel);
      const actual = rendered.getChannelData(channel);
      for (let i = 0; i < actual.length; i++)
        if (Math.abs(actual[i] - expected[i % expected.length]) > 0.000001)
          return false;
    }
    return true;
  });
  expect(continuous).toBe(true);
  await loop.click();
  await expect(loop).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Listen again", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Listen again", exact: true }).click();
  await loop.click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const node = window.trainingAudio;
        return (
          (node.context.currentTime - node.startedAt) / node.buffer.duration
        );
      }),
    )
    .toBeGreaterThan(2);
  await page.getByRole("radio", { name: "Forward roll", exact: true }).check();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  expect(await page.evaluate(() => window.trainingAudio.finished)).toBe(true);
  await page
    .getByRole("button", { name: "Next question", exact: true })
    .click();
  await expect(loop).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Listen to recording", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.trainingAudio.finished)).toBe(true);
  await page
    .getByRole("button", { name: "Listen to recording", exact: true })
    .click();
  await page.getByRole("button", { name: "End round", exact: true }).click();
  expect(await page.evaluate(() => window.trainingAudio.finished)).toBe(true);
});

test("hard roll round hides labels, grades both answers, and stores one score", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: /THE NEXT CHALLENGE/ }).click();
  await page.getByLabel("Round length").selectOption("5");
  await page.getByRole("button", { name: "Start listening" }).click();
  await expect(page.getByText("Secret forward take")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check answer" }),
  ).toBeDisabled();
  for (let i = 0; i < 5; i++) {
    const forward = [true, false, false, false, true][i];
    await page
      .getByRole("button", { name: "Hear tonic (G)", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Listen to recording", exact: true })
      .click();
    await page
      .getByRole("radio", {
        name: forward ? "Forward roll" : "Backward roll",
        exact: true,
      })
      .check();
    // The first answer intentionally has the right roll but wrong chord.
    await page
      .getByRole("radio", {
        name: i === 0 ? "I" : forward ? "V" : "I",
        exact: true,
      })
      .check();
    await page
      .getByRole("button", { name: "Check answer", exact: true })
      .click();
    if (i === 0) {
      await expect(page.getByRole("status")).toContainText(
        "You identified the roll correctly.",
      );
      await expect(page.getByRole("status")).toContainText(
        "The answer: Forward roll · V.",
      );
    }
    await page
      .getByRole("button", {
        name: i === 4 ? "See results" : "Next question",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "4 out of 5. Keep listening." }),
  ).toBeVisible();
  const rounds = await page.evaluate(async () => {
    const { listRounds } = await import("/src/training/storage.js");
    return listRounds();
  });
  expect(rounds).toHaveLength(1);
  expect(rounds[0].correct).toBe(4);
  await page.getByRole("button", { name: "Practice missed questions" }).click();
  await expect(page.getByText("Question 1 of 1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check answer" }),
  ).toBeDisabled();
});

test("note names are relative to the shown key and mobile controls fit", async ({
  page,
}) => {
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /RELATIVE PITCH/ }).click();
  await page.getByLabel("Answer with").selectOption("names");
  await page.getByRole("button", { name: "Start listening" }).click();
  await expect(page.getByText("G major", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Listen to recording", exact: true })
    .click();
  await page.getByRole("radio", { name: "D", exact: true }).check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByRole("status")).toContainText("You’ve got it.");
  await expect(page.getByRole("status")).toContainText("5 (D)");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "End round", exact: true }).click();
  await page.getByLabel("Answer with").selectOption("degrees");
  await page.getByRole("button", { name: "Start listening" }).click();
  await page
    .getByRole("button", { name: "Listen to recording", exact: true })
    .click();
  await page.getByRole("radio", { name: "5", exact: true }).check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByRole("status")).toContainText("You’ve got it.");
});

test("roll-only mode hides pitch context and changing sections pauses practice audio", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "Practice room", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Play recording", exact: true })
    .click();
  await training(page);
  expect(await page.locator("audio").evaluate((a) => a.paused)).toBe(true);
  await page.getByRole("button", { name: "Start listening" }).click();
  await expect(page.getByRole("button", { name: /Hear tonic/ })).toHaveCount(0);
  await expect(page.getByText("Secret forward take")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Listen to recording", exact: true })
    .click();
  await page.getByRole("radio", { name: "Forward roll", exact: true }).check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByRole("status")).toContainText("You’ve got it.");
});

test("site recordings play without browser storage or previously uploaded audio", async ({
  page,
}) => {
  await seed(page, { storageBlocked: true });
  await expect(page.getByText(/Browser storage is unavailable/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start listening", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  const audioRequest = page.waitForRequest("**/recordings/audio/fixture.wav");
  await page
    .getByRole("button", { name: "Listen to recording", exact: true })
    .click();
  await audioRequest;
  await expect(
    page.getByRole("radio", { name: "Forward roll", exact: true }),
  ).toBeEnabled();
  await page.getByRole("radio", { name: "Forward roll", exact: true }).check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.locator(".answer-feedback")).toContainText(
    "You’ve got it.",
  );
});

test("unpublished browser drafts are excluded from the site game library by default", async ({
  page,
}) => {
  await page.goto("/");
  await training(page);
  await page.evaluate(
    async (bytes) => {
      const { saveRecording } = await import("/src/training/storage.js");
      const audio = new Blob([new Uint8Array(bytes)], { type: "audio/wav" });
      const base = {
        kind: "roll",
        key: "G",
        duration: 0.5,
        audio,
        bpm: 80,
        updatedAt: 1,
      };
      await saveRecording({
        ...base,
        id: "draft-a",
        title: "Draft A",
        roll: "Forward roll",
        chord: "I",
      });
      await saveRecording({
        ...base,
        id: "draft-b",
        title: "Draft B",
        roll: "Backward roll",
        chord: "V",
      });
    },
    [...wav()],
  );
  await page.reload();
  await training(page);
  await expect(
    page.getByRole("button", { name: "Start listening", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /Preview my local drafts/ }).check();
  await expect(
    page.getByRole("button", { name: "Start listening", exact: true }),
  ).toBeEnabled();
});
