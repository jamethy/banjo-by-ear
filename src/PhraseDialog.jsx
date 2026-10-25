import React, { useState } from "react";
import Modal from "./Modal";

export default function PhraseDialog({ item, account, close, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dismiss = () => {
    if (!busy) close();
  };
  const remove = async (event) => {
    event.preventDefault();
    if (busy || !account.ready) return;
    setBusy(true);
    setError("");
    try {
      await account.remove("loops", item.id);
      onDeleted();
      close();
    } catch {
      setError("The phrase could not be deleted. Please try again.");
      setBusy(false);
    }
  };
  return (
    <Modal title="Delete this phrase?" close={dismiss}>
      <p className="modal-copy">
        Delete “{item.name}” from {item.title}? This cannot be undone.
      </p>
      <form onSubmit={remove}>
        {error && (
          <p className="phrase-dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="phrase-dialog-actions">
          <button
            type="button"
            className="secondary-button"
            autoFocus
            disabled={busy}
            onClick={dismiss}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary phrase-confirm-delete"
            disabled={busy || !account.ready}
          >
            {busy ? "Deleting…" : "Delete phrase"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
