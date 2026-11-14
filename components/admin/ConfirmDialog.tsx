"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";

export type ConfirmOptions = {
  /** pertanyaan singkat, misal "Hapus sponsor Warung Bu Tini?" */
  title: string;
  /** satu kalimat penjelasan (opsional) */
  body?: React.ReactNode;
  /** akibatnya, satu baris per hal yang hilang / berubah */
  points?: string[];
  /** tombol konfirmasi nyebut aksinya, misal "Hapus sponsor" (bukan "OK") */
  confirmLabel: string;
  cancelLabel?: string;
  /** danger = aksi yang ngapus / gak bisa dibatalin (tombol merah, fokus awal di Batal) */
  tone?: "danger" | "default";
  /** buat aksi yang ngapus banyak data sekaligus: panitia harus ngetik kata ini dulu */
  typeToConfirm?: string;
};

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

/**
 * Pengganti window.confirm di panel panitia: dialog bergaya panel, nyebut jelas apa yang hilang,
 * dan gak bisa diblokir browser. Pakai: const { confirm, host } = useConfirm(); render {host} sekali.
 */
export function useConfirm(): { confirm: ConfirmFn; host: React.ReactNode } {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const confirm = useCallback<ConfirmFn>((options) => {
    // dialog lain masih kebuka → yang lama dianggap batal
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => setPending({ options, resolve }));
  }, []);

  const settle = useCallback((ok: boolean) => {
    const p = pendingRef.current;
    if (!p) return;
    setPending(null);
    p.resolve(ok);
  }, []);

  // panel ditutup selagi dialog kebuka → jangan gantung
  useEffect(() => () => pendingRef.current?.resolve(false), []);

  const host = pending ? <ConfirmDialog options={pending.options} onDone={settle} /> : null;
  return { confirm, host };
}

function ConfirmDialog({ options: o, onDone }: { options: ConfirmOptions; onDone: (ok: boolean) => void }) {
  const id = useId();
  const danger = o.tone === "danger";
  const [typed, setTyped] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const need = o.typeToConfirm?.trim() ?? "";
  const ready = !need || typed.trim().toUpperCase() === need.toUpperCase();

  // fokus awal: isian ketik (kalau ada) → Batal buat aksi berbahaya → tombol konfirmasi buat yang aman
  useEffect(() => {
    (need ? inputRef.current : danger ? cancelRef.current : okRef.current)?.focus();
  }, [need, danger]);

  return (
    <Modal onClose={() => onDone(false)} labelledBy={id + "t"} className={"admin-modal confirm" + (danger ? " is-danger" : "")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onDone(true);
        }}
        aria-describedby={o.body || o.points?.length ? id + "d" : undefined}
      >
        <h3 id={id + "t"}>{o.title}</h3>
        <div id={id + "d"}>
          {o.body && <p className="confirm-body">{o.body}</p>}
          {o.points && o.points.length > 0 && (
            <ul className="confirm-points">
              {o.points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          )}
        </div>
        {need && (
          <label className="f confirm-type">
            Ketik {need} buat lanjut
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </label>
        )}
        <div className="row-actions admin-modal-actions">
          <button ref={okRef} type="submit" className={"btn" + (danger ? " danger is-solid" : "")} disabled={!ready}>{o.confirmLabel}</button>
          <button ref={cancelRef} type="button" className="btn ghost" onClick={() => onDone(false)}>{o.cancelLabel ?? "Batal"}</button>
        </div>
      </form>
    </Modal>
  );
}
