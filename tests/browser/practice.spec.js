import { test, expect } from "@playwright/test";

test("sample loops with a real silent gap, and pause cancels the restart", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Play recording" }),
  ).toBeEnabled();
  await page.getByLabel("START · A").fill("0:00.0");
  await page.getByLabel("START · A").press("Tab");
  await page.getByLabel("END · B").fill("0:00.6");
  await page.getByLabel("END · B").press("Tab");
  await page.getByLabel("Pause between loops in seconds").fill("1");
  await page.getByRole("button", { name: "Play recording" }).click();
  await expect(page.locator(".your-turn")).toBeVisible();
  expect(await page.locator("audio").evaluate((a) => a.paused)).toBe(true);
  await expect(page.locator(".repeat-count")).toHaveText("2 repeats", {
    timeout: 7000,
  });
  await page.getByRole("button", { name: "Pause playback" }).click();
  await page.waitForTimeout(1400);
  expect(await page.locator("audio").evaluate((a) => a.paused)).toBe(true);
  await expect(page.locator(".repeat-count")).toHaveText("2 repeats");
});

test("saves phrases across reloads and restores their settings", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "0.5×", exact: true }).click();
  await page.getByRole("button", { name: "Save this phrase" }).click();
  await page.getByLabel("Phrase name").fill("That tricky roll");
  await page.getByRole("button", { name: "Save phrase", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /Saved phrases/ }).click();
  await expect(
    page.getByRole("heading", { name: "Keep the good bits." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^That tricky roll/ }).click();
  await expect(
    page.getByRole("heading", { name: "Find your own rhythm." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "0.5×", exact: true }),
  ).toHaveClass("chosen");
  await expect(page.getByLabel("START · A")).toHaveValue("0:03.0");
  await page.getByRole("button", { name: "Delete That tricky roll" }).click();
  await expect(page.getByText("A good phrase is worth keeping.")).toBeVisible();
});

test("uploads local audio, applies focus, and repeats without a gap", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Play recording" }),
  ).toBeEnabled();
  const bytes = await page
    .locator("audio")
    .evaluate(async (audio) => [
      ...new Uint8Array(await (await fetch(audio.src)).arrayBuffer()),
    ]);
  await page.locator("input[type=file]").setInputFiles({
    name: "My banjo practice.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from(bytes),
  });
  await expect(
    page.getByRole("heading", { name: "My banjo practice" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play recording" }),
  ).toBeEnabled();
  await page.getByLabel("Banjo focus").fill("65");
  await expect(page.getByText("65%")).toBeVisible();
  await page.getByLabel("END · B").fill("0:00.4");
  await page.getByLabel("END · B").press("Tab");
  await page.getByLabel("Pause between loops in seconds").fill("0");
  await page.getByRole("button", { name: "Play recording" }).click();
  await expect(page.locator(".repeat-count")).toHaveText("2 repeats", {
    timeout: 5000,
  });
  expect(await page.locator("audio").evaluate((a) => a.paused)).toBe(false);
  expect(await page.locator("audio").evaluate((a) => a.preservesPitch)).toBe(
    true,
  );
  await expect(page.locator(".your-turn")).not.toBeVisible();
});

test("validates links, supports keyboard selection and remains usable on mobile", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("YouTube video URL").fill("not-a-video");
  await page.getByRole("button", { name: "Load tune" }).click();
  await expect(page.getByRole("alert")).toContainText("valid YouTube");
  const handle = page.getByLabel("Loop start handle");
  await handle.focus();
  await handle.press("ArrowRight");
  await expect(page.getByLabel("START · A")).toHaveValue("0:03.1");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Find your own rhythm." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Save this phrase" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("YouTube integration controls rate, repeats and survives library navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.YT = {
      Player: class {
        constructor(target, config) {
          this.config = config;
          this.time = 0;
          this.playing = false;
          this.rate = 1;
          target.textContent = "YouTube API test fixture";
          this.timer = setInterval(() => {
            if (this.playing) this.time += 0.03 * this.rate;
          }, 30);
          window.testPlayer = this;
          setTimeout(() => config.events.onReady({ target: this }), 20);
        }
        getDuration() {
          return this.playing ? 60.05 : 60;
        }
        getCurrentTime() {
          return this.time;
        }
        getAvailablePlaybackRates() {
          return [0.25, 0.5, 0.75, 1];
        }
        getVideoData() {
          return { title: "A YouTube banjo tune" };
        }
        setVolume(v) {
          this.volume = v;
        }
        setPlaybackRate(v) {
          this.rate = v;
          this.config.events.onPlaybackRateChange({ data: v });
        }
        playVideo() {
          this.playing = true;
          this.config.events.onStateChange({ data: 1, target: this });
        }
        pauseVideo() {
          this.playing = false;
          this.config.events.onStateChange({ data: 2, target: this });
        }
        seekTo(v) {
          this.time = v;
        }
        destroy() {
          clearInterval(this.timer);
        }
      },
    };
  });
  await page.goto("/");
  await page
    .getByLabel("YouTube video URL")
    .fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.getByRole("button", { name: "Load tune" }).click();
  await expect(
    page.getByRole("heading", { name: "A YouTube banjo tune" }),
  ).toBeVisible();
  await expect(
    page.getByText("YouTube supports looping and speed changes."),
  ).toBeVisible();
  await expect(page.getByLabel("Banjo focus")).toHaveCount(0);
  await page.getByRole("button", { name: "0.5×", exact: true }).click();
  expect(await page.evaluate(() => window.testPlayer.rate)).toBe(0.5);
  await page.getByLabel("END · B").fill("0:00.3");
  await page.getByLabel("END · B").press("Tab");
  await page.getByLabel("Pause between loops in seconds").fill("1");
  await page.getByRole("button", { name: "Play recording" }).click();
  await expect(page.locator(".your-turn")).toBeVisible();
  expect(await page.evaluate(() => window.testPlayer.playing)).toBe(false);
  await expect(page.getByLabel("END · B")).toHaveValue("0:00.3");
  await expect(page.locator(".repeat-count")).toHaveText("2 repeats", {
    timeout: 7000,
  });
  await page.getByRole("button", { name: /Saved phrases/ }).click();
  expect(await page.evaluate(() => window.testPlayer.playing)).toBe(false);
  await page.getByRole("button", { name: "Practice room" }).click();
  await expect(page.locator("#youtube-host")).toContainText(
    "YouTube API test fixture",
  );
  await page.getByRole("button", { name: "Play recording" }).click();
  expect(await page.evaluate(() => window.testPlayer.playing)).toBe(true);
});
