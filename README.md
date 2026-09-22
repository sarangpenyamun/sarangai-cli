# SarangAI CLI

Akses 400+ model AI unggulan (DeepSeek, Claude, GPT, Qwen, Minimax, dsb.) langsung dari terminal Anda melalui SarangAI Gateway.

---

## Fitur Utama

- **Streaming Teks Cepat**: Respons AI mengalir secara real-time langsung di terminal.
- **Katalog 400+ Model**: Jelajahi dan gunakan ratusan varian model AI populer.
- **Pencarian Cepat**: Filter model berdasarkan nama, provider, atau model gratis.
- **Dukungan Unix Piping**: Teruskan output perintah bash/kode program langsung ke AI.
- **Manajemen Saldo**: Cek status kredit akun langsung lewat terminal.

---

## Instalasi

Instal paket secara global menggunakan npm:

```bash
npm install -g sarangai-cli
```

---

## Panduan Penggunaan

### 1. Autentikasi
Dapatkan API Key dari dashboard akun SarangAI Anda, lalu hubungkan ke CLI:

```bash
sarang login
```

API Key akan disimpan di berkas konfigurasi lokal `~/.sarangairc`.

### 2. Cek Saldo Kredit
Lihat sisa saldo kredit dan status akun:

```bash
sarang balance
```

### 3. Jelajahi dan Filter Model
Melihat seluruh model yang tersedia:

```bash
sarang models
```

Menyaring model berdasarkan kata kunci:

```bash
sarang models -s deepseek
sarang models -s claude
sarang models -s free
```

### 4. Ganti Default Model
Tentukan model yang selalu digunakan secara otomatis:

```bash
sarang set-model minimax/minimax-m2.7
```

### 5. Chat & Streaming
Mengirim prompt langsung:

```bash
sarang chat "Jelaskan konsep index di database PostgreSQL."
```

Menggunakan model tertentu tanpa mengubah default:

```bash
sarang chat -m anthropic/claude-sonnet-4 "Buatkan regex validasi nomor telepon Indonesia."
```

### 6. Integrasi Unix Piping
Membaca input langsung dari terminal atau berkas kode:

```bash
cat main.py | sarang chat "Review potensi bug dan tingkatkan performa kode ini."
git diff | sarang chat "Buatkan pesan commit yang ringkas berdasarkan perubahan ini."
```

---

## Konfigurasi Gateway

Secara default, CLI membaca konfigurasi dari `~/.sarangairc` atau environment variable `SARANGAI_BASE_URL`.

Untuk gateway self-hosted atau pengujian lokal:

```bash
export SARANGAI_BASE_URL="http://localhost:3001"
```

---

## Lisensi

MIT
