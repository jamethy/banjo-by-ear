import { mockYouTube } from "../helpers/youtube.js";
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
  const confirmation = page.getByRole("dialog", {
    name: "Delete this phrase?",
  });
  await expect(confirmation).toContainText("That tricky roll");
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Delete That tricky roll" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete That tricky roll" }).click();
  await confirmation
    .getByRole("button", { name: "Delete phrase", exact: true })
    .click();
  await expect(page.getByText("A good phrase is worth keeping.")).toBeVisible();
});

test("edits an existing phrase in the practice panel and restores changes after reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Save this phrase" }).click();
  await page.getByLabel("Phrase name").fill("First phrase");
  await page.getByRole("button", { name: "Save phrase", exact: true }).click();
  const original = await page.evaluate(
    () => JSON.parse(localStorage.getItem("slowfolk-loops"))[0],
  );
  await page.getByRole("button", { name: /Saved phrases/ }).click();
  await page
    .getByRole("button", { name: "Edit First phrase", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: "Phrase settings",
    exact: true,
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await panel.getByLabel("Phrase name").fill("Discard this edit");
  await panel
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(panel.getByLabel("Phrase name")).toHaveValue("First phrase");
  await panel.getByLabel("Phrase name").fill("Tricky ending");
  await panel.getByLabel("START · A").fill("0:04.5");
  await panel.getByLabel("START · A").press("Tab");
  await panel.getByLabel("END · B").fill("0:08.2");
  await panel.getByLabel("END · B").press("Tab");
  await panel.getByRole("button", { name: "0.25×", exact: true }).click();
  await panel.getByLabel("Pause between loops in seconds").fill("2.5");
  await panel.getByRole("button", { name: "Save changes" }).click();
  await expect(
    panel.getByRole("button", { name: "Save changes" }),
  ).toBeDisabled();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("slowfolk-loops")),
  );
  expect(saved).toEqual([
    {
      ...original,
      name: "Tricky ending",
      start: 4.5,
      end: 8.2,
      speed: 0.25,
      gap: 2.5,
    },
  ]);
  await page.reload();
  await page.getByRole("button", { name: /Saved phrases/ }).click();
  await page.getByRole("button", { name: /^Tricky ending/ }).click();
  await expect(page.getByLabel("START · A")).toHaveValue("0:04.5");
  await expect(page.getByLabel("END · B")).toHaveValue("0:08.2");
  await expect(
    page.getByRole("button", { name: "0.25×", exact: true }),
  ).toHaveClass("chosen");
  await expect(page.getByLabel("Pause between loops in seconds")).toHaveValue(
    "2.5",
  );
});

test("groups existing phrases by video and edits and deletes within a group on mobile", async ({
  page,
}) => {
  await mockYouTube(page);
  const firstId = "dQw4w9WgXcQ",
    secondId = "abcdefghijk";
  const base = { kind: "youtube", speed: 0.5, gap: 3 };
  const phrases = [
    {
      ...base,
      id: "one",
      videoId: firstId,
      sourceKey: `youtube-${firstId}`,
      title: "Banjo tune one",
      name: "Ending",
      start: 30,
      end: 35,
    },
    {
      ...base,
      id: "two",
      videoId: secondId,
      sourceKey: `youtube-${secondId}`,
      title: "Banjo tune two",
      name: "Intro",
      start: 5,
      end: 10,
    },
    {
      ...base,
      id: "three",
      videoId: firstId,
      sourceKey: `youtube-${firstId}`,
      title: "Banjo tune one",
      name: "Intro",
      start: 1,
      end: 4,
    },
  ];
  await page.goto("/");
  await page.evaluate(
    (items) => localStorage.setItem("slowfolk-loops", JSON.stringify(items)),
    phrases,
  );
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /Saved phrases/ }).click();
  const first = page.getByRole("region", {
    name: "Banjo tune one",
    exact: true,
  });
  const second = page.getByRole("region", {
    name: "Banjo tune two",
    exact: true,
  });
  await expect(page.locator(".phrase-group")).toHaveCount(2);
  await expect(first.locator(".saved-open strong")).toHaveText([
    "Intro",
    "Ending",
  ]);
  await expect(second.locator(".saved-open strong")).toHaveText(["Intro"]);
  await first.getByRole("button", { name: "Edit Intro", exact: true }).click();
  await page
    .getByRole("region", { name: "Phrase settings" })
    .getByLabel("Phrase name")
    .fill("Opening roll");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: /Saved phrases/ }).click();
  await expect(
    first.getByRole("button", { name: "Edit Opening roll", exact: true }),
  ).toBeVisible();
  await expect(
    second.getByRole("button", { name: "Edit Intro", exact: true }),
  ).toBeVisible();
  await first
    .getByRole("button", { name: "Delete Ending", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(first.locator(".saved-item")).toHaveCount(2);
  await first
    .getByRole("button", { name: "Delete Ending", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete phrase", exact: true })
    .click();
  await expect(first.locator(".saved-item")).toHaveCount(1);
  await first
    .getByRole("button", { name: "Delete Opening roll", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete phrase", exact: true })
    .click();
  await expect(first).not.toBeVisible();
  await expect(second.locator(".saved-item")).toHaveCount(1);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("slowfolk-loops")),
    ),
  ).toEqual([phrases[1]]);
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
  await mockYouTube(page);
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
  await page.getByRole("button", { name: "Save tune", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Tune saved", exact: true }),
  ).toBeDisabled();
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
  await expect(
    page.getByRole("button", { name: "A YouTube banjo tune", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Practice room" }).click();
  await expect(page.locator("#youtube-host")).toContainText(
    "YouTube API test fixture",
  );
  await page.getByRole("button", { name: "Play recording" }).click();
  expect(await page.evaluate(() => window.testPlayer.playing)).toBe(true);
});

test("unconfigured sign-in explains setup and guest preferences persist", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "hasn’t been configured",
  );
  await page.getByRole("button", { name: "Close account" }).click();
  await page.getByLabel("Pause between loops in seconds").fill("8");
  await page.getByRole("button", { name: "0.5×", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Pause between loops in seconds")).toHaveValue(
    "8",
  );
  await expect(
    page.getByRole("button", { name: "0.5×", exact: true }),
  ).toHaveClass("chosen");
});
