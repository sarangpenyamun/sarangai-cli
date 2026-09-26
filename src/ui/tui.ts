import chalk from 'chalk';
import { SARANGAI_ASCII, formatAccountLine } from './banner';
import { CodingModel } from '../constants';
import {
  ModelMenuState,
  MenuAction,
  createModelMenuState,
  resolveMenuKey,
  buildModelMenuLines,
  abortStartupSelection,
  MenuMode,
} from './model-menu';
import type { UserStats } from './banner';

/**
 * TUI SarangAI — adaptasi pola arsitektur Codebuff (OpenTUI) yang
 * runtime-agnostic:
 *   - Alternate Screen Buffer: layar utama shell tidak tersentuh.
 *   - Header terkunci di atas (banner + akun + model + hint).
 *   - Viewport konten di tengah, pinned ke bawah (sticky scroll).
 *   - Status bar PERSIS 1 baris di atas kotak input, update in-place.
 *   - Kotak input rounded terkunci di baris paling bawah.
 *
 * Semua render dikirim sebagai SATU string write per frame (atomic, tanpa
 * flicker), dan hanya baris yang berubah saja yang ditulis ulang saat idle.
 * Tidak ada interval liar yang mengirim escape sequence turun baris.
 */

const BORDER = chalk.hex('#5b21b6');
const VIOLET = chalk.hex('#a78bfa');
const DIM = chalk.gray;

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const HINT_LINE = 'Enter your coding task.  /model: switch model  /clear: clear context  exit: quit';

export interface TuiStatus {
  kind: 'idle' | 'busy' | 'info';
  label: string;
  startedAt: number | null;
}

export interface TuiHeaderState {
  stats: UserStats | null;
  model: CodingModel;
}

export interface TuiOptions {
  onSubmit: (text: string) => void;
  onExit: () => void;
  /** Dipicu saat model dikunci di menu (startup maupun session). */
  onModelPick?: (index: number) => void;
}

const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;

function visibleWidth(line: string): number {
  return line.replace(ANSI_RE, '').length;
}

/** Wrap satu baris (boleh mengandung ANSI) ke lewat tertentu tanpa merusak warna. */
function wrapAnsiLine(line: string, width: number): string[] {
  if (line.length === 0) return [''];
  if (visibleWidth(line) <= width) return [line];

  const out: string[] = [];
  let current = '';
  let currentWidth = 0;
  let pendingAnsi = '';

  for (const token of line.split(/(\s+)/)) {
    let rest = token;
    while (rest.length > 0) {
      const ansiMatch = rest.match(/^\x1b\[[0-9;]*[A-Za-z]/);
      if (ansiMatch) {
        pendingAnsi += ansiMatch[0];
        rest = rest.slice(ansiMatch[0].length);
        continue;
      }
      const chunk = rest[0]!;
      if (currentWidth + 1 > width) {
        out.push(current + (pendingAnsi ? '' : ''));
        current = pendingAnsi;
        currentWidth = 0;
      }
      if (chunk === ' ' && currentWidth === 0) {
        rest = rest.slice(1);
        continue;
      }
      current += pendingAnsi + chunk;
      pendingAnsi = '';
      currentWidth += 1;
      rest = rest.slice(1);
    }
  }
  if (current.length > 0 || out.length === 0) out.push(current);
  return out;
}

export class TerminalTui {
  private readonly out: NodeJS.WriteStream;
  private readonly inp: NodeJS.ReadStream;
  private readonly onSubmit: (text: string) => void;
  private readonly onExit: (reason: string) => void;
  private readonly onModelPick?: (index: number) => void;

  private header: TuiHeaderState;
  private history: string[] = [];
  private scrollOffset = 0; // 0 = pinned ke bawah
  private input = '';
  private cursor = 0;
  private inputHistory: string[] = [];
  private inputHistoryIdx = -1;
  private status: TuiStatus = { kind: 'idle', label: '', startedAt: null };
  private spinnerIdx = 0;
  private tickTimer: NodeJS.Timeout | null = null;
  private renderQueued = false;
  private lastFullFrame = '';
  private active = false;
  /**
   * Menu model aktif (startup maupun session): fokus keyboard penuh di menu,
   * kotak input di bawah tetap digambar (dim) tanpa pergeseran layout.
   */
  private menu: ModelMenuState | null = null;
  private readonly keyHandler: (chunk: Buffer) => void;
  private readonly resizeHandler: () => void;

  constructor(opts: TuiOptions, header: TuiHeaderState) {
    this.out = process.stdout;
    this.inp = process.stdin;
    this.onSubmit = opts.onSubmit;
    this.onExit = opts.onExit;
    this.onModelPick = opts.onModelPick;
    this.header = header;

    this.keyHandler = (chunk: Buffer) => this.handleKey(chunk);
    this.resizeHandler = () => this.requestRender(true);

    this.out.on('resize', this.resizeHandler);
  }

  // ---------------------------------------------------------------- lifecycle

  start(): void {
    this.active = true;
    this.out.write('\x1b[?1049h\x1b[?25l'); // alternate screen + sembunyikan kursor
    this.inp.setRawMode(true);
    this.inp.resume();
    this.inp.on('data', this.keyHandler);
    this.requestRender(true);
  }

  close(): void {
    if (!this.active) return;
    this.active = false;
    this.stopTick();
    this.inp.removeListener('data', this.keyHandler);
    this.inp.setRawMode(false);
    this.inp.pause();
    this.out.write('\x1b[?25h\x1b[?1049l'); // kembalikan layar utama
  }

  // ------------------------------------------------------------- public state

  setHeader(stats: UserStats | null, model: CodingModel): void {
    this.header = { stats, model };
    this.requestRender(true);
  }

  appendLines(lines: string[]): void {
    for (const line of lines) {
      const wrapped = wrapAnsiLine(line, Math.max(10, this.width() - 3));
      this.history.push(...wrapped);
    }
    if (this.history.length > 5000) {
      this.history = this.history.slice(-4000);
    }
    this.scrollOffset = 0;
    this.requestRender(true);
  }

  setStatus(kind: TuiStatus['kind'], label: string, startedAt: number | null = null): void {
    this.status = { kind, label, startedAt };
    if (kind === 'busy') {
      this.startTick();
    } else {
      this.stopTick();
    }
    this.requestRender(false);
  }

  clearContent(): void {
    this.history = [];
    this.scrollOffset = 0;
    this.requestRender(true);
  }

  // ------------------------------------------------------------- menu /model

  /**
   * Buka menu pemilihan model: FOKUS KEYBOARD dialihkan ke menu. Selama menu
   * terbuka, panah atas/bawah TIDAK menggeser kursor/riwayat kotak input.
   * Mode 'startup': Escape/q/Ctrl+C mengakhiri sesi (terminal dipulihkan).
   */
  openModelMenu(mode: MenuMode, activeAlias?: string): void {
    this.menu = createModelMenuState(mode, activeAlias);
    this.inputHistoryIdx = -1;
    this.requestRender(true);
  }

  /** Tutup menu dan kembalikan fokus ke kotak input bawah. */
  closeModelMenu(): void {
    this.menu = null;
    this.requestRender(true);
  }

  get isModelMenuOpen(): boolean {
    return this.menu !== null;
  }

  get isStartupSelection(): boolean {
    return this.menu?.mode === 'startup';
  }

  /** Proses satu tombol menu. */
  private handleMenuKey(key: string): void {
    if (!this.menu) return;
    const action: MenuAction = resolveMenuKey(key, this.menu);
    switch (action.kind) {
      case 'move':
        this.menu.cursor = action.cursor;
        this.requestRender(true);
        break;
      case 'select': {
        const idx = action.index;
        this.closeModelMenu();
        this.onModelPick?.(idx);
        break;
      }
      case 'cancel':
        this.closeModelMenu();
        break;
      case 'abort':
        // Ctrl+C / Escape / q di startup selector: pulihkan terminal & keluar.
        this.close();
        abortStartupSelection();
        break;
      case 'ignore':
        break;
    }
  }

  /** Baris menu modal — rendering diserahkan ke modul pure model-menu.ts. */
  private modelMenuLines(): string[] {
    if (!this.menu) return [];
    return buildModelMenuLines(this.menu);
  }

  get isActive(): boolean {
    return this.active;
  }

  // -------------------------------------------------------------- timer kecil

  private startTick(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => {
      this.spinnerIdx = (this.spinnerIdx + 1) % SPINNER_FRAMES.length;
      // Update in-place HANYA baris status — tidak menyentuh baris lain.
      this.requestRender(false);
    }, 120);
  }

  private stopTick(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  // ------------------------------------------------------------------ layout

  private width(): number {
    return Math.max(20, this.out.columns || 80);
  }

  private height(): number {
    return Math.max(12, this.out.rows || 24);
  }

  private headerLines(): string[] {
    const w = this.width();
    // Tepat 12 baris, selalu: 6 ASCII + 3 garis + akun + model + hint.
    const lines = SARANGAI_ASCII.split('\n');
    lines.push(BORDER('━'.repeat(Math.min(w, 68))));
    lines.push(formatAccountLine(this.header.stats));
    lines.push(BORDER('━'.repeat(Math.min(w, 68))));
    lines.push(
      DIM(`[Agent: ${VIOLET.bold(this.header.model.name)} — ${this.header.model.role}]`),
    );
    lines.push(DIM(HINT_LINE));
    lines.push(BORDER('━'.repeat(Math.min(w, 68))));
    return lines;
  }

  private statusLine(): string {
    const { kind, label, startedAt } = this.status;
    if (kind === 'busy') {
      const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      const frame = SPINNER_FRAMES[this.spinnerIdx];
      const time = elapsed > 0 ? ` ${chalk.gray(`${elapsed}s`)}` : '';
      return `${VIOLET(frame)} ${chalk.hex('#c084fc')(label)}${time}`;
    }
    if (kind === 'info') {
      return `${chalk.green('✔')} ${chalk.gray(label)}`;
    }
    return DIM(`${this.header.model.alias} ready — awaiting instructions`);
  }

  private inputBoxLines(): string[] {
    const w = Math.min(this.width(), 80);
    const inner = w - 4; // border kiri/kanan + padding 1
    const prompt = `sarang(${this.header.model.alias})`;
    const prefix = `${prompt}> `;
    // Saat startup selection, kotak input tetap digambar (dim, placeholder)
    // agar TIDAK ADA pergeseran layout saat menu ditutup.
    const effectiveInput = this.menu?.mode === 'startup'
      ? (this.input || 'Select a model first...')
      : this.input;
    const dimAll = this.menu?.mode === 'startup';

    const before = effectiveInput.slice(0, this.cursor);
    const at = effectiveInput[this.cursor] ?? ' ';
    const after = effectiveInput.slice(this.cursor + 1);
    const shown = (before + at + after).slice(0, inner - prefix.length - 1);

    const bodyBase =
      chalk.hex('#c084fc')(prefix) +
      shown +
      ' '.repeat(Math.max(0, inner - prefix.length - visibleWidth(shown)));
    const body = dimAll ? DIM(bodyBase) : bodyBase;
    return [
      chalk.hex('#5b21b6')(`╭${'─'.repeat(w - 2)}╮`),
      chalk.hex('#5b21b6')('│ ') + body + chalk.hex('#5b21b6')(' │'),
      chalk.hex('#5b21b6')(`╰${'─'.repeat(w - 2)}╯`),
    ];
  }

  // ------------------------------------------------------------------ render

  private requestRender(force: boolean): void {
    if (!this.active || this.renderQueued) return;
    if (!force) {
      // Coalesce: render maksimal sekali per tick untuk hemat I/O.
      this.renderQueued = true;
      setImmediate(() => {
        this.renderQueued = false;
        this.render();
      });
      return;
    }
    this.renderQueued = true;
    setImmediate(() => {
      this.renderQueued = false;
      this.render();
    });
  }

  private render(): void {
    if (!this.active) return;
    const w = this.width();
    const h = this.height();

    const header = this.headerLines();
    const status = [this.statusLine()];
    // Modal menimpa viewport tengah; kotak input bawah TIDAK bergeser.
    const modal = this.menu ? this.modelMenuLines() : [];
    const inputBox = this.inputBoxLines();

    // Rows: header | viewport | status | input(3)
    const fixedRows = header.length + status.length + inputBox.length;
    const viewportHeight = Math.max(1, h - fixedRows);

    const start = Math.max(0, this.history.length - viewportHeight - this.scrollOffset);
    const visible = this.history.slice(start, start + viewportHeight);

    const parts: string[] = [];
    let row = 1;
    const emit = (text: string) => {
      parts.push(`\x1b[${row};1H\x1b[K${text}`);
      row += 1;
    };

    for (const line of header) emit(line);
    for (let i = 0; i < viewportHeight; i++) {
      const contentIdx = start + i;
      if (this.menu && i < modal.length) {
        // Modal digambar menimpa viewport — layout header/status/input utuh.
        emit(modal[i]);
      } else if (contentIdx < this.history.length) {
        emit(this.history[contentIdx] ?? '');
      } else {
        emit('');
      }
    }
    for (const line of status) emit(line);
    for (const line of inputBox) emit(line);

    // Bersihkan baris sisa dari frame sebelumnya (resize menyusut).
    if (row <= h) parts.push(`\x1b[${row};1H\x1b[J`);

    const frame = parts.join('');
    // Tulis hanya jika frame berubah ATAU baris status berubah — cek murah.
    if (frame !== this.lastFullFrame) {
      this.out.write(frame);
      this.lastFullFrame = frame;
    }
  }

  // ------------------------------------------------------------------- input

  private handleKey(chunk: Buffer): void {
    const key = chunk.toString('utf8');

    // ---- Mode menu model: semua tombol dikonsumsi menu, bukan kotak input.
    if (this.menu) {
      this.handleMenuKey(key);
      return;
    }

    if (key === '\x03') {
      // Ctrl+C: keluar bersih dari REPL.
      this.close();
      this.onExit('ctrl-c');
      return;
    }
    if (key === '\r' || key === '\n') {
      const text = this.input.trim();
      this.input = '';
      this.cursor = 0;
      if (text.length === 0) {
        this.requestRender(false);
        return;
      }
      this.inputHistory.push(text);
      this.inputHistoryIdx = -1;
      this.appendLines([chalk.hex('#7c3aed')(`❯ ${text}`)]);
      this.onSubmit(text);
      return;
    }
    if (key === '\x7f' || key === '\b') {
      if (this.cursor > 0) {
        this.input = this.input.slice(0, this.cursor - 1) + this.input.slice(this.cursor);
        this.cursor -= 1;
        this.requestRender(false);
      }
      return;
    }
    if (key === '\x1b[A') {
      // Panah atas: riwayat input.
      if (this.inputHistory.length === 0) return;
      if (this.inputHistoryIdx === -1) this.inputHistoryIdx = this.inputHistory.length - 1;
      else this.inputHistoryIdx = Math.max(0, this.inputHistoryIdx - 1);
      this.input = this.inputHistory[this.inputHistoryIdx] ?? '';
      this.cursor = this.input.length;
      this.requestRender(false);
      return;
    }
    if (key === '\x1b[B') {
      if (this.inputHistoryIdx === -1) return;
      this.inputHistoryIdx += 1;
      if (this.inputHistoryIdx >= this.inputHistory.length) {
        this.inputHistoryIdx = -1;
        this.input = '';
      } else {
        this.input = this.inputHistory[this.inputHistoryIdx] ?? '';
      }
      this.cursor = this.input.length;
      this.requestRender(false);
      return;
    }
    if (key === '\x1b[C') {
      if (this.cursor < this.input.length) {
        this.cursor += 1;
        this.requestRender(false);
      }
      return;
    }
    if (key === '\x1b[D') {
      if (this.cursor > 0) {
        this.cursor -= 1;
        this.requestRender(false);
      }
      return;
    }
    if (key === '\x1b[H' || key === '\x1b[1~') {
      this.cursor = 0;
      this.requestRender(false);
      return;
    }
    if (key === '\x1b[F' || key === '\x1b[4~') {
      this.cursor = this.input.length;
      this.requestRender(false);
      return;
    }
    if (key === '\x1b[3~') {
      // Delete: hapus karakter di depan kursor.
      if (this.cursor < this.input.length) {
        this.input = this.input.slice(0, this.cursor) + this.input.slice(this.cursor + 1);
        this.requestRender(false);
      }
      return;
    }
    if (key === '\x1b') {
      // Escape polos: abaikan (tidak exit — REPL harus tetap hidup).
      return;
    }

    // Karakter biasa & paste. Newline di dalam chunk menandakan submit
    // (typed-ahead via pty / paste multi-barisan): setiap baris lengkap
    // dikirim berurutan (antrean REPL menangani giliran), sisanya tetap
    // di buffer input.
    if (key.includes('\r') || key.includes('\n')) {
      const segments = key.split(/\r\n|\r|\n/);
      const remainder = segments.pop() ?? '';
      const linesToSubmit: string[] = [];
      for (let i = 0; i < segments.length; i++) {
        linesToSubmit.push((i === 0 ? this.input : '') + (segments[i] ?? ''));
      }
      this.input = remainder.replace(/[\r\n]/g, '');
      this.cursor = this.input.length;
      for (const line of linesToSubmit) {
        const text = line.trim();
        if (text.length === 0) continue;
        this.inputHistory.push(text);
        this.inputHistoryIdx = -1;
        this.appendLines([chalk.hex('#7c3aed')(`❯ ${text}`)]);
        this.onSubmit(text);
      }
      this.requestRender(false);
      return;
    }
    if (!key.includes('\x1b') && key.length > 0) {
      this.input = this.input.slice(0, this.cursor) + key + this.input.slice(this.cursor);
      this.cursor += key.length;
      this.requestRender(false);
    }
  }
}

/** Buat TUI hanya bila stdin/stdout benar-benar TTY interaktif. */
export function createTui(opts: TuiOptions, header: TuiHeaderState): TerminalTui | null {
  if (!process.stdout.isTTY || !process.stdin.isTTY) return null;
  return new TerminalTui(opts, header);
}

export { formatAccountLine };
