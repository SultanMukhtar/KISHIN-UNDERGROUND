# Underground — Website + Panel Panitia

Website live buat event underground fight di Kishin High School (Roblox RP).
Semua fight, taruhan, dan uang di sini fiksi (mata uang RP).

- **`/`** → halaman penonton, satu halaman panjang:
  layar pembuka → hero + angka live → ticker fight → **Lagi di ring** (poster + fight berikutnya) → **Bracket** (pohon turnamen) → **Meja taruhan** (pool, kelipatan, cek slip) → **Fight history** (arsip) → **Juara** → **Aturan**.
  Update otomatis tanpa refresh.
- **`/admin`** → panel panitia (login username + password): pendaftaran & profil fighter, bracket, status / hasil fight, laga tambahan, taruhan & payout, arsip, turnamen, pengaturan, akun admin.

Stack: Next.js (hosting di Vercel) + Supabase (database, login, penyimpanan foto). Dua-duanya gratis. Gak ada library animasi tambahan: geraknya CSS + sedikit JavaScript.

---

## Udah pernah setup sebelumnya? Update database dulu

Versi ini nambah tabel dan kolom baru (status fight, cara menang, turnamen, arsip, riwayat transaksi).

1. Supabase → **SQL Editor** → **New query** → copy-paste **seluruh** isi `supabase/schema.sql` → **Run**.
2. Selesai. Data lama aman: fighter, bracket, dan taruhan gak ada yang kehapus. Match yang lagi "Tampil hari ini" otomatis jadi **LIVE**, bracket yang ada masuk ke turnamen pertama (`<nama event> Vol. 1`).

Selama langkah ini belum dijalanin, website tetap jalan kayak versi lama (tanpa status fight, arsip, dan turnamen), dan panel panitia nampilin peringatan "Database belum di-update".

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

   Kalau yang ke-paste di `NEXT_PUBLIC_SUPABASE_URL` ternyata link dashboard (`https://supabase.com/dashboard/project/xxxx`), website otomatis ngubahnya jadi `https://xxxx.supabase.co`. Tetap lebih baik diisi Project URL yang benar.

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
| Pendaftaran, edit profil fighter, upload foto | ✓ | ✓ |
| Mulai / tunda / batalkan fight, "Tampil hari ini" | ✓ | ✓ |
| Isi hasil resmi (pemenang, cara menang) | ✓ | ✓ |
| Catat taruhan, tutup / buka taruhan, tandai payout dibayar | ✓ | ✓ |
| Lihat arsip fight & riwayat transaksi taruhan | ✓ | ✓ |
| Generate / buat ulang bracket, ganti isi slot ronde 1, laga tambahan | ✓ | – |
| Turnamen: ganti nama, mulai turnamen baru, hapus arsip turnamen | ✓ | – |
| Ubah house cut per match, lihat untung kas | ✓ | – |
| Pengaturan (hero, biaya daftar, house cut default) | ✓ | – |
| Akun Admin: tambah, hapus, ganti password | ✓ | – |

Penonton (tanpa login) cuma bisa **baca**. Semua aturan di atas dijaga database (Row Level Security + trigger), bukan cuma disembunyiin di tampilan.

- Akun admin dibikin superadmin di `/admin` → **Akun Admin**. Cukup username + password, email internalnya dibikin otomatis dari email superadmin (`kamu+adm-...@gmail.com`), gak ada email yang dikirim.
- Superadmin gak bisa dihapus. Superadmin bisa ganti password akun mana pun, termasuk punya sendiri.
- Akun yang dihapus langsung gak bisa ngedit apa pun, walaupun masih kebuka di HP-nya.

---

## Cara pakai di hari-H

| Tugas | Siapa | Di mana |
|---|---|---|
| Daftarin fighter, upload foto, isi gaya bertarung, tandai sudah bayar | Finance Registration | `/admin` → Pendaftaran |
| Generate bracket (setelah pendaftaran ditutup) | Superadmin | `/admin` → Bracket → **Generate bracket** |
| Catat taruhan sebelum fight mulai, kasih **kode slip** ke bettor | Finance Betting | `/admin` → Taruhan (atau klik fight-nya di Meja taruhan halaman penonton) |
| Panggil fight ke ring (poster) | Bracket Coordinator / MC | `/admin` → Bracket → centang **Tampil hari ini** |
| **Mulai fight** → status LIVE, taruhan otomatis ditutup | Referee / MC | `/admin` → Bracket → **Mulai fight** |
| Pilih **cara menang**, lalu klik **Menang** di fighter yang menang | Referee | `/admin` → Bracket |
| Bayar bettor yang menang, centang "Sudah dibayar" | Finance Betting | `/admin` → Taruhan |

Yang terjadi otomatis begitu **Menang** diklik: pemenang maju ke ronde berikutnya, yang kalah di semifinal masuk **Perebutan Juara 3**, catatan fight masuk **Arsip**, rekor fighter (menang / kalah / win rate) ikut berubah, taruhan dihitung, dan halaman penonton nampilin pengumuman hasil + cap WIN / LOSS. Begitu final selesai, papan **Juara** keisi sendiri.

Catatan:
- Bracket cuma pakai fighter yang statusnya **Sudah bayar**. Jumlah ganjil gak masalah — sisa slot jadi BYE (lolos otomatis).
- Salah klik? Klik tombol **Menang ✓** lagi buat batalin hasil (ada konfirmasi). Catatan arsipnya ikut dicabut.
- Status fight: **Upcoming**, **Live**, **Completed**, **Postponed** (tombol Tunda), **Cancelled** (tombol Batalkan fight). Fight yang dibatalkan: semua taruhannya dihitung batal dan dikembalikan utuh.
- **Buat ulang bracket** menghapus semua match turnamen yang lagi jalan, catatan fight-nya, DAN semua taruhannya. Turnamen arsip gak kesentuh.
- **Laga tambahan** (superadmin): fight di luar bracket. Masuk arsip dan rekor fighter, bisa ditaruhin, tapi gak ngaruh ke bracket.

## Turnamen & arsip

- Selalu ada satu turnamen yang "jalan". Namanya diatur di `/admin` → **Turnamen**, dan tampil di papan Juara serta arsip.
- **Mulai turnamen baru** menutup turnamen sekarang dan memindahkannya ke arsip: hasil, catatan fight, dan juaranya tetap tersimpan dan tampil di halaman penonton ("Juara turnamen sebelumnya" + filter turnamen di Fight history). Bracket baru mulai kosong, fighter tetap terdaftar.
- Arsip fight (`fight_history`) diisi database sendiri tiap hasil resmi masuk. Nama fighter disalin ke situ, jadi catatan tetap kebaca walau fighter-nya dihapus.

## Sistem taruhan (mata uang RP, bukan uang asli)

- Yang menang: **modal balik utuh + bagian dari uang pihak yang kalah**, dibagi sesuai besar taruhan.
- **House cut** (default 20%, bisa diubah per match oleh superadmin) cuma dipotong dari uang pihak yang kalah.
- Kalau gak ada yang taruh ke fighter yang menang, seluruh uang pihak kalah masuk kas panitia.
- Pecahan Yen dibulatkan ke bawah ke bettor; sisanya masuk kas panitia.
- Status taruhan per fight: **Betting open** → **Betting closed** (fight mulai / ditutup panitia / fight batal) → **Settled** (hasil masuk).
- Tiap taruhan punya **kode slip** (`TX-XXXXXXXX`). Bettor bisa ngecek taruhannya sendiri di halaman penonton tanpa login: status, payout, udah ditransfer atau belum. Nama dan nominal orang lain gak pernah tampil ke publik.
- Yang dicegah database: nominal 0 / minus / kelewat besar, taruhan dobel (klik dua kali atau kirim ulang), taruhan ke fight yang udah mulai / selesai / batal / ditutup, dan jagoan yang bukan fighter di fight itu.
- Semua transaksi (dicatat, diubah, dibayar, dihapus, siapa yang ngelakuin) masuk **Riwayat transaksi** dan gak bisa diedit.
- Gak ada pembayaran uang asli atau integrasi judi apa pun. Ini murni pencatatan buat roleplay.

## Foto

- Foto disimpan di Supabase Storage (bucket `photos`), maks 5 MB per file.
- Foto **diganti**, **dihapus**, atau fighter-nya **dihapus** → file fotonya ikut dihapus dari storage, gak numpuk.
- Kalau pendaftaran gagal (misal nama dobel), foto yang terlanjur ke-upload langsung dibuang.
- Jaga-jaga (superadmin): `/admin` → Pengaturan → **Cari & hapus foto nganggur** buat bersihin file yang gak dipakai siapa pun.

## Tampilan & animasi

- **Palet**: hitam `#0A0A0A`, arang `#151515`, beton `#555555`, putih kotor `#D6D2C8`, kertas `#E8E2D5`, merah darah `#8B1018`, merah gelap `#5C1015`, abu `#85817A`. Merah cuma buat cap, status LIVE, dan yang lagi aktif.
- **Font**: Archivo (judul raksasa & teks), Big Shoulders Stencil (nomor fight, kode ID, label sistem), Dela Gothic One buat kanji (cuma karakter yang dipakai, 4 KB, file `public/fonts/kanji.woff2`, lisensi OFL ada di `public/fonts`). Semua di-host sendiri, gak ngambil dari Google Fonts.
- **Tekstur** beton, karat, goresan, pagar kawat, rantai, kertas, dan grain: SVG buatan sendiri di `public/tex`.
- **Foto fighter** otomatis jadi hitam-putih kontras tinggi + raster halftone. Fighter tanpa foto tampil sebagai siluet.
- **Animasi**: layar pembuka (sekali per tab), judul hero masuk per baris, lampu & asap, grain film, ticker, rantai, elemen masuk waktu di-scroll, garis bracket, cap WIN / LOSS, pengumuman fight mulai & hasil resmi, modal, kursor bidik (cuma mouse). Semua yang "bereaksi ke data" (LIVE, hasil, bracket maju) cuma jalan kalau datanya beneran berubah.
- **Versi kalem**: kalau perangkat pengunjung minta gerakan dikurangi (misal Windows → Settings → Accessibility → Visual effects → **Animation effects** dimatiin, atau "Reduce motion" di HP), halaman otomatis tampil versi kalem: gak ada yang geser, goyang, atau kedip, cuma pudar pelan. Di footer ada tombol **Nyalakan animasi penuh** buat yang tetap mau lihat versi lengkapnya.

## Struktur data (ringkas)

| Tabel | Isi |
|---|---|
| `settings` | Nama event, tagline, hero, biaya daftar, house cut default, turnamen yang lagi jalan |
| `fighters` | Nama, kelas, foto, gaya bertarung, status manual (aktif / cedera / skors / pensiun), status bayar |
| `tournaments` | Nama, status, babak yang lagi jalan, juara 1–3 (diisi otomatis) |
| `matches` | Posisi di bracket, dua fighter, status, pemenang, cara menang |
| `fight_history` | Catatan resmi tiap fight yang selesai (diisi otomatis) |
| `bets` | Taruhan: bettor, jagoan, nominal, status bayar |
| `bet_log` | Riwayat semua transaksi taruhan (diisi otomatis) |
| `admin_accounts` | Akun panitia + role |

Total fight, menang, kalah, win rate, status "Gugur" / "Juara", dan total pool **dihitung** dari tabel di atas (`lib/fight.ts`, `lib/betting.ts`), gak disimpan sebagai angka terpisah, jadi gak mungkin gak sinkron.

Isi dokumen **Aturan** di halaman penonton ada di `lib/rules.ts` (biaya daftar dan potongan kas otomatis ngikutin Pengaturan). Edit file itu kalau aturannya mau diubah.

## Jalankan di komputer sendiri (opsional)

Windows: double-click **`jalankan-lokal.bat`**. Kalau belum ada `.env`/`.env.local`, dia minta 3 kunci Supabase. Kalau udah ada tapi belum punya `SUPABASE_SECRET_KEY`, dia minta secret key aja lalu nambahin ke file itu. Habis itu install paket dan buka http://localhost:3000/admin.

Manual:

```bash
npm install
cp .env.example .env.local   # isi 3 kunci Supabase
npm run dev                  # buka http://localhost:3000
```
