import { yen } from "./betting";
import { PRIZE_CUT_PCT, PRIZE_SPLIT_PCT } from "./prize";
import type { Settings } from "./types";

export type RuleGroup = { code: string; title: string; items: string[] };

/**
 * Isi dokumen peraturan. Angka yang bisa berubah (biaya daftar, potongan kas) diambil dari Pengaturan,
 * pembagian hadiah dari lib/prize.ts, jadi dokumen ini selalu cocok sama yang dipakai sistem.
 */
export function ruleBook(settings: Settings | null): RuleGroup[] {
  const fee = settings ? yen(settings.registration_fee) : null;
  const cut = settings ? Math.round(settings.default_house_cut * 100) : null;
  return [
    {
      code: "General rules",
      title: "Aturan umum",
      items: [
        "Yang terjadi di basement, tetap di basement. Jangan cerita ke guru, OSIS, atau siapa pun di luar lingkaran.",
        fee
          ? `Fighter wajib daftar ke Finance Registration dan lunas biaya pendaftaran ${fee} sebelum bracket dibuat.`
          : "Fighter wajib daftar ke Finance Registration dan lunas biaya pendaftaran sebelum bracket dibuat.",
        "Pendaftaran berlaku per vol. Tiap vol baru, fighter daftar dan bayar lagi.",
        `Hadiah juara diambil dari uang pendaftaran dan sponsor. ${100 - PRIZE_CUT_PCT}% jadi total hadiah (${PRIZE_CUT_PCT}% masuk kas panitia), ` +
          `dibagi juara 1 ${PRIZE_SPLIT_PCT[0]}%, juara 2 ${PRIZE_SPLIT_PCT[1]}%, dan juara 3 ${PRIZE_SPLIT_PCT[2]}%.`,
        "Satu orang, satu nama fighter. Nama yang udah masuk bracket gak bisa dipakai orang lain.",
        "Keputusan panitia soal jadwal, bracket, dan hasil itu final.",
        "Ini event roleplay. Semua uang di halaman ini mata uang RP, bukan uang asli.",
      ],
    },
    {
      code: "Fight regulations",
      title: "Aturan fight",
      items: [
        "Satu lawan satu. Gak ada yang boleh ikut campur dari luar ring.",
        "Tangan kosong. Senjata, alat, dan benda apa pun dilarang.",
        "Fight jalan terus sampai ada yang KO, menyerah, atau dihentikan wasit.",
        "Lawan yang udah jatuh dan gak melawan gak boleh diserang lagi.",
        "Keputusan wasit final.",
      ],
    },
    {
      code: "Match procedures",
      title: "Prosedur fight",
      items: [
        "Fight yang dipanggil muncul di bagian Lagi di ring. Dua fighter-nya harus udah siap di lokasi.",
        "Fighter yang gak datang setelah dipanggil bisa dinyatakan kalah walkover.",
        "Fight mulai waktu wasit kasih tanda. Taruhan otomatis ditutup saat itu juga.",
        "Wasit yang nentuin pemenang. Hasil resmi langsung masuk bracket dan arsip.",
        "Pemenang maju ke ronde berikutnya. Yang kalah di semifinal masih punya satu fight lagi: perebutan juara 3.",
      ],
    },
    {
      code: "Disqualification",
      title: "Diskualifikasi",
      items: [
        "Bawa atau pakai senjata.",
        "Nyerang sebelum tanda mulai, atau setelah wasit menghentikan fight.",
        "Dibantu orang lain di tengah fight.",
        "Nyerang wasit, panitia, atau penonton.",
        "Ngebocorin lokasi atau jadwal ke guru. Yang ini bukan cuma diskualifikasi, tapi dicoret dari semua event berikutnya.",
      ],
    },
    {
      code: "Betting regulations",
      title: "Aturan taruhan",
      items: [
        "Pasang taruhan cuma lewat Finance Betting di lokasi. Sebut nama, jagoan, dan nominal, terus simpan kode slip-nya.",
        "Taruhan dibuka sampai fight mulai. Begitu fight mulai, gak bisa nambah, ganti, atau batal.",
        "Jagoan menang: modal balik utuh, ditambah bagian dari uang pihak yang kalah sesuai besar taruhan.",
        cut !== null
          ? `Potongan kas panitia ${cut}% (bisa beda per fight) dan cuma diambil dari uang pihak yang kalah.`
          : "Potongan kas panitia cuma diambil dari uang pihak yang kalah.",
        "Fight dibatalkan: semua taruhan dikembalikan utuh.",
        "Nama dan nominal taruhan tiap orang gak pernah ditampilkan di halaman ini. Cek punyamu sendiri pakai kode slip di Meja taruhan.",
      ],
    },
  ];
}
