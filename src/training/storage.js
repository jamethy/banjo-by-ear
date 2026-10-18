const DATABASE = "slowfolk-ear-training";
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore("recordings", { keyPath: "id" });
      database.createObjectStore("rounds", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Close other Slowfolk tabs and try again."));
  });
}
async function transaction(storeName, mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, mode);
    const request = operation(tx.objectStore(storeName));
    tx.oncomplete = () => {
      database.close();
      resolve(request.result);
    };
    tx.onabort = tx.onerror = () => {
      database.close();
      reject(tx.error || new Error("Browser storage could not be updated."));
    };
  });
}
export const listRecordings = () =>
  transaction("recordings", "readonly", (store) => store.getAll());
export const saveRecording = (sample) =>
  transaction("recordings", "readwrite", (store) => store.put(sample));
export const deleteRecording = (id) =>
  transaction("recordings", "readwrite", (store) => store.delete(id));
export const listRounds = () =>
  transaction("rounds", "readonly", (store) => store.getAll());
export const saveRound = (round) =>
  transaction("rounds", "readwrite", (store) => store.put(round));

export function inspectAudio(file) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    const clean = () => {
      audio.onloadedmetadata = audio.onerror = null;
      clearTimeout(timer);
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
    };
    const timer = setTimeout(() => {
      clean();
      reject(
        new Error(
          "This recording took too long to load. Try an MP3 or WAV file.",
        ),
      );
    }, 12000);
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      clean();
      Number.isFinite(duration) && duration > 0
        ? resolve(duration)
        : reject(new Error("This recording has no playable duration."));
    };
    audio.onerror = () => {
      clean();
      reject(
        new Error("This browser cannot play that file. Try MP3, WAV, or M4A."),
      );
    };
    audio.src = url;
  });
}
