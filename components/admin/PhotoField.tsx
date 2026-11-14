"use client";
import { useEffect, useId, useRef, useState } from "react";
import Mugshot from "@/components/ui/Mugshot";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const PHOTO_MAX = 5 * 1024 * 1024;

/** Pesan kalau file-nya gak bisa dipakai, atau null kalau aman. Sama dengan batas bucket di schema.sql. */
export function photoProblem(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return "Format foto harus JPG, PNG, WebP, atau GIF.";
  if (file.size > PHOTO_MAX) return `Ukuran foto ${(file.size / 1024 / 1024).toFixed(1)} MB. Maksimal 5 MB, kecilin dulu.`;
  return null;
}

/** Perubahan foto yang belum disimpan: file baru, minta dihapus, atau gak diapa-apain. */
export type PhotoChange = { file: File | null; remove: boolean };
export const NO_PHOTO_CHANGE: PhotoChange = { file: null, remove: false };

type Props = {
  label: string;
  /** nama pemilik foto, buat huruf pengganti kalau belum ada foto */
  name: string;
  /** foto yang sekarang tersimpan */
  currentUrl?: string | null;
  value: PhotoChange;
  onChange: (next: PhotoChange) => void;
  /** logo: kotak, gak dipotong. portrait: foto orang, dipotong pas. wide: banner lebar */
  shape?: "logo" | "portrait" | "wide";
  /** teks bantuan kalau foto gak diubah */
  hint?: string;
  disabled?: boolean;
};

/**
 * Pilih / ganti / hapus foto dengan pratinjau, di dalam form.
 * Gak langsung nyimpan: perubahan baru kepakai waktu form-nya disimpan, jadi Batal beneran batal.
 */
export default function PhotoField({ label, name, currentUrl, value, onChange, shape = "portrait", disabled = false, hint }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // pratinjau file yang baru dipilih (alamat sementara di browser, dilepas lagi kalau udah gak dipakai)
  useEffect(() => {
    if (!value.file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);

  const shown = value.file ? preview : value.remove ? null : currentUrl ?? null;
  const hasAny = !!shown;

  function pick(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    const problem = photoProblem(file);
    if (problem) return setError(problem);
    setError(null);
    onChange({ file, remove: false });
  }

  return (
    <div className={`photo-field is-${shape}`}>
      <span className="photo-field-preview">
        {shape === "wide" && !shown
          ? <span className="photo-field-empty">Belum ada foto</span>
          : <Mugshot name={name || "?"} url={shown} size="xl" empty="initial" key={shown ?? "kosong"} />}
      </span>
      <div className="photo-field-main">
        <span className="photo-field-label" id={id + "l"}>{label}</span>
        <div className="row-actions">
          <label className={"btn ghost sm" + (disabled ? " is-disabled" : "")}>
            {hasAny ? "Ganti foto" : "Pilih foto"}
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept={PHOTO_TYPES.join(",")}
              disabled={disabled}
              aria-labelledby={id + "l"}
              aria-describedby={id + "h" + (error ? " " + id + "e" : "")}
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>
          {hasAny && (
            <button type="button" className="btn ghost sm" disabled={disabled} onClick={() => { setError(null); onChange({ file: null, remove: !!currentUrl }); }}>
              Hapus foto
            </button>
          )}
          {(value.file || value.remove) && (
            <button type="button" className="link-btn" disabled={disabled} onClick={() => { setError(null); onChange(NO_PHOTO_CHANGE); }}>
              Batalin perubahan foto
            </button>
          )}
        </div>
        <p className="hint" id={id + "h"}>
          {value.file
            ? `Foto baru: ${value.file.name}. Kesimpan waktu form ini disimpan.`
            : value.remove
              ? "Foto dihapus waktu form ini disimpan."
              : hint ?? "JPG, PNG, WebP, atau GIF. Maksimal 5 MB."}
        </p>
        {error && <p className="field-err" id={id + "e"} role="alert">{error}</p>}
      </div>
    </div>
  );
}
