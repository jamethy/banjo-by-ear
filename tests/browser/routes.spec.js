import { test, expect } from "@playwright/test";
import { mockYouTube } from "../helpers/youtube.js";

const videoId = "dQw4w9WgXcQ";
const base = {
  kind: "youtube",
  videoId,
  sourceKey: `youtube-${videoId}`,
  title: "A YouTube banjo tune",
  speed: 0.5,
  gap: 3,
};
const phrases = [
  { ...base, id: "intro", name: "Opening roll", start: 2, end: 6 },
  {
    ...base,
    id: "ending",
    name: "Ending lick",
    start: 30,
    end: 35,
    speed: 0.75,
    gap: 5,
  },
];
async function setup(page) {
  await mockYouTube(page);
  await page.goto("/");
  await page.evaluate(
    (items) => localStorage.setItem("slowfolk-loops", JSON.stringify(items)),
    phrases,
  );
}

test("direct phrase links restore controls, save in place, and support history and refresh", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/pr/${videoId}/intro`);
  const panel = page.getByRole("region", { name: "Phrase settings" });
  await expect(panel.getByLabel("Phrase name")).toHaveValue("Opening roll");
  await expect(page.getByLabel("START · A")).toHaveValue("0:02.0");
  await expect(page.getByLabel("END · B")).toHaveValue("0:06.0");
  await expect(
    page.getByRole("button", { name: "0.5×", exact: true }),
  ).toHaveClass("chosen");
  await panel.getByLabel("Phrase name").fill("Opening roll revised");
  await page.getByLabel("START · A").fill("0:03.2");
  await page.getByLabel("START · A").press("Tab");
  await page.getByLabel("END · B").fill("0:07.8");
  await page.getByLabel("END · B").press("Tab");
  await page.getByRole("button", { name: "0.25×", exact: true }).click();
  await page.getByLabel("Pause between loops in seconds").fill("1");
  await panel.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(new RegExp(`/pr/${videoId}/intro$`));
  await expect(
    panel.getByRole("button", { name: "Save changes" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("slowfolk-loops")).length,
    ),
  ).toBe(2);
  await page.getByRole("button", { name: /^Ending lick/ }).click();
  await expect(page).toHaveURL(new RegExp(`/pr/${videoId}/ending$`));
  await expect(page.getByLabel("START · A")).toHaveValue("0:30.0");
  await page.goBack();
  await expect(panel.getByLabel("Phrase name")).toHaveValue(
    "Opening roll revised",
  );
  await expect(page.getByLabel("START · A")).toHaveValue("0:03.2");
  await page.goForward();
  await expect(panel.getByLabel("Phrase name")).toHaveValue("Ending lick");
  await page.reload();
  await expect(panel.getByLabel("Phrase name")).toHaveValue("Ending lick");
  await expect(page.getByLabel("Pause between loops in seconds")).toHaveValue(
    "5",
  );
  await page
    .getByRole("button", { name: "Delete Ending lick", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete phrase", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/pr/${videoId}$`));
  await expect(panel.getByLabel("Phrase name")).toHaveCount(0);
});

test("video links, new phrases, and copies use distinct URLs", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/pr/${videoId}`);
  await expect(
    page.getByRole("button", { name: "Play recording", exact: true }),
  ).toBeEnabled();
  await expect(
    page
      .getByRole("region", { name: "Phrase settings" })
      .getByLabel("Phrase name"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Save this phrase" }).click();
  await page.getByRole("dialog").getByLabel("Phrase name").fill("New phrase");
  await page.getByRole("button", { name: "Save phrase", exact: true }).click();
  const first = new URL(page.url()).pathname;
  expect(first).toMatch(new RegExp(`^/pr/${videoId}/[a-f0-9-]+$`));
  await page.getByRole("button", { name: "Save as new phrase" }).click();
  await page.getByRole("dialog").getByLabel("Phrase name").fill("Another take");
  await page.getByRole("button", { name: "Save phrase", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).not.toBe(first);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("slowfolk-loops")).length,
    ),
  ).toBe(4);
  await page
    .getByLabel("YouTube video URL")
    .fill(`https://youtu.be/${videoId}`);
  await page.getByRole("button", { name: "Load tune", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/pr/${videoId}$`));
});

test("missing or mismatched private phrases explain the problem while preserving video playback", async ({
  page,
}) => {
  await setup(page);
  for (const path of [`/pr/${videoId}/missing`, "/pr/abcdefghijk/intro"]) {
    await page.goto(path);
    await expect(page.locator(".practice-route-notice")).toContainText(
      "isn't saved in this browser",
    );
    await expect(
      page.getByRole("button", { name: "Play recording", exact: true }),
    ).toBeEnabled();
    await expect(
      page
        .getByRole("region", { name: "Phrase settings" })
        .getByLabel("Phrase name"),
    ).toHaveCount(0);
  }
  await page.goto("/pr/bad-link");
  await expect(page.locator(".practice-route-notice")).toContainText("invalid");
});
