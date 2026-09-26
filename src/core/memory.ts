import { ChatMessage } from './gateway';

/**
 * Memori percakapan multi-giliran untuk sesi REPL SarangAI.
 *
 * Riwayat adalah KONTEKS BACA-SAJA (mengikuti pola framing konteks Codebuff di
 * prompt-builder.ts): giliran sebelumnya dipakai HANYA agar tugas lanjutan
 * menyambung dengan pekerjaan sebelumnya — bukan permintaan baru yang harus
 * dieksekusi ulang.
 *
 * Batas token dijaga dengan tiga mekanisme:
 *  1. Per-pesan: konten dipotong di batas baris utuh (MAX_*_CHARS).
 *  2. Per-riwayat: hanya MAX_HISTORY_TURNS giliran terakhir yang dikirim.
 *  3. Total: budget karakter; pasangan tertua dilepas sampai muat.
 *
 * Layout TUI tidak tersentuh: memori hidup di array sesi, tidak pernah
 * dirender ke viewport.
 */

const MAX_USER_CHARS = 4000;
const MAX_ASSISTANT_CHARS = 2000;

/** Jumlah maksimum pasangan (user + hasil agen) yang dikirim ke gateway. */
export const MAX_HISTORY_TURNS = 6;

/** Budget karakter gabungan seluruh riwayat (± 12 ribu karakter). */
export const MAX_HISTORY_CHARS = 12000;

/** Info satu giliran percakapan yang layak diingat. */
export interface HistoryTurn {
  user: string;
  /** Ringkasan hasil kerja agen — file yang dieksekusi + penjelasan inti. */
  summary: string;
}

/** Potong teks ke maksimal `maxChars`, menjatuhkan potongan di batas baris utuh. */
export function truncateOnLineBoundary(text: string, maxChars: number): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;

  const head = clean.slice(0, maxChars);
  // Cari newline terakhir supaya potongan tidak memenggal baris.
  const lastNewline = head.lastIndexOf('\n');
  const sliced = lastNewline > maxChars / 2 ? head.slice(0, lastNewline) : head;
  return `${sliced.trimEnd()}\n…(truncated)`;
}

/** Ringkasan hasil kerja: laporan file + penjelasan, dipangkas ketat. */
export function summarizeResult(
  explanation: string,
  writtenFiles: { path: string; success: boolean }[],
  editedFiles: { path: string; success: boolean }[] = [],
): string {
  const parts: string[] = [];

  const okWritten = writtenFiles.filter((f) => f.success).map((f) => f.path);
  const okEdited = editedFiles.filter((f) => f.success).map((f) => f.path);

  if (okWritten.length > 0) parts.push(`Files written: ${okWritten.join(', ')}`);
  if (okEdited.length > 0) parts.push(`Files edited: ${okEdited.join(', ')}`);
  if (explanation.trim()) parts.push(explanation.trim());

  return parts.join('\n');
}

/**
 * Rakit pesan riwayat: ASSISTANT dulu, USER setelahnya (urutan kronologis).
 * Setiap pesan sudah terpangkas per-item; pemanggil boleh memangkas total.
 */
export function historyToMessages(history: HistoryTurn[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const turn of history) {
    messages.push({ role: 'user', content: truncateOnLineBoundary(turn.user, MAX_USER_CHARS) });
    messages.push({
      role: 'assistant',
      content: truncateOnLineBoundary(turn.summary, MAX_ASSISTANT_CHARS),
    });
  }
  return messages;
}

/**
 * Ambil paling banyak MAX_HISTORY_TURNS giliran terakhir, lalu lepaskan
 * pasangan tertua sampai total karakter muat di budget MAX_HISTORY_CHARS.
 */
export function boundedHistory(history: HistoryTurn[]): HistoryTurn[] {
  let slice = history.slice(-MAX_HISTORY_TURNS);

  const sizeOf = (turns: HistoryTurn[]): number =>
    turns.reduce((acc, t) => acc + t.user.length + t.summary.length, 0);

  while (slice.length > 1 && sizeOf(slice) > MAX_HISTORY_CHARS) {
    slice = slice.slice(1);
  }
  return slice;
}
