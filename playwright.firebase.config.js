import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/firebase",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5178",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH,
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command:
      "npm run dev -- --mode emulator --host 127.0.0.1 --port 5178 --strictPort",
    url: "http://127.0.0.1:5178",
    reuseExistingServer: false,
    env: {
      VITE_FIREBASE_API_KEY: "demo-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "demo-slowfolk.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "demo-slowfolk",
      VITE_FIREBASE_APP_ID: "1:123456789:web:demo",
      VITE_FIREBASE_EMULATORS: "true",
    },
  },
});
