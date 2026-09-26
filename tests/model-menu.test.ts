import { describe, it, expect } from 'vitest';
import {
  createModelMenuState,
  resolveMenuKey,
  buildModelMenuLines,
  formatModelMenuItem,
  menuModels,
  ModelMenuState,
} from '../src/ui/model-menu';

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function startup(): ModelMenuState {
  return createModelMenuState('startup', 'glm');
}

function session(): ModelMenuState {
  return createModelMenuState('session', 'luna');
}

describe('menuModels()', () => {
  it('returns the 5 models in specification order', () => {
    expect(menuModels().map((m) => m.alias)).toEqual([
      'glm', 'sonnet', 'luna', 'deepseek', 'mimo',
    ]);
  });
});

describe('createModelMenuState()', () => {
  it('initial cursor points at the active model', () => {
    expect(startup().cursor).toBe(0); // glm is active
    expect(session().cursor).toBe(2); // luna is at index 2
  });

  it('without an active model, the cursor starts at 0', () => {
    expect(createModelMenuState('startup').cursor).toBe(0);
  });
});

describe('resolveMenuKey(): navigation', () => {
  it('up arrow / k moves the highlight up with wrap-around', () => {
    const s = startup();
    expect(resolveMenuKey('\x1b[A', s)).toEqual({ kind: 'move', cursor: 4 });
    expect(resolveMenuKey('k', s)).toEqual({ kind: 'move', cursor: 4 });
  });

  it('down arrow / j moves the highlight down with wrap-around', () => {
    const s = startup();
    expect(resolveMenuKey('\x1b[B', s)).toEqual({ kind: 'move', cursor: 1 });
    expect(resolveMenuKey('j', s)).toEqual({ kind: 'move', cursor: 1 });
    const end = createModelMenuState('session', 'mimo');
    expect(resolveMenuKey('j', end)).toEqual({ kind: 'move', cursor: 0 });
  });
});

describe('resolveMenuKey(): number shortcuts 1-5', () => {
  it('digits select the matching index directly', () => {
    for (let i = 1; i <= 5; i++) {
      expect(resolveMenuKey(String(i), startup())).toEqual({ kind: 'select', index: i - 1 });
    }
  });
});

describe('resolveMenuKey(): Enter, cancel, abort, and other keys', () => {
  it('Enter confirms the current cursor', () => {
    expect(resolveMenuKey('\r', session())).toEqual({ kind: 'select', index: 2 });
    expect(resolveMenuKey('\n', session())).toEqual({ kind: 'select', index: 2 });
  });

  it('Escape/q cancels in session mode', () => {
    expect(resolveMenuKey('\x1b', session())).toEqual({ kind: 'cancel' });
    expect(resolveMenuKey('q', session())).toEqual({ kind: 'cancel' });
  });

  it('Escape/q/Ctrl+C request abort in startup mode (user can always quit)', () => {
    expect(resolveMenuKey('\x1b', startup())).toEqual({ kind: 'abort' });
    expect(resolveMenuKey('q', startup())).toEqual({ kind: 'abort' });
    expect(resolveMenuKey('\x03', startup())).toEqual({ kind: 'abort' });
  });

  it('random keys are ignored', () => {
    expect(resolveMenuKey('x', startup())).toEqual({ kind: 'ignore' });
    expect(resolveMenuKey('\x1b[C', startup())).toEqual({ kind: 'ignore' });
  });
});

describe('rendering menu', () => {
  it('menu rows contain [●]/[ ] radio, alias, name, role, and the glm default label', () => {
    const lines = buildModelMenuLines(startup()).map(stripAnsi);
    const glm = lines.find((l) => l.includes('glm'));
    const sonnet = lines.find((l) => l.includes('sonnet'));
    expect(glm).toContain('[●]');
    expect(glm).toContain('GLM 5.3 Flash');
    expect(glm).toContain('(Rapid Scaffolder)');
    expect(glm).toContain('[Default Recommendation]');
    expect(sonnet).toContain('[ ]');
    expect(sonnet).not.toContain('Recommendation');
  });

  it('footer contains the full navigation hints', () => {
    const joined = buildModelMenuLines(session()).map(stripAnsi).join('\n');
    expect(joined).toContain('1-5: quick pick');
    expect(joined).toContain('Enter: confirm');
    expect(joined).toContain('Esc/q: cancel');
  });

  it('formatModelMenuItem marks the active model with ◉', () => {
    const m = menuModels()[2];
    const withActive = stripAnsi(formatModelMenuItem(m, true, true));
    expect(withActive).toContain('◉');
    expect(withActive).toContain('[●]');
  });
});
