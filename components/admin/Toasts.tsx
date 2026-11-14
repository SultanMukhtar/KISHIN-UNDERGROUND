"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type Toast = { id: number; text: string; err: boolean };

const SUCCESS_MS = 4500;
const MAX_SHOWN = 4;

/**
 * Pemberitahuan panel panitia: nempel di pojok bawah layar, jadi tetap kelihatan
 * walau tombol yang diklik ada jauh di bawah halaman.
 * - Berhasil: hilang sendiri (berhenti ngitung selama disorot / difokus).
 * - Gagal: tetap ada sampai ditutup.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const notify = useCallback((text: string, err = false) => {
    const id = ++seq.current;
    setToasts((list) => {
      // pesan yang sama persis gak ditumpuk: yang lama diganti
      const rest = list.filter((t) => !(t.text === text && t.err === err));
      const next = [...rest, { id, text, err }];
      // kebanyakan → buang pesan berhasil yang paling lama dulu, pesan gagal dipertahankan
      while (next.length > MAX_SHOWN) {
        const i = next.findIndex((t) => !t.err);
        next.splice(i === -1 ? 0 : i, 1);
      }
      return next;
    });
  }, []);

  return { toasts, notify, dismiss };
}

export default function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toasts" role="region" aria-label="Pemberitahuan">
      {/* pesan berhasil dibacain sopan; pesan gagal langsung (role=alert di item-nya) */}
      <div className="toasts-list" aria-live="polite">
        {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />)}
      </div>
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (toast.err || hold) return;
    const t = setTimeout(() => onDismiss(toast.id), SUCCESS_MS);
    return () => clearTimeout(t);
  }, [toast.id, toast.err, hold, onDismiss]);

  return (
    <div
      className={"toast" + (toast.err ? " is-err" : "")}
      role={toast.err ? "alert" : undefined}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <span className="toast-tag">{toast.err ? "Gagal" : "Beres"}</span>
      <p className="toast-text">{toast.text}</p>
      <button type="button" className="toast-x" onClick={() => onDismiss(toast.id)} aria-label="Tutup pemberitahuan">
        <span aria-hidden="true" />
      </button>
    </div>
  );
}
