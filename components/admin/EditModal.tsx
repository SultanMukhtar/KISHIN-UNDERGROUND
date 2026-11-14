"use client";
import { useEffect, useId, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";

type Props = {
  title: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  busy?: boolean;
  submitLabel?: string;
  /** tombol simpan dimatiin (misal isian wajib belum lengkap) */
  submitDisabled?: boolean;
  /** pesan gagal simpan, tampil di dalam popup (notifikasi halaman ketutup popup) */
  error?: string | null;
  /** aksi tambahan di pojok kanan bawah, misal tombol hapus */
  extra?: React.ReactNode;
  /** perubahan yang gak lewat isian biasa (misal foto dihapus) → anggap ada yang belum disimpan */
  changed?: boolean;
  children: React.ReactNode;
};

/**
 * Popup edit di panel panitia: form-nya muncul di atas halaman,
 * jadi tabel dan form lain gak geser atau loncat ke atas.
 * Lagi nyimpan → gak bisa ditutup. Ada isian yang berubah → ditanya dulu sebelum dibuang.
 */
export default function EditModal({ title, onClose, onSubmit, busy = false, submitLabel = "Simpan", submitDisabled = false, error = null, extra, changed = false, children }: Props) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [typed, setDirty] = useState(false);
  const dirty = typed || changed;
  const [askDiscard, setAskDiscard] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);

  // langsung bisa ngetik: fokus ke isian pertama (bukan tombol tutup)
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>("input:not(.sr-only), select, textarea")?.focus();
  }, []);

  useEffect(() => {
    if (askDiscard) keepRef.current?.focus();
  }, [askDiscard]);

  const canClose = () => {
    if (busy) return false;
    if (dirty) {
      setAskDiscard(true);
      return false;
    }
    return true;
  };

  return (
    <Modal onClose={onClose} labelledBy={id} className="admin-modal" canClose={canClose}>
      <form
        ref={formRef}
        onChange={() => { setDirty(true); setAskDiscard(false); }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && !submitDisabled) onSubmit();
        }}
      >
        <h3 id={id}>{title}</h3>
        {children}
        {error && <div className="notice err admin-modal-err" role="alert">{error}</div>}
        {askDiscard ? (
          <div className="discard" role="alert">
            <p>Perubahan di popup ini belum disimpan.</p>
            <div className="row-actions">
              <button ref={keepRef} type="button" className="btn" onClick={() => setAskDiscard(false)}>Lanjut edit</button>
              <button type="button" className="btn danger" onClick={onClose}>Buang perubahan</button>
            </div>
          </div>
        ) : (
          <div className="row-actions admin-modal-actions">
            <button className="btn" disabled={busy || submitDisabled}>{busy ? "Menyimpan…" : submitLabel}</button>
            <button type="button" className="btn ghost" onClick={() => canClose() && onClose()} disabled={busy}>Batal</button>
            {extra && <span className="admin-modal-extra">{extra}</span>}
          </div>
        )}
      </form>
    </Modal>
  );
}
