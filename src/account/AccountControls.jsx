import React, { useEffect, useRef, useState } from "react";
import { Cloud, LogIn, LogOut, X } from "lucide-react";
import { useAccount } from "./AccountProvider";
import "./account.css";

export default function AccountControls() {
  const account = useAccount();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const dialog = useRef(null);
  useEffect(() => {
    if (open) dialog.current.showModal();
  }, [open]);
  return (
    <>
      <button className="account-button" onClick={() => setOpen(true)}>
        {account.user ? <Cloud size={16} /> : <LogIn size={16} />}
        <span>{account.user ? "My account" : "Sign in"}</span>
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="modal account-dialog"
          onCancel={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === dialog.current) setOpen(false);
          }}
        >
          <div className="modal-heading">
            <h2>
              {account.user ? "Your practice, everywhere." : "Keep your place."}
            </h2>
            <button
              className="icon-button"
              aria-label="Close account"
              onClick={() => setOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          {account.user ? (
            <>
              <p>
                Signed in as{" "}
                <strong>
                  {account.user.displayName || account.user.email}
                </strong>
              </p>
              {account.user.displayName && (
                <p className="subtle">{account.user.email}</p>
              )}
              <p role="status">{account.status}</p>
              <div className="account-import">
                <h3>Bring your local practice with you</h3>
                <p>
                  Copy this browser’s saved phrases, YouTube tunes, and
                  completed scores into this account. Existing account items are
                  kept. Local copies remain on this device.
                </p>
                <p className="fine-print">
                  Audio files and recording drafts stay on this device. Account
                  preferences are kept separately.
                </p>
                <button
                  className="secondary-button"
                  disabled={account.busy || !account.ready}
                  onClick={async () => {
                    setMessage("");
                    try {
                      const count = await account.importLocal();
                      setMessage(
                        count
                          ? `Copied ${count} items to your account.`
                          : "Your local items are already in this account, or there are none to copy.",
                      );
                    } catch {
                      /* The shared error notice explains the failure. */
                    }
                  }}
                >
                  {account.busy
                    ? "Please wait…"
                    : "Copy local data to this account"}
                </button>
                {message && <p role="status">{message}</p>}
              </div>
              <button
                className="text-button"
                disabled={account.busy}
                onClick={account.logout}
              >
                <LogOut size={16} /> Sign out
              </button>
            </>
          ) : (
            <>
              <p>
                Sign in with Google to save your phrases, YouTube tunes,
                practice settings, and game scores across devices.
              </p>
              <p>
                You can keep practicing without an account. Existing local data
                is only copied when you choose to import it.
              </p>
              {account.available ? (
                <button
                  className="primary modal-submit"
                  disabled={account.busy || !account.ready}
                  onClick={account.login}
                >
                  <LogIn size={18} />
                  {account.busy ? "Signing in…" : "Continue with Google"}
                </button>
              ) : (
                <p className="account-setup">
                  Google sign-in hasn’t been configured for this site yet. Your
                  practice can still be saved in this browser.
                </p>
              )}
            </>
          )}
          {account.error && (
            <p className="error-message" role="alert">
              {account.error}
            </p>
          )}
        </dialog>
      )}
    </>
  );
}

export function AccountStatus() {
  const account = useAccount();
  if (!account.user && !account.error) return null;
  return (
    <div className="account-status" role="status">
      <Cloud size={16} />
      <span>{account.error || account.status}</span>
      {account.error && (
        <button className="text-button" onClick={account.retry}>
          Retry connection
        </button>
      )}
    </div>
  );
}
