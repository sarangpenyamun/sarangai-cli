import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock homedir ke temporary directory agar tes isolasi & aman di CI.
// Semua utilitas dibuat DI DALAM factory: vi.mock di-hoist ke atas file,
// dan referensi ke import luar bisa TDZ tergantung urutan evaluasi import.
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  const fsp = await import('fs');
  const pathMod = await import('path');
  const tmp = fsp.mkdtempSync(pathMod.join(actual.tmpdir(), 'sarangai-test-'));
  (globalThis as { __SARANGAI_TMP__?: string }).__SARANGAI_TMP__ = tmp;
  return {
    ...actual,
    default: { ...actual, homedir: () => tmp },
    homedir: () => tmp,
  };
});

import { getConfig, saveConfig, type SarangConfig } from '../src/config';

const tmpDir = (globalThis as { __SARANGAI_TMP__?: string }).__SARANGAI_TMP__ as string;
const CONFIG_FILE = path.join(tmpDir, '.sarangairc');

const DEFAULTS: SarangConfig = {
  baseUrl: 'https://sarangai.id',
  defaultModel: 'glm',
};

describe('config', () => {
  beforeEach(() => {
    if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
  });

  afterEach(() => {
    if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
  });

  describe('getConfig()', () => {
    it('mengembalikan default config jika file .sarangairc tidak ada', () => {
      const config = getConfig();
      expect(config).toEqual(DEFAULTS);
    });

    it('membaca config dari file .sarangairc yang valid', () => {
      const stored: SarangConfig = {
        apiKey: 'sk-test-123',
        baseUrl: 'https://api.example.com',
        defaultModel: 'gpt-4o',
      };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(stored), 'utf-8');

      expect(getConfig()).toEqual(stored);
    });

    it('mengembalikan default config jika file berisi JSON rusak/invalid', () => {
      fs.writeFileSync(CONFIG_FILE, '{ invalid json !!!', 'utf-8');
      expect(getConfig()).toEqual(DEFAULTS);
    });

    it('mengembalikan default config jika file berisi JSON non-object (misal angka)', () => {
      fs.writeFileSync(CONFIG_FILE, '42', 'utf-8');
      // JSON.parse valid, tapi bukan object — divalidasi dan jatuh ke default.
      expect(getConfig()).toEqual(DEFAULTS);
    });

    it('mengembalikan default config jika file berisi JSON array', () => {
      fs.writeFileSync(CONFIG_FILE, '["bukan","config"]', 'utf-8');
      expect(getConfig()).toEqual(DEFAULTS);
    });
  });

  describe('saveConfig()', () => {
    it('menulis config baru ke file .sarangairc', () => {
      saveConfig({ apiKey: 'sk-new' });

      expect(fs.existsSync(CONFIG_FILE)).toBe(true);
      expect(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))).toEqual({
        ...DEFAULTS,
        apiKey: 'sk-new',
      });
    });

    it('melakukan merge dengan config existing tanpa menimpa field lain', () => {
      fs.writeFileSync(
        CONFIG_FILE,
        JSON.stringify({ apiKey: 'sk-old', defaultModel: 'gpt-4o' }),
        'utf-8'
      );

      saveConfig({ defaultModel: 'claude-3.7-sonnet' });

      const result: SarangConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      expect(result).toEqual({
        apiKey: 'sk-old',
        defaultModel: 'claude-3.7-sonnet',
      });
    });

    it('merge dengan default config jika file belum ada', () => {
      saveConfig({ apiKey: 'sk-fresh' });

      const result = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      expect(result).toEqual({ ...DEFAULTS, apiKey: 'sk-fresh' });
    });

    it('menulis file dengan pretty-print (indentasi 2 spasi)', () => {
      saveConfig({ apiKey: 'sk-pretty' });
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      expect(raw).toContain('\n  "apiKey"');
    });

    it('menimpa nilai field yang sama', () => {
      saveConfig({ apiKey: 'sk-a' });
      saveConfig({ apiKey: 'sk-b' });

      const result = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      expect(result.apiKey).toBe('sk-b');
    });
  });
});
