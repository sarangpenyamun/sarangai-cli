import chalk from 'chalk';
import { CodingModel, LOCKED_CODING_MODELS, MODEL_ALIAS_LIST } from '../constants';

/**
 * Model selector — modul PURE (tanpa I/O terminal) agar seluruh logika tombol
 * & rendering baris bisa diuji unit test. Dipakai TUI untuk dua mode:
 *
 *  - "startup": dipanggil langsung setelah header, SEBELUM input box aktif
 *    (fokus keyboard dimulai di menu, bukan di kotak prompt).
 *  - "session": dibuka kembali dari prompt via `/model` tanpa argumen.
 *
 * Navigasi: ↑/↓ atau j/k memindahkan sorotan; Enter mengunci pilihan;
 * Escape/q membatalkan; angka 1-5 memilih langsung.
 */

export type MenuMode = 'startup' | 'session';

export interface ModelMenuState {
  items: CodingModel[];
  cursor: number;
  /** Model yang sedang aktif (ditandai ◉ selain radio kursor). */
  activeAlias: string | null;
  mode: MenuMode;
}

export type MenuAction =
  | { kind: 'move'; cursor: number }
  | { kind: 'select'; index: number }
  | { kind: 'cancel' }
  /** Ctrl+C / Escape / q di mode startup: keluar dari aplikasi. */
  | { kind: 'abort' }
  | { kind: 'ignore' };

const BORDER_COLOR = chalk.hex('#5b21b6');
const ACCENT = chalk.hex('#c084fc');
const DIM = chalk.gray;

export const MENU_FOOTER =
  '↑/↓ or j/k: navigate   1-5: quick pick   Enter: confirm   Esc/q: cancel';

/** Urutan menu mengikuti spesifikasi: glm, sonnet, luna, deepseek, mimo. */
export function menuModels(): CodingModel[] {
  return Object.values(LOCKED_CODING_MODELS);
}

/** State awal menu; kursor menunjuk model aktif (atau 0). */
export function createModelMenuState(mode: MenuMode, activeAlias?: string): ModelMenuState {
  const items = menuModels();
  const cursor = activeAlias
    ? Math.max(0, items.findIndex((m) => m.alias === activeAlias))
    : 0;
  return { items, cursor, activeAlias: activeAlias ?? null, mode };
}

/**
 * Terapkan satu tombol ke state menu. MURNI: tidak menyentuh terminal.
 * - 'up' / 'k'      → highlight up (wrap-around)
 * - 'down' / 'j'    → highlight down (wrap-around)
 * - '1'..'5'        → quick pick
 * - Enter ('\r'/'\n') → confirm highlighted model
 * - Escape / 'q' / Ctrl+C → handled by the TUI layer (exit in startup mode)
 */
export function resolveMenuKey(key: string, state: ModelMenuState): MenuAction {
  const n = state.items.length;
  switch (key) {
    case '\x1b[A': // up arrow
    case 'k':
      return { kind: 'move', cursor: (state.cursor - 1 + n) % n };
    case '\x1b[B': // down arrow
    case 'j':
      return { kind: 'move', cursor: (state.cursor + 1) % n };
    case '1':
    case '2':
    case '3':
    case '4':
    case '5': {
      const index = Number(key) - 1;
      return index < n ? { kind: 'select', index } : { kind: 'ignore' };
    }
    case '\r':
    case '\n':
      return { kind: 'select', index: state.cursor };
    case '\x1b': // escape
    case 'q':
    case '\x03': // ctrl+c
      // Startup: exit aplikasi (jangan paksa user memilih untuk bisa keluar).
      return state.mode === 'startup' ? { kind: 'abort' } : { kind: 'cancel' };
    default:
      return { kind: 'ignore' };
  }
}

/** Satu baris isi menu (tanpa border) untuk mode non-TTY / unit test. */
export function formatModelMenuItem(m: CodingModel, selected: boolean, active: boolean): string {
  const radio = selected ? chalk.green('[●]') : chalk.gray('[ ]');
  const activeMark = active ? chalk.green(' ◉') : '';
  const name = `${m.alias.padEnd(10)}- ${m.name.padEnd(22)}(${m.role})`;
  const suffix = m.alias === 'glm' ? chalk.yellow(' [Default Recommendation]') : '';
  const line = `${radio} ${ACCENT(name)}${activeMark}${suffix}`;
  return selected ? chalk.bold(line) : line;
}

/** Header + isi + footer menu sebagai array baris siap render. */
export function buildModelMenuLines(state: ModelMenuState): string[] {
  const title =
    state.mode === 'startup'
      ? ' Select a Model '
      : ' Switch Model ';
  const lines: string[] = [
    '',
    BORDER_COLOR(`┌${'─'.repeat(66)}┐`),
    BORDER_COLOR('│') + chalk.bold.hex('#c084fc')(title.padEnd(66, '─')) + BORDER_COLOR('│'),
    BORDER_COLOR(`├${'─'.repeat(66)}┤`),
  ];
  state.items.forEach((m, i) => {
    const selected = i === state.cursor;
    const active = state.activeAlias === m.alias;
    lines.push(formatModelMenuItem(m, selected, active));
  });
  lines.push(BORDER_COLOR(`├${'─'.repeat(66)}┤`));
  lines.push(BORDER_COLOR('│') + DIM(` ${MENU_FOOTER}`.padEnd(66)) + BORDER_COLOR('│'));
  lines.push(BORDER_COLOR(`└${'─'.repeat(66)}┘`));
  lines.push('');
  return lines;
}

/**
 * Exit dari startup selector (Ctrl+C / Escape / q): pulihkan terminal dari
 * Alternate Screen Buffer, cetak pesan perpisahan, keluar bersih ke shell.
 */
export function abortStartupSelection(): never {
  process.stdout.write('\x1b[?25h\x1b[?1049l');
  console.log('Session aborted. Goodbye!');
  process.exit(0);
}
