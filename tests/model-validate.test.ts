import { describe, it, expect } from 'vitest';
import { findModel, resolveModel, MODEL_ALIAS_LIST, LOCKED_CODING_MODELS } from '../src/constants';

describe('findModel(): validasi ketat tanpa fallback', () => {
  it('menerima kelima alias resmi', () => {
    expect(findModel('glm')?.id).toBe('z-ai/glm-5.3-flash');
    expect(findModel('sonnet')?.id).toBe('anthropic/claude-sonnet-4.6');
    expect(findModel('luna')?.id).toBe('openai/gpt-5.6-luna');
    expect(findModel('deepseek')?.id).toBe('deepseek/deepseek-v3.2');
    expect(findModel('mimo')?.id).toBe('xiaomi/mimo-v2.5-pro');
  });

  it('menerima nama lengkap dan id (case-insensitive)', () => {
    expect(findModel('Claude Sonnet 4.6')?.alias).toBe('sonnet');
    expect(findModel('XIAOMI/MIMO-V2.5-PRO')?.alias).toBe('mimo');
  });

  it('mengembalikan null untuk typo — BUKAN fallback ke glm', () => {
    expect(findModel('sonneth')).toBeNull();
    expect(findModel('gpt')).toBeNull();
    expect(findModel('')).toBeNull();
    expect(findModel(undefined)).toBeNull();
  });

  it('MODEL_ALIAS_LIST berisi 5 alias urut untuk pesan error', () => {
    expect(MODEL_ALIAS_LIST).toBe('glm, sonnet, luna, deepseek, mimo');
    expect(Object.keys(LOCKED_CODING_MODELS)).toHaveLength(5);
  });

  it('resolveModel tetap fallback ke glm (khusus default CLI/config)', () => {
    expect(resolveModel('sonneth').alias).toBe('glm');
    expect(resolveModel('sonnet').alias).toBe('sonnet');
  });
});
