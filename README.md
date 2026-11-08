# Etika Bantuan (antarmuka web)

Dasbor audit untuk [API Etika Seleksi Bantuan Sosial](https://github.com/badaruddin-arete/etika-bantuan-api). Antarmuka ini menampilkan hasil seleksi bantuan sosial lewat dua lensa etika yang berbeda:

- **Bentham (utilitarianisme):** siapa yang paling besar manfaatnya bila dibantu, dihitung sebagai skor.
- **Kant (deontologi):** siapa yang *wajib* dibantu, sebuah kewajiban mutlak yang mendahului hitungan skor.

Setiap baris hasil menunjukkan status, dasar keputusan (Kewajiban Kant atau Skor Bentham), skor gabungan terhadap ambang kuota, level bias, dan dana yang dialokasikan, sehingga keputusan dapat ditelusuri alasannya.

## Dua mode

| Mode | Sumber data | Keterangan |
|---|---|---|
| **Demo** (bawaan) | Data statis | Angka diambil dari keluaran nyata backend untuk lima kasus uji. Tidak membutuhkan server apa pun. |
| **Live** | Backend lokal | Memanggil `POST /analisis-batch` pada backend yang berjalan di komputer Anda. |

Pengunjung demo publik memakai mode Demo. Mode Live ditujukan untuk pengembangan: jalankan backend sesuai petunjuk di repositori [etika-bantuan-api](https://github.com/badaruddin-arete/etika-bantuan-api), lalu nyalakan toggle Live.

## Menjalankan secara lokal

Butuh Node.js.

```bash
npm install
npm run dev
```

## Teknologi

React, TypeScript, Vite, Tailwind CSS, dan shadcn/ui.

## Keterbatasan

- Semua parameter kebijakan (batas kemiskinan, ambang kuota, dan lainnya) bersifat **ilustratif** dan tidak untuk keputusan tentang orang sungguhan.
- Mode Demo menampilkan data statis; hanya mode Live yang memanggil backend.
- Antarmuka ini tidak memiliki autentikasi dan tidak menyimpan data pemohon di server.

## Transparansi pembuatan

Rancangan etika dan logika backend saya susun dengan bantuan AI (Claude). Antarmuka ini dibuat dengan Lovable.

## Lisensi

Hak cipta dilindungi. Kode boleh dibaca dan dinilai; penggunaan ulang memerlukan izin tertulis. Lihat [LICENSE](LICENSE).
