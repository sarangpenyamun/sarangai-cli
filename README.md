# SarangAI CLI

Gateway AI Coding Workspace interaktif langsung dari terminal Anda, didukung oleh model-model reasoning & coding terbaik dunia (Anthropic, OpenAI, DeepSeek, Alibaba, Google, Meta).

---

## Fitur Utama

- **Interactive Terminal Workspace (TUI)**: Antarmuka terminal interaktif modern berbasis full-screen alternate buffer tanpa flicker.
- **Top Coding Models (1 Brand = 1 Flagship)**: Dikurasi khusus untuk programming, arsitektur sistem, dan debugging mendalam:
  - Claude 3.7 Sonnet (Anthropic) - Architecture & Agentic coding
  - GPT-4o (OpenAI) - Fast full-stack & complex logic
  - DeepSeek-R1 (DeepSeek) - Deep reasoning & hard algorithms
  - Qwen 2.5 Coder 32B (Alibaba) - Multi-language syntax specialist
  - Gemini 2.5 Flash (Google) - 1M context & full repo analysis
  - Llama 3.3 70B (Meta) - Robust open-source coding engine
- **Real-Time Streaming**: Output kode dan respons AI mengalir seketika (zero-latency stream).
- **Auto-Auth via Browser**: Login cepat dan aman tanpa perlu input API Key manual.
- **Credit & Tier Monitoring**: Pantau sisa saldo credit secara live langsung di dalam terminal.

---

## Instalasi

Pastikan Node.js (>= 18) telah terpasang, lalu instal paket secara global:

    npm install -g sarangai-cli@latest

---

## Memulai Workspace Interaktif

Cukup jalankan satu perintah:

    sarang

Terminal akan otomatis menampilkan modal seleksi model coding, ringkasan saldo akun, dan opsi masuk ke ruang kerja (Workspace).

### Navigasi Keyboard:
- [↑/↓] (Panah) : Navigasi antar opsi dan pilihan model.
- [Enter / Space] : Konfirmasi pilihan / Masuk ke Workspace.
- [c] : Salin tautan dashboard referal ke clipboard.
- [Esc] : Mengakhiri sesi aktif di Workspace dan kembali ke menu seleksi.
- [q] : Keluar dari SarangAI CLI.

---

## Autentikasi Otomatis

Jika pertama kali menggunakan CLI:
1. Jalankan `sarang`.
2. CLI akan mengenerate tautan otorisasi unik dan otomatis menyalinnya ke clipboard.
3. Buka tautan tersebut di browser untuk mengizinkan sesi.
4. Terminal akan otomatis mendeteksi sesi dan menyimpan token ke `~/.sarangairc`.

---

## Konfigurasi Gateway

Secara default, CLI terhubung ke `[https://idshop.or.id](https://idshop.or.id)`. Jika Anda menggunakan custom gateway atau development server lokal:

    export SARANGAI_BASE_URL="http://localhost:3001"

---

## Lisensi

MIT License (c) SarangAI
