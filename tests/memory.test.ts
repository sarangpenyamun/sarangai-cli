import { describe, it, expect } from 'vitest';
import {
  truncateOnLineBoundary,
  summarizeResult,
  historyToMessages,
  boundedHistory,
  MAX_HISTORY_TURNS,
  MAX_HISTORY_CHARS,
} from '../src/core/memory';

describe('truncateOnLineBoundary()', () => {
  it('cuts at an intact line boundary and appends a truncation marker', () => {
    const text = Array.from({ length: 50 }, (_, i) => `baris-${i + 1}`).join('\n');
    const out = truncateOnLineBoundary(text, 100);

    expect(out.length).toBeLessThanOrEqual(122); // 100 + marker (truncation string exceeds the cap)
    expect(out.endsWith('…(truncated)')).toBe(true);
    // No mid-line cuts: last line is intact before the marker.
    const body = out.replace('\n…(truncated)', '');
    const lastLine = body.split('\n').pop()!;
    expect(lastLine).toMatch(/^baris-\d+$/);
  });

  it('keeps short text intact and always trims', () => {
    expect(truncateOnLineBoundary('  halo  ', 100)).toBe('halo');
    expect(truncateOnLineBoundary('x'.repeat(50), 100)).toBe('x'.repeat(50));
  });
});

describe('summarizeResult()', () => {
  it('summarizes written files, edited files, and the explanation', () => {
    const s = summarizeResult(
      'Core explanation.',
      [{ path: 'a.ts', success: true }, { path: 'b.ts', success: false }],
      [{ path: 'c.ts', success: true }],
    );
    expect(s).toContain('Files written: a.ts'); // failures are not listed
    expect(s).not.toContain('b.ts');
    expect(s).toContain('Files edited: c.ts');
    expect(s).toContain('Core explanation.');
  });

  it('explanation only when no files were touched', () => {
    expect(summarizeResult('only.', [], [])).toBe('only.');
  });
});

describe('historyToMessages()', () => {
  it('produces chronological user-assistant ordering per turn', () => {
    const msgs = historyToMessages([
      { user: 'u1', summary: 'a1' },
      { user: 'u2', summary: 'a2' },
    ]);
    expect(msgs.map((m) => [m.role, m.content])).toEqual([
      ['user', 'u1'],
      ['assistant', 'a1'],
      ['user', 'u2'],
      ['assistant', 'a2'],
    ]);
  });

  it('empty history produces an empty array', () => {
    expect(historyToMessages([])).toEqual([]);
  });
});

describe('boundedHistory()', () => {
  it('caps the number of turns to the last MAX_HISTORY_TURNS', () => {
    const turns = Array.from({ length: 10 }, (_, i) => ({ user: `u${i}`, summary: 'x' }));
    const out = boundedHistory(turns);
    expect(out.length).toBe(MAX_HISTORY_TURNS);
    expect(out[0].user).toBe(`u${10 - MAX_HISTORY_TURNS}`);
    expect(out.at(-1)!.user).toBe('u9');
  });

  it('drops the oldest turns until the char budget fits', () => {
    const big = 'x'.repeat(7000);
    const turns = [
      { user: big, summary: big }, // 14k > 12k sendirian
      { user: 'kecil', summary: 'kecil' },
    ];
    const out = boundedHistory(turns);
    expect(out.at(-1)!.user).toBe('kecil'); // giliran terakhir selalu dipertahankan
    expect(out.reduce((a, t) => a + t.user.length + t.summary.length, 0))
      .toBeLessThanOrEqual(MAX_HISTORY_CHARS + 1); // terakhir tak pernah dilepas
  });

  it('always keeps at least one turn (the last one)', () => {
    const turns = [{ user: 'x'.repeat(20000), summary: 'y'.repeat(20000) }];
    expect(boundedHistory(turns)).toHaveLength(1);
  });
});
