# Underground — Website + Panel Panitia

Website live buat event underground fight di Kishin High School (Roblox RP).

- **`/`** → halaman penonton: poster "Pertandingan Hari Ini", podium juara, bracket per ronde, odds taruhan. Update otomatis tanpa refresh.
- **`/admin`** → panel panitia (login username + password): pendaftaran + upload foto, generate bracket otomatis, catat taruhan & payout, pengaturan event, kelola akun admin.

Stack: Next.js (hosting di Vercel) + Supabase (database, login, penyimpanan foto). Dua-duanya gratis.

---

## 1. Setup Supabase (± 5 menit)

1. Buka [supabase.com](https://supabase.com) → **New project** (paket Free). Simpan password database-nya.
2. Masuk ke **SQL Editor** → **New query** → copy-paste seluruh isi `supabase/schema.sql` → **Run**.
   Aman di-Run ulang kalau ada versi baru (data gak kehapus).
3. (Disarankan) **Authentication → Sign In / Providers** → matikan **Allow new users to sign up**.
4. Ambil 3 kunci di **Project Settings**:

   | Variabel | Isinya | Ambil di |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL (`https://xxxx.supabase.co`) | Data API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (`sb_publishable_...`) | API Keys |
   | `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_...`) | API Keys |

   Secret key **wajib tanpa** awalan `NEXT_PUBLIC_` — cuma dibaca server (buat login & kelola akun), gak pernah dikirim ke browser.
   Jangan pernah taruh secret key di variabel yang diawali `NEXT_PUBLIC_`.

## 2. Upload ke GitHub

1. Bikin repo baru di [github.com/new](https://github.com/new) (boleh private).
2. Klik **uploading an existing file**, drag semua isi folder project ini (bukan folder-nya), lalu **Commit**.
   **Jangan** ikut upload `.env`, `.env.local`, dan `node_modules`.

## 3. Deploy ke Vercel

1. Buka [vercel.com/new](https://vercel.com/new) → login pakai GitHub → **Import** repo tadi.
2. Buka **Environment Variables**, tambahkan 3 variabel di tabel atas.
3. **Deploy**. Selesai — link-nya misal `https://kishin-1c-fight.vercel.app`.

Kalau nanti ganti environment variable, jalankan **Redeploy** di Vercel biar kepake.

## 4. Bikin akun superadmin (sekali aja)

Buka `/admin`. Selama belum ada superadmin, halaman ini nampilin form **Bikin akun superadmin**:
username (udah keisi `Hito Kassa`), email kamu (cuma buat sistem Supabase, gak dipakai login), dan password.
Setelah itu form ini hilang selamanya dan `/admin` jadi halaman login biasa (**username + password**).

> Lakukan langkah ini **langsung** setelah Supabase siap (boleh dari komputer sendiri lewat `jalankan-lokal.bat`),
> sebelum link website dibagiin — siapa pun yang duluan buka form ini yang jadi superadmin.

## Akun & hak akses

| | Superadmin (Hito Kassa) | Admin |
|---|---|---|
| Pendaftaran, isi pemenang, "Tampil hari ini", catat taruhan | ✓ | ✓ |
| Generate / buat ulang bracket | ✓ | – |
| Ubah house cut per match, lihat untung kas | ✓ | – |
| Pengaturan (hero, biaya daftar, house cut default) | ✓ | – |
| Akun Admin: tambah, hapus, ganti password | ✓ | – |

- Akun admin dibikin superadmin di `/admin` → **Akun Admin**. Cukup username + password, email internalnya dibikin otomatis dari email superadmin (`kamu+adm-...@gmail.com`), gak ada email yang dikirim.
- Superadmin gak bisa dihapus. Superadmin bisa ganti password akun mana pun, termasuk punya sendiri.
- Akun yang dihapus langsung gak bisa ngedit apa pun, walaupun masih kebuka di HP-nya.

---

## Cara pakai di hari-H

| Tugas | Siapa | Di mana |
|---|---|---|
| Daftarin fighter, upload foto, tandai sudah bayar | Finance Registration | `/admin` → Pendaftaran |
| Generate bracket (setelah pendaftaran ditutup) | Superadmin | `/admin` → Bracket → **Generate bracket** |
| Centang "Tampil hari ini" buat match yang dipanggil ke arena | Bracket Coordinator / MC | `/admin` → Bracket |
| Catat taruhan (nama, rekening/Yentag, jagoan, nominal) sebelum fight mulai | Finance Betting | `/admin` → Taruhan |
| Klik **Menang** di fighter yang menang (KO) | Referee / Bracket Coordinator | `/admin` → Bracket |
| Bayar bettor yang menang, centang "Sudah dibayar" | Finance Betting | `/admin` → Taruhan |

Catatan:
- Bracket cuma pakai fighter yang statusnya **Sudah bayar**. Jumlah ganjil gak masalah — sisa slot jadi BYE (lolos otomatis).
- Pemenang otomatis maju ke ronde berikutnya. Yang kalah di semifinal otomatis masuk **Perebutan Juara 3**. Salah klik? Klik tombol **Menang ✓** lagi buat batal.
- **Buat ulang bracket** menghapus semua match DAN semua taruhan. Lakukan cuma sebelum taruhan dibuka.
- Taruhan otomatis ditutup begitu pemenang match diisi.

## Foto

- Foto disimpan di Supabase Storage (bucket `photos`), maks 5 MB per file.
- Foto **diganti**, **dihapus**, atau fighter-nya **dihapus** → file fotonya ikut dihapus dari storage, gak numpuk.
- Kalau pendaftaran gagal (misal nama dobel), foto yang terlanjur ke-upload langsung dibuang.
- Jaga-jaga (superadmin): `/admin` → Pengaturan → **Cari & hapus foto nganggur** buat bersihin file yang gak dipakai siapa pun.

## Tampilan

- **Font**: Archivo (judul raksasa & teks), Big Shoulders Stencil (nomor fight & kode ID), Dela Gothic One buat kanji (cuma karakter yang dipakai, 4 KB, file `public/fonts/kanji.woff2`, lisensi OFL ada di `public/fonts`). Semua di-host sendiri, gak ngambil dari Google Fonts.
- **Tekstur** beton, karat, goresan, pagar kawat, rantai, kertas, dan grain: SVG buatan sendiri di `public/tex`.
- **Foto fighter** otomatis jadi hitam-putih kontras tinggi + raster halftone, jadi foto Roblox yang warna-warni tetap nyatu sama gaya fotokopian.
- Fighter yang belum punya foto tampil sebagai siluet, jadi gak ada kotak kosong.

## Sistem taruhan

- Yang menang: **modal balik utuh + bagian dari uang pihak yang kalah**, dibagi sesuai besar taruhan.
- **House cut** (default 20%, bisa diubah per match oleh superadmin) cuma dipotong dari uang pihak yang kalah.
- Kalau gak ada yang taruh ke fighter yang menang, seluruh uang pihak kalah masuk kas panitia.
- Pecahan Yen dibulatkan ke bawah ke bettor; sisanya masuk kas panitia.

## Jalankan di komputer sendiri (opsional)

Windows: double-click **`jalankan-lokal.bat`**. Kalau belum ada `.env`/`.env.local`, dia minta 3 kunci Supabase. Kalau udah ada tapi belum punya `SUPABASE_SECRET_KEY`, dia minta secret key aja lalu nambahin ke file itu. Habis itu install paket dan buka http://localhost:3000/admin.

Manual:

```bash
npm install
cp .env.example .env.local   # isi 3 kunci Supabase
npm run dev                  # buka http://localhost:3000
```
