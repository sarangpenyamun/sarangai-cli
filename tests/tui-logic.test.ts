import { describe, it, expect } from 'vitest';
import { LOCKED_CODING_MODELS, resolveModel } from '../src/constants';
import { bannerLines, formatAccountLine } from '../src/ui/banner';

describe('constants: model terkunci', () => {
  it('memuat tepat 5 model resmi dengan id yang benar', () => {
    const ids = Object.values(LOCKED_CODING_MODELS).map((m) => m.id);
    expect(ids).toEqual([
      'z-ai/glm-5.3-flash',
      'anthropic/claude-sonnet-4.6',
      'openai/gpt-5.6-luna',
      'deepseek/deepseek-v3.2',
      'xiaomi/mimo-v2.5-pro',
    ]);
  });

  it('resolveModel menerima alias, nama, dan id', () => {
    expect(resolveModel('luna').id).toBe('openai/gpt-5.6-luna');
    expect(resolveModel('DeepSeek V3.2').id).toBe('deepseek/deepseek-v3.2');
    expect(resolveModel('xiaomi/mimo-v2.5-pro').id).toBe('xiaomi/mimo-v2.5-pro');
    expect(resolveModel('tidak-ada').alias).toBe('glm'); // fallback default
  });
});

describe('banner', () => {
  it('formatAccountLine renders accountId, tier, and balance in English', () => {
    const line = formatAccountLine({ accountId: 'SA-ABC123', tier: 'DEVELOPER', balance: 75313 });
    const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
    expect(plain).toContain('Account: SA-ABC123');
    expect(plain).toContain('Tier: DEVELOPER');
    expect(plain).toContain('Balance: 75,313');
  });

  it('bannerLines: header structure is stable (banner + account + 2 separators)', () => {
    const lines = bannerLines({ accountId: 'SA-X', tier: 'PRO', balance: 10 }).map((l) =>
      l.replace(/\x1b\[[0-9;]*m/g, ''),
    );
    expect(lines.length).toBe(9);
    expect(lines[0]).toContain('█'); // ASCII banner is drawn with blocks
    expect(lines[7]).toContain('Account: SA-X');
  });

  it('bannerLines tanpa stats tetap 9 baris (header tidak boleh berubah ukuran)', () => {
    const lines = bannerLines(null).map((l) => l.replace(/\x1b\[[0-9;]*m/g, ''));
    expect(lines.length).toBe(9);
    expect(lines[7]).toContain('Account: —');
  });
});
