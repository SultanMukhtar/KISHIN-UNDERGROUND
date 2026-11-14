"use client";
import { useId, useRef, useState } from "react";
import Reveal from "@/components/ui/Reveal";
import Stamp from "@/components/ui/Stamp";
import Barcode from "@/components/ui/Barcode";
import { tornClip } from "@/lib/codes";
import { ruleBook } from "@/lib/rules";
import type { Settings } from "@/lib/types";

/** Dokumen peraturan (kertas sobek): lima bab, pindah bab lewat tab di pinggir. */
export default function Rules({ settings }: { settings: Settings | null }) {
  const book = ruleBook(settings);
  const [at, setAt] = useState(0);
  const uid = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const group = book[at];

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    const next = e.key === "Home" ? 0 : e.key === "End" ? book.length - 1 : step ? (at + step + book.length) % book.length : null;
    if (next === null) return;
    e.preventDefault();
    setAt(next);
    tabs.current[next]?.focus();
  };

  return (
    <Reveal className="rules" kind="up">
      <div className="rules-doc" style={{ clipPath: tornClip("rules-doc", { top: true, bottom: true, left: true, right: true }, 7, 34) }}>
        <span className="tape tape-a" aria-hidden="true" />
        <span className="tape tape-b" aria-hidden="true" />
        <header className="rules-head">
          <p className="rules-file">Dokumen internal panitia</p>
          <Barcode value="rules-and-regulations" className="rules-bar" />
          <Stamp tone="red" tilt={-7} className="rules-stamp">
            <span className="jp">極秘</span>
            <span className="stamp-sub">Rahasia</span>
          </Stamp>
        </header>

        <div className="rules-body">
          <div className="rules-tabs" role="tablist" aria-label="Bab peraturan" aria-orientation="vertical" onKeyDown={onKey}>
            {book.map((g, i) => (
              <button
                key={g.code}
                ref={(el) => { tabs.current[i] = el; }}
                type="button"
                role="tab"
                id={`${uid}t${i}`}
                aria-selected={at === i}
                aria-controls={`${uid}p`}
                tabIndex={at === i ? 0 : -1}
                className={"rules-tab" + (at === i ? " is-on" : "")}
                onClick={() => setAt(i)}
              >
                <b>{g.code}</b>
                <span>{g.title}</span>
              </button>
            ))}
          </div>

          <div className="rules-panel" role="tabpanel" id={`${uid}p`} aria-labelledby={`${uid}t${at}`} tabIndex={0} key={at}>
            <h3 className="rules-title">{group.title}</h3>
            <ol className="rules-list">
              {group.items.map((it, i) => <li key={i}>{it}</li>)}
            </ol>
          </div>
        </div>

        <p className="rules-warn" role="note">
          Lokasi dan jadwal cuma dikasih tahu dari mulut ke mulut. Jangan sebar link ini sembarangan.
        </p>
      </div>
    </Reveal>
  );
}
