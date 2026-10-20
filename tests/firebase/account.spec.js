import { test, expect } from "@playwright/test";

async function login(page, email) {
  // The emulator's optional UI styling is hosted externally; keep tests local.
  await page.context().route("https://unpkg.com/**", (route) => route.abort());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const opened = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const popup = await opened;
  await popup.waitForLoadState("domcontentloaded");
  await popup.waitForSelector("#add-account-button");
  const existing = popup.locator(".mdc-list-item").filter({ hasText: email });
  if (await existing.count()) await existing.click();
  else {
    await popup.getByRole("button", { name: "Add new account" }).click();
    await popup.locator("#email-input").fill(email);
    await popup.locator("#display-name-input").fill(email.split("@")[0]);
    await popup.locator("#sign-in").click();
  }
  await expect(page.getByRole("button", { name: "My account" })).toBeVisible();
  await expect(page.locator(".account-status")).toContainText(
    "Saved to your account",
  );
}
async function logout(page) {
  await page.getByRole("button", { name: "My account" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
}
async function savePhrase(page, name) {
  await page.getByRole("button", { name: "Save this phrase" }).click();
  await page.getByLabel("Phrase name").fill(name);
  await page.getByRole("button", { name: "Save phrase", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

test("Google popup, explicit import, cross-device sync and account isolation", async ({
  page,
  browser,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await savePhrase(page, "Guest phrase");
  await page.getByRole("button", { name: "0.5×", exact: true }).click();
  await page.evaluate(async () => {
    const { saveRound } = await import("/src/training/storage.js");
    await saveRound({
      id: "guest-round",
      mode: "rolls",
      total: 5,
      correct: 4,
      finishedAt: 1700000000000,
    });
    localStorage.setItem(
      "slowfolk-links",
      JSON.stringify([{ id: "dQw4w9WgXcQ", title: "Guest YouTube tune" }]),
    );
  });
  await login(page, "alice@example.test");
  await expect(page.getByRole("button", { name: /^Guest phrase/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "0.75×", exact: true }),
  ).toHaveClass("chosen");
  await page.getByRole("button", { name: "My account" }).click();
  await page
    .getByRole("button", { name: "Copy local data to this account" })
    .click();
  await expect(page.getByText("Copied 3 items to your account.")).toBeVisible();
  await page
    .getByRole("button", { name: "Copy local data to this account" })
    .click();
  await expect(page.getByText(/Your local items are already/)).toBeVisible();
  await page.getByRole("button", { name: "Close account" }).click();
  await expect(
    page.getByRole("button", { name: /^Guest phrase/ }),
  ).toBeVisible();
  await savePhrase(page, "Alice private phrase");
  await page.getByRole("button", { name: "0.25×", exact: true }).click();
  await page.getByLabel("Pause between loops in seconds").fill("7");
  await expect(page.locator(".account-status")).toContainText(
    "Saved to your account",
  );

  const second = await browser.newContext();
  const otherDevice = await second.newPage();
  await otherDevice.goto("http://127.0.0.1:5178");
  await login(otherDevice, "alice@example.test");
  await expect(
    otherDevice.getByRole("button", { name: /^Alice private phrase/ }),
  ).toBeVisible();
  await expect(
    otherDevice.getByRole("button", { name: "0.25×", exact: true }),
  ).toHaveClass("chosen");
  await expect(
    otherDevice.getByLabel("Pause between loops in seconds"),
  ).toHaveValue("7");
  await otherDevice.getByRole("button", { name: /Saved phrases/ }).click();
  await expect(
    otherDevice.getByRole("button", {
      name: "Guest YouTube tune",
      exact: true,
    }),
  ).toBeVisible();
  await otherDevice
    .getByRole("button", { name: "Delete tune Guest YouTube tune" })
    .click();
  await otherDevice
    .getByRole("button", { name: "Delete Alice private phrase" })
    .click();
  await page.getByRole("button", { name: /Saved phrases/ }).click();
  await expect(
    page.getByRole("button", { name: /^Alice private phrase/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Guest YouTube tune", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Ear training", exact: true }).click();
  await expect(page.locator(".training-stats")).toContainText("1");
  await expect(page.locator(".training-stats")).toContainText("80%");
  await second.close();

  await logout(page);
  await expect(
    page.getByRole("button", { name: "0.5×", exact: true }),
  ).toHaveClass("chosen");
  await expect(
    page.getByRole("button", { name: /^Guest phrase/ }),
  ).toBeVisible();
  await login(page, "bob@example.test");
  await expect(page.getByRole("button", { name: /^Guest phrase/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "0.75×", exact: true }),
  ).toHaveClass("chosen");
  await page.getByRole("button", { name: "Ear training", exact: true }).click();
  await expect(page.locator(".training-stats")).toContainText("0");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "My account" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/slowfolk-account-mobile.png" });
  expect(errors).toEqual([]);
});

test("cancelled Google popup preserves guest practice", async ({ page }) => {
  await page.context().route("https://unpkg.com/**", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const opened = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const popup = await opened;
  await popup.waitForSelector("#add-account-button");
  await popup.close();
  await expect(page.getByRole("alert")).toContainText("Sign-in was cancelled", {
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Close account" }).click();
  await expect(
    page.getByRole("button", { name: "Play recording" }),
  ).toBeEnabled();
});

test("completed games save to the account and survive reload without entering guest storage", async ({
  page,
}) => {
  await page.goto("/");
  await login(page, "player@example.test");
  const bytes = await page
    .locator("audio")
    .evaluate(async (audio) => [
      ...new Uint8Array(await (await fetch(audio.src)).arrayBuffer()),
    ]);
  await page.route("**/recordings/catalog.json", (route) =>
    route.fulfill({
      json: {
        version: 1,
        recordings: ["Forward roll", "Backward roll"].map((roll, i) => ({
          id: `roll-${i}`,
          title: `Take ${i}`,
          kind: "roll",
          roll,
          key: "G",
          chord: "I",
          bpm: 80,
          duration: 24,
          src: "audio/fixture.wav",
        })),
      },
    }),
  );
  await page.route("**/recordings/audio/fixture.wav", (route) =>
    route.fulfill({ contentType: "audio/wav", body: Buffer.from(bytes) }),
  );
  await page.getByRole("button", { name: "Ear training", exact: true }).click();
  await page.getByLabel("Round length").selectOption("5");
  await page.getByRole("button", { name: "Start listening" }).click();
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: "Listen to recording", exact: true })
      .click();
    await page
      .getByRole("radio", { name: "Forward roll", exact: true })
      .check();
    await page
      .getByRole("button", { name: "Check answer", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: i === 4 ? "See results" : "Next question",
        exact: true,
      })
      .click();
  }
  await expect(page.locator(".account-status")).toContainText(
    "Saved to your account",
  );
  const guestScores = await page.evaluate(async () =>
    (await import("/src/training/storage.js")).listRounds(),
  );
  expect(guestScores).toHaveLength(0);
  await page.reload();
  await expect(page.locator(".account-status")).toContainText(
    "Saved to your account",
  );
  await page.getByRole("button", { name: "Ear training", exact: true }).click();
  await expect(page.locator(".training-stats strong").first()).toHaveText("1");
  await expect(page.getByLabel("Round length")).toHaveValue("5");
});

test("offline changes show pending state and sync after reconnect", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await login(page, "offline@example.test");
  await context.setOffline(true);
  await page.getByRole("button", { name: "0.5×", exact: true }).click();
  await expect(page.locator(".account-status")).toContainText("Saving…");
  await context.setOffline(false);
  await expect(page.locator(".account-status")).toContainText(
    "Saved to your account",
    { timeout: 20000 },
  );
  await page.reload();
  await expect(page.locator(".account-status")).toContainText(
    "Saved to your account",
  );
  await expect(
    page.getByRole("button", { name: "0.5×", exact: true }),
  ).toHaveClass("chosen");
});
