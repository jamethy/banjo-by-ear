import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
export const configured = Object.values(config).every(Boolean);
export const partialConfig = !configured && Object.values(config).some(Boolean);
export let auth = null;
export let db = null;
export let configError = "";
if (configured) {
  try {
    const app = initializeApp(config);
    auth = getAuth(app);
    // The default memory cache avoids retaining account records on shared devices.
    db = getFirestore(app);
    if (env.DEV && env.VITE_FIREBASE_EMULATORS === "true") {
      if (!config.projectId.startsWith("demo-")) {
        throw new Error("Local emulators require a demo- project ID.");
      }
      connectAuthEmulator(auth, "http://127.0.0.1:9099");
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
    }
  } catch (error) {
    configError = error.message;
    auth = null;
    db = null;
  }
}
