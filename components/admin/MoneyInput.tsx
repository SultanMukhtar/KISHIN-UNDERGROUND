"use client";
import { useLayoutEffect, useRef } from "react";

/** "750.000" / "750000" / "¥750.000" → 750000. Kosong atau bukan angka → null. */
export function parseMoney(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** 750000 → "750.000" (titik pemisah ribuan ala Indonesia). */
export const formatMoney = (n: number) => Math.round(n).toLocaleString("id-ID");

const group = (digits: string) => digits.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

type Props = {
  /** teks yang lagi tampil, udah berformat ("750.000"). Simpan di state pemanggil. */
  value: string;
  onChange: (formatted: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** jumlah digit maksimal (bawaan 10 = sampai miliaran) */
  maxDigits?: number;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

/**
 * Isian uang (Yen RP): cuma nerima angka, titik ribuan muncul sendiri sambil ngetik,
 * jadi 750000 dan 7500000 langsung kelihatan bedanya. Di HP keluar papan angka.
 */
export default function MoneyInput({ value, onChange, maxDigits = 10, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  // posisi kursor dihitung dari jumlah digit di kirinya, biar gak loncat ke ujung waktu titik nambah
  const caretDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const want = caretDigits.current;
    if (!el || want === null || document.activeElement !== el) return;
    caretDigits.current = null;
    let pos = 0;
    for (let seen = 0; pos < el.value.length && seen < want; pos++) if (/\d/.test(el.value[pos])) seen++;
    el.setSelectionRange(pos, pos);
  }, [value]);

  return (
    <span className="money">
      <span className="money-sign" aria-hidden="true">¥</span>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          const el = e.target;
          const before = el.value.slice(0, el.selectionStart ?? el.value.length);
          caretDigits.current = before.replace(/[^\d]/g, "").length;
          onChange(group(el.value.replace(/[^\d]/g, "").slice(0, maxDigits)));
        }}
        {...rest}
      />
    </span>
  );
}
