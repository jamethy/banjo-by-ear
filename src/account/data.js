import { KEYS } from "../training/model.js";

export const defaults = {
  speed: 0.75,
  gap: 3,
  focus: 0,
  volume: 0.8,
  loop: true,
  mode: "rolls",
  key: "all",
  tempo: "all",
  answerStyle: "degrees",
  length: 10,
};
export function validPreference(key, value) {
  switch (key) {
    case "speed":
      return [0.25, 0.5, 0.75, 1].includes(value);
    case "gap":
      return Number.isFinite(value) && value >= 0 && value <= 60;
    case "focus":
      return Number.isFinite(value) && value >= 0 && value <= 100;
    case "volume":
      return Number.isFinite(value) && value >= 0 && value <= 1;
    case "loop":
      return typeof value === "boolean";
    case "mode":
      return ["rolls", "harmony", "notes"].includes(value);
    case "key":
      return value === "all" || KEYS.includes(value);
    case "tempo":
      return ["all", "slow", "medium", "fast"].includes(value);
    case "answerStyle":
      return ["degrees", "names"].includes(value);
    case "length":
      return [5, 10, 20].includes(value);
    default:
      return false;
  }
}
export function cleanPreferences(data = {}) {
  return Object.fromEntries(
    Object.entries(data).filter(([key, value]) => validPreference(key, value)),
  );
}
export function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function cleanRecord(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  );
}
export function errorMessage(error) {
  switch (error?.code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled. You can keep practicing here.";
    case "auth/popup-blocked":
      return "Allow pop-ups for this site, then try Google sign-in again.";
    case "auth/unauthorized-domain":
      return "This site's domain needs to be added to Firebase Authentication's authorized domains.";
    case "auth/operation-not-allowed":
      return "Google sign-in needs to be enabled in Firebase Authentication.";
    case "permission-denied":
      return "Cloud access was denied. Check the project's Firestore rules, then retry.";
    case "resource-exhausted":
      return "Cloud saving has reached its usage limit. Please try again later.";
    case "auth/network-request-failed":
    case "unavailable":
      return "Couldn't reach Firebase. Check your connection and try again.";
    default:
      return "Could not complete that save or account action. Please try again.";
  }
}
