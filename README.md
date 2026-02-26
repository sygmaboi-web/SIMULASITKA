# Simulasi TKA SMP (AI Gemini)

Website simulasi TKA SMP dengan fitur:

- Alur lengkap: akun peserta (register/login) -> konfirmasi peserta -> ujian -> hasil.
- Admin panel: login admin, buat draft soal ujian resmi, set token ujian, mulai/akhiri ujian serentak.
- Editor soal admin berbasis form (mirip Google Form): tulis soal langsung, upload foto, pilih PG biasa atau PG kompleks (multi jawaban benar).
- Saat ujian resmi aktif, semua peserta memakai soal yang sama (sesuai draft admin) dan waktu dihitung serentak.
- Admin dapat memantau peserta realtime (progress, sisa waktu, pelanggaran) dan melihat seluruh hasil.
- Pilih `Mata Pelajaran`, `Durasi`, dan `Jumlah Soal` di halaman awal.
- Soal dibuat baru setiap sesi menggunakan Gemini API.
- Timer otomatis menghentikan ujian saat waktu habis.
- Daftar soal bisa dipilih bebas (lompat ke nomor berapa pun).
- Hasil ujian tersimpan per akun peserta di Firestore, dan bisa dilihat sebagai riwayat.
- Anti-cheat:
  - Keluar tab/jendela: peringatan sampai 2 kali.
  - Pelanggaran berikutnya: kunci pengerjaan 5 menit + penalti nilai 5 poin per kejadian.
- Setelah selesai: tampil kunci jawaban dan pembahasan singkat.

## Cara menjalankan

1. Install dependency
   ```bash
   npm install
   ```
2. Buat file `.env` dari `.env.example` lalu isi key:
   ```env
   PORT=3000
   GEMINI_API_KEY=API_KEY_ANDA
   GEMINI_MODEL=gemini-1.5-flash
   GCP_PROJECT_ID=simulasi-tka-488513
   GOOGLE_APPLICATION_CREDENTIALS=./firestore-sa.json
   JWT_SECRET=RANDOM_STRING_MIN_32_CHAR
   AUTH_TOKEN_TTL=14d
   ADMIN_PASSWORD=VINOGANTENG
   ```
3. Pastikan file `firestore-sa.json` (service account key) ada di root project, bukan file kosong, atau sesuaikan path env.
4. Jalankan server:
   ```bash
   npm start
   ```
5. Buka:
   - `http://localhost:3000`

## Alur ujian resmi (admin)

1. Klik `Panel Admin` di halaman awal.
2. Login admin dengan password `ADMIN_PASSWORD` (default: `VINOGANTENG`).
3. Siapkan draft ujian:
   - set mapel, durasi, jumlah soal, token resmi.
   - isi soal langsung lewat form builder (tanpa JSON manual), atau klik `Generate Soal AI` lalu edit lagi.
4. Klik `Simpan Draft Ujian`, lalu `Mulai Ujian Serentak`.
5. Peserta login akun masing-masing, isi token resmi dari admin, dan mulai ujian dengan soal yang sama.
6. Admin pantau realtime peserta + seluruh hasil/pelanggaran dari dashboard admin.

## Prompt AI (cara mengajari AI membuat soal)

Backend menggunakan prompt terstruktur agar model mengeluarkan JSON rapi.
Anda bisa lihat template aktif melalui endpoint:

- `GET /api/prompt-template?subject=Matematika&totalQuestions=10`

### Prinsip prompt yang dipakai

1. Tetapkan peran model sebagai penyusun soal TKA SMP.
2. Beri aturan ketat: jumlah soal, level, jumlah opsi, satu jawaban benar.
3. Beri contoh soal singkat (few-shot) agar format konsisten.
4. Wajibkan output JSON tanpa markdown.
5. Validasi output di server (jika rusak, fallback ke generator lokal).

### Contoh format JSON yang diminta ke model

```json
{
  "questions": [
    {
      "question": "Nilai x pada persamaan 3x + 5 = 26 adalah ...",
      "options": ["5", "6", "7", "8", "9"],
      "answerIndex": 2,
      "explanation": "Kurangi 5 dari 26 lalu bagi 3."
    }
  ]
}
```

## Struktur file utama

- `server.js` -> API Gemini, auth akun peserta, simpan/ambil hasil Firestore, fallback soal lokal.
- `index.html` -> seluruh layar UI.
- `style.css` -> style seluruh aplikasi.
- `script.js` -> alur akun peserta, ujian, timer, anti-cheat, scoring, review, riwayat hasil.
