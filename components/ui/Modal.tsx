"use client";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { tornClip } from "@/lib/codes";

type Props = {
  onClose: () => void;
  /** id elemen judul di dalam modal */
  labelledBy: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Modal di atas <dialog> bawaan browser: fokus terkurung di dalam, Escape nutup,
 * fokus balik ke tombol yang ngebuka. Masuk: fade + naik skala dikit. Keluar: kebalikannya.
 */
export default function Modal({ onClose, labelledBy, className = "", children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const downOnBackdrop = useRef(false);
  const closing = useRef(false);

  useLayoutEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  const requestClose = useCallback(() => {
    const d = ref.current;
    if (!d || closing.current) return;
    closing.current = true;
    const done = () => {
      if (d.open) d.close();
      onClose();
    };
    d.classList.add("is-closing"); // geraknya (skala / cuma pudar) diatur CSS
    setTimeout(done, 170);
  }, [onClose]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault(); // Escape: tutup lewat animasi keluar
      requestClose();
    };
    d.addEventListener("cancel", onCancel);
    return () => d.removeEventListener("cancel", onCancel);
  }, [requestClose]);

  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={labelledBy}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (e.target === ref.current && downOnBackdrop.current) requestClose();
      }}
    >
      <div className="modal-box" style={{ clipPath: tornClip("sheet:" + labelledBy.length + className, { top: true, bottom: true }, 5, 30) }}>
        <button type="button" className="modal-x" onClick={requestClose} aria-label="Tutup">
          <span aria-hidden="true" />
        </button>
        {children}
      </div>
    </dialog>
  );
}
