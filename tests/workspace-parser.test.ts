import { describe, it, expect } from 'vitest';
import { executeFileWrites, stripFileBlocks } from '../src/core/workspace';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Isolasi: tulis berkas uji ke direktori sementara, bukan ke proyek.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sarangai-parser-'));
process.chdir(tmpDir);

describe('executeFileWrites()', () => {
  it('menulis berkas dari tag WRITE_FILE dan membersihkan fence markdown', () => {
    const raw = [
      'Penjelasan singkat.',
      '<<<WRITE_FILE path="src/halo.ts">>>',
      '```typescript',
      'export const halo = "dunia";',
      '```',
      '<<<END_FILE>>>',
    ].join('\n');

    const results = executeFileWrites(raw);
    expect(results).toEqual([{ path: 'src/halo.ts', success: true }]);

    const written = fs.readFileSync(path.join(tmpDir, 'src/halo.ts'), 'utf-8');
    expect(written).toBe('export const halo = "dunia";');
  });

  it('membuat direktori bertingkat secara rekursif', () => {
    const raw = '<<<WRITE_FILE path="a/b/c/deep.txt">>>isi<<<END_FILE>>>';
    const results = executeFileWrites(raw);
    expect(results[0]?.success).toBe(true);
    expect(fs.readFileSync(path.join(tmpDir, 'a/b/c/deep.txt'), 'utf-8')).toBe('isi');
  });

  it('melaporkan kegagalan tanpa melempar error (mis. path adalah direktori)', () => {
    fs.mkdirSync(path.join(tmpDir, 'blocked'));
    const raw = '<<<WRITE_FILE path="blocked">>>x<<<END_FILE>>>';
    const results = executeFileWrites(raw);
    expect(results[0]?.success).toBe(false);
  });

  it('mengembalikan array kosong jika tidak ada tag', () => {
    expect(executeFileWrites('hanya penjelasan biasa')).toEqual([]);
  });
});

describe('stripFileBlocks()', () => {
  it('menghapus seluruh blok WRITE_FILE dari jawaban', () => {
    const raw = [
      'Analisis selesai.',
      '<<<WRITE_FILE path="x.ts">>>',
      'const rahasia = "RIBUAN BARIS KODE";',
      '<<<END_FILE>>>',
      'Rekomendasi lanjutan.',
    ].join('\n');

    const clean = stripFileBlocks(raw);
    expect(clean).not.toContain('WRITE_FILE');
    expect(clean).not.toContain('RIBUAN BARIS KODE');
    expect(clean).toContain('Analisis selesai.');
    expect(clean).toContain('Rekomendasi lanjutan.');
  });

  it('menghapus banyak blok sekaligus', () => {
    const raw =
      'A<<<WRITE_FILE path="1.txt">>>satu<<<END_FILE>>>B<<<WRITE_FILE path="2.txt">>>dua<<<END_FILE>>>C';
    expect(stripFileBlocks(raw)).toBe('ABC');
  });

  it('membiarkan jawaban tanpa tag tetap utuh (trim saja)', () => {
    expect(stripFileBlocks('  halo dunia  ')).toBe('halo dunia');
  });
});
