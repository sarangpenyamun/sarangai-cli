import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserMessage } from '../src/core/prompt-builder';
import { executeFileReplaces, stripFileBlocks } from '../src/core/workspace';
import { LOCKED_CODING_MODELS } from '../src/constants';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Isolasi I/O: kerja di direktori sementara, bukan proyek.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sarangai-prompt-'));
process.chdir(tmpDir);

describe('prompt-builder: arsitektur Codebuff', () => {
  it('system prompt memakai instruksi context-gather-first Codebuff', () => {
    const sp = buildSystemPrompt(LOCKED_CODING_MODELS.glm);
    expect(sp).toContain(
      'Gather all the relevant context and then think carefully about how to implement',
    );
  });

  it('system prompt mendefinisikan kontrak file-tool WRITE_FILE dan REPLACE', () => {
    const sp = buildSystemPrompt(LOCKED_CODING_MODELS.sonnet);
    expect(sp).toContain('<<<WRITE_FILE path=');
    expect(sp).toContain('<<<END_FILE>>>');
    expect(sp).toContain('<<<WITH>>>');
    expect(sp).toContain('<<<END_REPLACE>>>');
  });

  it('rules-last: aturan eksekusi berada setelah identitas & spesialisasi model', () => {
    const sp = buildSystemPrompt(LOCKED_CODING_MODELS.deepseek);
    const identityIdx = sp.indexOf('You are SarangAI');
    const modelIdx = sp.indexOf('You are running as the');
    const rulesIdx = sp.indexOf('# How to carry it out here:');
    expect(identityIdx).toBeGreaterThanOrEqual(0);
    expect(modelIdx).toBeGreaterThan(identityIdx);
    expect(rulesIdx).toBeGreaterThan(modelIdx);
  });

  it('melarang dump kode di luar tag & melarang sponsor/iklan', () => {
    const sp = buildSystemPrompt(LOCKED_CODING_MODELS.mimo);
    expect(sp).toContain('NEVER paste full file contents outside these tags');
    expect(sp.toLowerCase()).toContain('sponsors');
  });

  it('kelima model terkunci menghasilkan spesialisasi masing-masing', () => {
    for (const m of Object.values(LOCKED_CODING_MODELS)) {
      const sp = buildSystemPrompt(m);
      expect(sp).toContain(`You are running as the ${m.name} profile (${m.id})`);
      expect(sp).toContain(m.role);
    }
  });

  it('user message task-first: tugas di atas, konteks sebagai background read-only', () => {
    const msg = buildUserMessage('buat crud express', 'File tree:\n📄 index.ts', false);
    const taskIdx = msg.indexOf('buat crud express');
    const ctxIdx = msg.indexOf('Project context (read-only)');
    expect(taskIdx).toBeGreaterThanOrEqual(0);
    expect(ctxIdx).toBeGreaterThan(taskIdx);
    expect(msg).toContain('NOT a competing request');
  });

  it('user message untuk proyek kosong menyatakan scaffold from scratch', () => {
    const msg = buildUserMessage('hello world app', '', true);
    expect(msg).toContain('empty directory — scaffold from scratch');
  });
});

describe('executeFileReplaces(): parser str_replace', () => {
  it('mengganti teks persis di file yang ada tanpa menulis ulang seluruh isi', () => {
    const target = path.join(tmpDir, 'edit-me.txt');
    fs.writeFileSync(target, 'hello world\nsecond line\n', 'utf-8');

    const raw = [
      '<<<REPLACE path="edit-me.txt">>>',
      'hello world',
      '<<<WITH>>>',
      'hello SarangAI',
      '<<<END_REPLACE>>>',
    ].join('\n');

    const results = executeFileReplaces(raw);
    expect(results).toEqual([{ path: 'edit-me.txt', success: true }]);
    expect(fs.readFileSync(target, 'utf-8')).toBe('hello SarangAI\nsecond line\n');
  });

  it('gagal tanpa melempar error jika file tidak ada', () => {
    const raw = '<<<REPLACE path="nope.txt">>>a<<<WITH>>>b<<<END_REPLACE>>>';
    const results = executeFileReplaces(raw);
    expect(results[0]?.success).toBe(false);
  });

  it('gagal jika teks yang dicari tidak cocok (byte-for-byte)', () => {
    const target = path.join(tmpDir, 'strict.txt');
    fs.writeFileSync(target, 'AB C', 'utf-8');
    const raw = '<<<REPLACE path="strict.txt">>>ABC<<<WITH>>>XYZ<<<END_REPLACE>>>';
    const results = executeFileReplaces(raw);
    expect(results[0]?.success).toBe(false);
    expect(fs.readFileSync(target, 'utf-8')).toBe('AB C'); // tidak berubah
  });

  it('mengembalikan array kosong jika tidak ada tag REPLACE', () => {
    expect(executeFileReplaces('penjelasan biasa')).toEqual([]);
  });
});

describe('stripFileBlocks(): membersihkan kedua jenis blok', () => {
  it('menghapus blok WRITE_FILE dan REPLACE sekaligus', () => {
    const raw = [
      'Analisis:',
      '<<<WRITE_FILE path="a.ts">>>RIBUAN BARIS<<<END_FILE>>>',
      'lanjut...',
      '<<<REPLACE path="b.ts">>>cari<<<WITH>>>ganti<<<END_REPLACE>>>',
      'selesai.',
    ].join('\n');

    const clean = stripFileBlocks(raw);
    expect(clean).not.toContain('RIBUAN BARIS');
    expect(clean).not.toContain('<<<');
    expect(clean).toContain('Analisis:');
    expect(clean).toContain('lanjut...');
    expect(clean).toContain('selesai.');
  });
});
