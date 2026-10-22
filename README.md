# 📄 Doc & PDF Master Suite | Ultimate Document & PDF Engine

Aplikasi web modern, berkecepatan tinggi, dan berestetika premium untuk konversi bolak-balik dokumen (Word, Excel, PPT, Gambar <-> PDF), kompresi dokumen & gambar hingga kapasitas paling ekstrem (-90%), penggabungan banyak gambar ke satu PDF, serta integrasi database pencatatan riwayat dengan Google Sheets & Google Drive Storage bertenaga **Google Apps Script (GAS)**.

---

## 🌟 Fitur Utama

### 1. 🚀 Konversi ke PDF
- **Word (.docx, .doc) ➔ PDF**: Dikonversi dengan presisi tinggi menggunakan engine Google Drive Native Conversion.
- **Excel (.xlsx, .xls) ➔ PDF**: Format tabel dan layout grid sheet rapi.
- **PowerPoint (.pptx, .ppt) ➔ PDF**: Render slide per slide dengan tata letak visual utuh.
- **Gambar (JPG, PNG, WebP, BMP) ➔ PDF**: Konversi instan lokal / cloud.

### 2. 🔄 Konversi dari PDF ke Format Lain
- **PDF ➔ Word (.docx)**: Ekstraksi struktur dokumen & teks melalui Google Docs OCR Engine.
- **PDF ➔ Gambar Berkualitas Tinggi (ZIP / JPG / PNG)**: Render per halaman pada resolusi tinggi (DPI 2.0 Super Clarity).
- **PDF ➔ Teks (.txt)**: Ekstraksi teks cepat.

### 3. 🗜️ Extreme Compression Engine (Kompresi Ekstrem)
- **Kompresi Gambar (JPG, PNG, WebP)**: Algoritma *Multi-pass Downsampling* & quantisasi piksel cerdas untuk mereduksi kapasitas hingga **80% - 95% lebih kecil**.
- **Kompresi PDF**: Merampingkan stream objek dan mengompresi gambar yang tertanam di dalam PDF.
- **3 Pilihan Preset**:
  - ⚡ **Ekstrem (Paling Kecil)**: Optimal untuk upload portal CPNS/BUMN/email (< 200KB - 500KB).
  - ⚖️ **Seimbang (Rekomendasi)**: Kualitas tajam dengan ukuran hemat.
  - 💎 **Kualitas Tinggi**: Kompresi ringan lossless visual.
- **Slider Kustom**: Pengaturan kualitas 10% s.d. 100%.
- **Live Indicator**: Menampilkan ukuran sebelum vs sesudah, serta persentase penghematan (*Saved %*).

### 4. 📑 Penggabungan Banyak Gambar ke Satu PDF (Image Merger)
- Mendukung multi-upload puluhan gambar sekaligus.
- **Drag-and-Drop Reordering**: Geser dan atur urutan halaman dengan interaktif.
- **Pengaturan Tata Letak**:
  - Ukuran Kertas: A4, US Letter, Fit to Image.
  - Orientasi: Otomatis, Potret, Lanskap.
  - Margin: Tanpa Margin (Full Bleed), 15 pt (Kecil), 30 pt (Normal).

### 5. ☁️ Google Apps Script Backend & Google Sheets Database
- **Hosting**: Bisa di-host langsung sebagai Google Apps Script Web App gratis tanpa server eksternal.
- **Google Sheets Database**: Otomatis membuat spreadsheet `DocConverter_Database` dan mencatat setiap riwayat konversi/kompresi.
- **Google Drive Storage**: Tombol langsung untuk menyimpan file hasil olahan ke Google Drive user (`DocConverter_Files`).

---

## 📁 Struktur Direktori

```
doc-converter-suite/
├── Index.html          # File antarmuka UI utama (Responsive, Glassmorphism)
├── style.css           # Design system (Dark/Light mode, Glowing accents)
├── app.js              # Core logic konversi, kompresi ekstrem, dan image merge
├── gas-client.js       # Bridge penghubung ke Google Apps Script backend
├── Code.gs             # Backend Google Apps Script (Drive API, Sheets DB, OCR)
├── appsscript.json     # Manifest OAuth scopes untuk Google Apps Script
└── README.md           # Dokumentasi dan panduan deployment
```

---

## 🚀 Panduan Deployment ke Google Apps Script (GAS)

Untuk menjalankan aplikasi ini secara penuh di infrastruktur Google Cloud / Google Apps Script:

### Langkah 1: Buat Proyek Google Apps Script
1. Buka browser dan kunjungi [script.google.com](https://script.google.com/).
2. Klik tombol **"+ Proyek Baru"** (New Project).
3. Beri nama proyek, misalnya: `DocConverterSuite`.

### Langkah 2: Salin File `Code.gs` dan `Index.html`
1. Di editor Google Apps Script, buka file `Code.gs`, hapus kode bawaan, lalu salin seluruh isi dari file [`Code.gs`](file:///Users/bahronireza/Documents/Code/Code.gs).
2. Tambahkan file HTML baru dengan klik ikon **"+"** di samping menu File ➔ Pilih **HTML** ➔ Beri nama `Index` (akan menjadi `Index.html`).
3. Salin seluruh isi dari file [`Index.html`](file:///Users/bahronireza/Documents/Code/Index.html) ke dalam file `Index.html` di Google Apps Script.

### Langkah 3: Aktifkan Layanan Google Drive API (Opsional untuk performa maksimal)
1. Pada menu sebelah kiri Google Apps Script, klik tanda **"+"** di samping **Layanan** (Services).
2. Pilih **Drive API** (Versi `v2`).
3. Klik **Tambahkan** (Add).

### Langkah 4: Publikasikan sebagai Web App
1. Klik tombol **"Deploy"** (Terapkan) di pojok kanan atas ➔ Pilih **"New deployment"** (Penerapan baru).
2. Klik ikon gerigi (Select type) ➔ Pilih **"Web app"** (Aplikasi web).
3. Atur konfigurasi berikut:
   - **Description**: `Versi 1.0 Produksi`
   - **Execute as** (Jalankan sebagai): `Me` (Akun saya)
   - **Who has access** (Siapa yang memiliki akses): `Anyone` (Siapa saja)
4. Klik **Deploy**.
5. Setujui izin otorisasi Google (OAuth Permission) untuk mengakses Drive dan Spreadsheets akun Anda.
6. Salin **Web App URL** yang didapatkan. Aplikasi siap digunakan langsung di browser!

---

## 💻 Menjalankan Secara Lokal / Standalone

Aplikasi ini juga dirancang dengan arsitektur **Hybrid**:
1. Anda dapat membuka file [`Index.html`](file:///Users/bahronireza/Documents/Code/Index.html) langsung di browser menggunakan Live Server atau klik ganda.
2. Untuk fitur kompresi gambar, penggabungan PDF, dan kompresi PDF, semuanya berjalan **100% instan di browser** (tanpa batas ukuran upload server).
3. Untuk menghubungkan konversi Office (Word/Excel/PPT) dan Google Sheets Database saat running lokal:
   - Klik ikon **Pengaturan (Gerigi)** di pojok kanan atas header.
   - Tempelkan **URL Web App GAS** Anda.
   - Klik **Simpan Pengaturan**.

---

## 🛡️ Keamanan & Privasi
- Pemrosesan gambar dan penggabungan PDF dilakukan langsung pada *client-side memory* (RAM browser) menggunakan Web Assembly dan Canvas, memastikan kerahasiaan dokumen tetap terjaga.
- File sementara yang dibuat di Google Drive saat konversi Office otomatis dihapus (*trashed*) oleh backend `Code.gs`.
