# 1C Underground Fight — Website + Panel Panitia

Website live buat event underground fight Class 1-C (Kishin High School).

- **`/`** → halaman penonton: poster "Pertandingan Hari Ini", podium juara, bracket per ronde, odds taruhan. Update otomatis tanpa refresh.
- **`/admin`** → panel panitia (login): pendaftaran + upload foto, generate bracket otomatis, catat taruhan & payout, pengaturan event.

Stack: Next.js (hosting di Vercel) + Supabase (database, login, penyimpanan foto). Dua-duanya gratis.

---

## 1. Setup Supabase (± 5 menit)

1. Buka [supabase.com](https://supabase.com) → **New project** (paket Free). Simpan password database-nya.
2. Masuk ke **SQL Editor** → **New query** → copy-paste seluruh isi `supabase/schema.sql` → **Run**.
3. Bikin akun admin: **Authentication → Users → Add user → Create new user**. Isi email + password, centang **Auto Confirm User**.
4. Daftarkan email itu sebagai admin. Di SQL Editor jalankan (ganti emailnya):
   ```sql
   insert into admin_emails (email) values ('emailpanitia@contoh.com');
   ```
   Cuma email yang ada di tabel ini yang bisa ngedit data. Akun lain (kalau ada yang iseng daftar) gak bisa ngapa-ngapain.
5. (Disarankan) **Authentication → Sign In / Providers** → matikan **Allow new users to sign up**.
6. Ambil 2 kunci di **Project Settings → API** (atau tombol **Connect** di atas):
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Jangan pakai `service_role` / secret key — itu gak boleh ditaruh di website.)

## 2. Upload ke GitHub

1. Bikin repo baru di [github.com/new](https://github.com/new) (boleh private).
2. Klik **uploading an existing file**, drag semua isi folder project ini (bukan folder-nya), lalu **Commit**.

## 3. Deploy ke Vercel

1. Buka [vercel.com/new](https://vercel.com/new) → login pakai GitHub → **Import** repo tadi.
2. Buka **Environment Variables**, tambahkan:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon/publishable key
3. **Deploy**. Selesai — link-nya misal `https://kishin-1c-fight.vercel.app`.

Kalau nanti ganti environment variable, jalankan **Redeploy** di Vercel biar kepake.

---

## Cara pakai di hari-H

| Tugas | Siapa | Di mana |
|---|---|---|
| Daftarin fighter, upload foto, tandai sudah bayar | Finance Registration | `/admin` → Pendaftaran |
| Generate bracket (setelah pendaftaran ditutup) | Bracket Coordinator | `/admin` → Bracket → **Generate bracket** |
| Centang "Tampil hari ini" buat match yang dipanggil ke arena | Bracket Coordinator / MC | `/admin` → Bracket |
| Catat taruhan sebelum fight mulai | Finance Betting | `/admin` → Taruhan |
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
- Jaga-jaga: `/admin` → Pengaturan → **Cari & hapus foto nganggur** buat bersihin file yang gak dipakai siapa pun.

## Sistem taruhan

- Yang menang: **modal balik utuh + bagian dari uang pihak yang kalah**, dibagi sesuai besar taruhan.
- **House cut** (default 20%, bisa diubah per match) cuma dipotong dari uang pihak yang kalah.
- Kalau gak ada yang taruh ke fighter yang menang, seluruh uang pihak kalah masuk kas 1C.
- Pecahan Yen dibulatkan ke bawah ke bettor; sisanya masuk kas 1C.

## Jalankan di komputer sendiri (opsional)

Windows: double-click **`jalankan-lokal.bat`**. Pertama kali dia minta Project URL + anon key Supabase (disimpan ke `.env.local`), install paket, lalu buka http://localhost:3000. Mau ganti kunci? Hapus file `.env.local`, jalankan lagi.

Manual:

```bash
npm install
cp .env.example .env.local   # isi 2 kunci Supabase
npm run dev                  # buka http://localhost:3000
```
