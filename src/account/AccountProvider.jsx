import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db, configError, partialConfig } from "./client";
import {
  cleanPreferences,
  cleanRecord,
  defaults,
  errorMessage,
  readLocal,
  validPreference,
} from "./data";
import { readSaved } from "../practice";
import { listRounds, saveRound as saveLocalRound } from "../training/storage";

const AccountContext = createContext(null);
export const useAccount = () => useContext(AccountContext);
export function usePreference(key) {
  const account = useAccount();
  return [
    account.preferences[key],
    (value) => account.setPreference(key, value),
  ];
}

export default function AccountProvider({ children }) {
  const [session, setSession] = useState({ user: null, loading: !!auth });
  const [authError, setAuthError] = useState(
    configError ||
      (partialConfig
        ? "Firebase configuration is incomplete. See the setup instructions in README.md."
        : ""),
  );
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(
      auth,
      (user) => {
        setSession({ user, loading: false });
      },
      (error) => {
        setAuthError(errorMessage(error));
        setSession({ user: null, loading: false });
      },
    );
  }, []);
  // Remounting clears playing audio, game sessions and private UI on account changes.
  return (
    <AccountData
      key={session.loading ? "loading" : session.user?.uid || "guest"}
      session={session}
      authError={authError}
      setAuthError={setAuthError}
    >
      {children}
    </AccountData>
  );
}

function AccountData({ session, authError, setAuthError, children }) {
  const { user } = session;
  const uid = user?.uid;
  const [loops, setLoops] = useState(() => (uid ? [] : readSaved()));
  const [links, setLinks] = useState(() => {
    const local = readLocal("slowfolk-links", []);
    return !uid && Array.isArray(local)
      ? local.filter(
          (x) => /^[\w-]{11}$/.test(x?.id) && typeof x.title === "string",
        )
      : [];
  });
  const [scores, setScores] = useState([]);
  const [preferences, setPreferences] = useState(() => ({
    ...defaults,
    ...(!uid ? cleanPreferences(readLocal("slowfolk-preferences", {})) : {}),
  }));
  const [ready, setReady] = useState(!uid && !session.loading);
  const [error, setError] = useState("");
  const [metadata, setMetadata] = useState({});
  const [pending, setPending] = useState(0);
  const [queued, setQueued] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const prefRef = useRef(preferences),
    updates = useRef({}),
    timer = useRef(null);
  const alive = useRef(true),
    writes = useRef(new Set());
  const localRef = useRef({ loops, links, scores });
  localRef.current = { loops, links, scores };
  useEffect(
    () => () => {
      alive.current = false;
      clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setError("");
    if (!uid) {
      listRounds()
        .then((value) => {
          if (!cancelled) setScores(value);
        })
        .catch(() => {
          if (!cancelled)
            setError(
              "Browser score storage is unavailable. You can still practice.",
            );
        });
      return () => {
        cancelled = true;
      };
    }
    setReady(false);
    const seen = new Set();
    let subscriptionFailed = false;
    const subscriptions = [
      ["loops", collection(db, "users", uid, "loops"), setLoops],
      ["links", collection(db, "users", uid, "links"), setLinks],
      ["scores", collection(db, "users", uid, "scores"), setScores],
      ["preferences", doc(db, "users", uid, "settings", "preferences"), null],
    ].map(([name, reference, setter]) =>
      onSnapshot(
        reference,
        { includeMetadataChanges: true },
        (snapshot) => {
          if (cancelled) return;
          if (setter)
            setter(
              snapshot.docs.map((item) => ({ ...item.data(), id: item.id })),
            );
          else {
            const next = {
              ...defaults,
              ...cleanPreferences(snapshot.data()),
              ...updates.current,
            };
            prefRef.current = next;
            setPreferences(next);
          }
          seen.add(name);
          setReady(!subscriptionFailed && seen.size === 4);
          setMetadata((previous) => ({
            ...previous,
            [name]: snapshot.metadata,
          }));
        },
        (failure) => {
          if (!cancelled) {
            subscriptionFailed = true;
            setError(errorMessage(failure));
            setReady(false);
          }
        },
      ),
    );
    return () => {
      cancelled = true;
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [uid, retry]);

  const checkOwner = () => {
    if (
      !alive.current ||
      session.loading ||
      (uid && auth.currentUser?.uid !== uid)
    ) {
      throw new Error("Your account changed. Please try again.");
    }
  };
  const track = (promise) => {
    setPending((n) => n + 1);
    writes.current.add(promise);
    promise
      .catch((failure) => {
        if (alive.current) setError(errorMessage(failure));
      })
      .finally(() => {
        writes.current.delete(promise);
        if (alive.current) setPending((n) => n - 1);
      });
    return promise;
  };
  const reference = (kind, id) => doc(db, "users", uid, kind, id);
  const save = async (kind, item) => {
    checkOwner();
    if (uid) {
      if (!ready)
        throw new Error(
          "Wait for your account library to load, then try again.",
        );
      return track(setDoc(reference(kind, item.id), cleanRecord(item)));
    }
    try {
      if (kind === "scores") await saveLocalRound(item);
      const next = [
        ...localRef.current[kind].filter((x) => x.id !== item.id),
        item,
      ];
      if (kind !== "scores")
        localStorage.setItem(`slowfolk-${kind}`, JSON.stringify(next));
      localRef.current[kind] = next;
      ({ loops: setLoops, links: setLinks, scores: setScores })[kind](next);
    } catch (failure) {
      setError("Browser storage is unavailable. This item could not be saved.");
      throw failure;
    }
  };
  const remove = async (kind, id) => {
    checkOwner();
    if (uid) return track(deleteDoc(reference(kind, id)));
    const next = localRef.current[kind].filter((x) => x.id !== id);
    try {
      localStorage.setItem(`slowfolk-${kind}`, JSON.stringify(next));
    } catch (failure) {
      setError(
        "Browser storage is unavailable. The item could not be deleted.",
      );
      throw failure;
    }
    localRef.current[kind] = next;
    ({ loops: setLoops, links: setLinks })[kind](next);
  };
  const flushPreferences = () => {
    clearTimeout(timer.current);
    const patch = updates.current;
    updates.current = {};
    setQueued(false);
    if (!Object.keys(patch).length) return Promise.resolve();
    checkOwner();
    return track(
      setDoc(reference("settings", "preferences"), patch, { merge: true }),
    );
  };
  const setPreference = (key, change) => {
    if (!ready || !alive.current) return;
    const value =
      typeof change === "function" ? change(prefRef.current[key]) : change;
    if (!validPreference(key, value) || prefRef.current[key] === value) return;
    const next = { ...prefRef.current, [key]: value };
    prefRef.current = next;
    setPreferences(next);
    if (!uid) {
      try {
        localStorage.setItem("slowfolk-preferences", JSON.stringify(next));
      } catch {
        setError("Preferences could not be saved in this browser.");
      }
      return;
    }
    updates.current[key] = value;
    setQueued(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      flushPreferences().catch(() => {});
    }, 350);
  };

  // Browser-close warnings only while a cloud write is queued or unacknowledged.
  useEffect(() => {
    if (!uid || (!pending && !queued)) return;
    const beforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [uid, pending, queued]);

  const login = async () => {
    if (!auth) return;
    setBusy(true);
    setAuthError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (failure) {
      setAuthError(errorMessage(failure));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const logout = async () => {
    setBusy(true);
    try {
      await flushPreferences();
      await Promise.all([...writes.current]);
      checkOwner();
      await signOut(auth);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const importLocal = async () => {
    checkOwner();
    if (!uid || !ready) return;
    setBusy(true);
    setError("");
    try {
      const localLinks = readLocal("slowfolk-links", []);
      const source = {
        loops: readSaved(),
        links: Array.isArray(localLinks) ? localLinks : [],
        scores: await listRounds(),
      };
      checkOwner();
      const items = Object.entries(source).flatMap(([kind, values]) =>
        values
          .filter(
            (value) =>
              !localRef.current[kind].some(
                (existing) => existing.id === value.id,
              ),
          )
          .map((value) => [kind, value]),
      );
      for (let offset = 0; offset < items.length; offset += 400) {
        checkOwner();
        const batch = writeBatch(db);
        items
          .slice(offset, offset + 400)
          .forEach(([kind, value]) =>
            batch.set(reference(kind, value.id), cleanRecord(value)),
          );
        await track(batch.commit());
      }
      return items.length;
    } catch (failure) {
      if (alive.current) setError(errorMessage(failure));
      throw failure;
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const cloudPending =
    pending > 0 ||
    queued ||
    Object.values(metadata).some((m) => m.hasPendingWrites);
  const status = session.loading
    ? "Checking sign-in…"
    : !uid
      ? "Saved on this device"
      : error
        ? "Cloud saving needs attention"
        : cloudPending
          ? "Saving… keep this tab open"
          : !ready
            ? "Opening your cloud library…"
            : Object.values(metadata).some((m) => m.fromCache)
              ? "Offline · reconnect to sync"
              : "Saved to your account";
  return (
    <AccountContext.Provider
      value={{
        user,
        ready,
        busy,
        error: authError || error,
        status,
        loops,
        links,
        scores,
        preferences,
        setPreference,
        available: !!auth,
        login,
        logout,
        importLocal,
        save,
        remove,
        retry: () => {
          setAuthError("");
          setRetry((n) => n + 1);
        },
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}
