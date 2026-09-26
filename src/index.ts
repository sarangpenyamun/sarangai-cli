import { Command } from 'commander';
import chalk from 'chalk';
import readline from 'readline';
import { LOCKED_CODING_MODELS, resolveModel, findModel, MODEL_ALIAS_LIST, CodingModel } from './constants';
import { ensureAuthenticated } from './core/auth';
import { runAutonomousAgent, AgentRunResult } from './core/workspace';
import { createTui, TerminalTui } from './ui/tui';
import { HistoryTurn, summarizeResult, truncateOnLineBoundary } from './core/memory';
import type { UserStats } from './ui/banner';

const program = new Command();

program
  .name('sarang')
  .description('SarangAI Autonomous Coding Agent CLI')
  .version('1.1.0');

// ------------------------------------------------------------------ helpers

async function refreshStats(): Promise<UserStats | null> {
  try {
    const { stats } = await ensureAuthenticated();
    return stats;
  } catch {
    return null;
  }
}

function renderResultLines(result: AgentRunResult, model: CodingModel): string[] {
  const lines: string[] = [];    lines.push(chalk.bold.hex('#a78bfa')(`✔ [${model.name}] Work Summary & Fixes:`));

  if (result.writtenFiles.length > 0) {
    lines.push('');
    lines.push(chalk.bold.green('📁 Files Written/Updated:'));
    for (const f of result.writtenFiles) {
      const mark = f.success ? chalk.green('✔') : chalk.red('✖');
      lines.push(`  ${mark} ${chalk.white.bold(f.path)}`);
    }
  }

  if (result.editedFiles.length > 0) {
    lines.push('');
    lines.push(chalk.bold.green('✏️  Files Edited (str_replace):'));
    for (const f of result.editedFiles) {
      const mark = f.success ? chalk.green('✔') : chalk.red('✖');
      lines.push(`  ${mark} ${chalk.white.bold(f.path)}`);
    }
  }

  if (result.explanation) {
    lines.push('');
    lines.push(...result.explanation.split('\n'));
  }
  return lines;
}

function modelListLines(active: CodingModel): string[] {
  const lines = [chalk.yellow('Available Models (Locked):')];
  for (const m of Object.values(LOCKED_CODING_MODELS)) {
    const mark = m.alias === active.alias ? chalk.green('●') : chalk.gray('○');
    lines.push(`  ${mark} ${chalk.hex('#a78bfa')(m.alias.padEnd(10))} ${m.name.padEnd(22)} [${m.role}]`);
  }
  return lines;
}

/** Baris error untuk alias /model yang tidak dikenal — tanpa fallback diam-diam. */
function invalidModelLine(input: string): string {
  return chalk.red(
    `✖ Model '${input}' not found. Available: ${MODEL_ALIAS_LIST}.`,
  );
}

/** Terapkan model baru ke sesi + perbarui header TUI. */
function applyModel(session: Session, next: CodingModel): string {
  session.model = next;
  session.tui?.setHeader(session.stats, next);
  return chalk.green(`✔ Switched to: ${next.name}`);
}

function exitCleanly(): never {
  console.log(chalk.gray('\nGoodbye! Workspace closed.\n'));
  process.exit(0);
}

// -------------------------------------------------------------- session state

interface Session {
  tui: TerminalTui | null;
  stats: UserStats | null;
  model: CodingModel;
  busy: boolean;
  queue: string[];
  /** Memori percakapan in-memory sesi berjalan (multi-giliran). */
  history: HistoryTurn[];
}

async function executeTask(session: Session, input: string): Promise<void> {
  const { tui, model } = session;
  const startedAt = Date.now();

  session.busy = true;
  tui?.setStatus('busy', `[${model.name}] Analyzing requirements & designing solution...`, startedAt);

  try {
    const result = await runAutonomousAgent({
      model,
      userPrompt: input,
      history: session.history,
      onStatus: (label) => tui?.setStatus('busy', label, startedAt),
    });

    // Catat giliran ini ke memori sesi (ringkasan ketat, bukan respons mentah).
    session.history.push({
      user: input,
      summary: summarizeResult(result.explanation, result.writtenFiles, result.editedFiles),
    });

    const lines = renderResultLines(result, model);
    if (tui) {
      tui.appendLines(lines);
      tui.setStatus('info', `[${model.name}] Done — ${result.writtenFiles.length} file(s) written`);
      setTimeout(() => {
        if (tui.isActive && !session.busy) tui.setStatus('idle', '');
      }, 2500);
    } else {
      console.log(lines.join('\n'));
    }

    // Saldo real-time: refresh header setelah setiap tugas.
    const fresh = await refreshStats();
    if (fresh) {
      session.stats = fresh;
      tui?.setHeader(fresh, session.model);
    }
  } catch (err: any) {
    const msg = `✖ Error: ${err?.message ?? err}`;
    if (tui) {
      tui.appendLines([chalk.red(msg)]);
    } else {
      console.error(chalk.red(msg));
    }
  } finally {
    session.busy = false;
    tui?.setStatus('idle', '');
  }
}

/**
 * Satu pintu untuk SEMUA input (TUI maupun fallback). Mengembalikan 'exit'
 * bila user meminta keluar, antrean tugas ditangani oleh session.queue.
 */
async function processInput(session: Session, raw: string): Promise<'exit' | 'handled'> {
  const input = raw.trim();
  if (!input) return 'handled';
  const { tui } = session;

  const lower = input.toLowerCase();
  if (['exit', 'quit', '/exit', '/quit'].includes(lower)) {
    tui?.close();
    exitCleanly();
  }

  if (input === '/clear') {
    tui?.clearContent();
    // /clear also forgets the conversation: start from a clean context.
    session.history = [];
    const cleared = chalk.green('Session memory cleared.');
    if (tui) tui.appendLines([cleared]);
    else console.log(cleared);
    void refreshStats().then((fresh) => {
      if (fresh) {
        session.stats = fresh;
        tui?.setHeader(fresh, session.model);
      }
    });
    return 'handled';
  }

  if (input.startsWith('/model') || input.startsWith('/switch')) {
    const parts = input.split(/\s+/);
    const arg = parts.length > 1 ? parts[1]!.trim() : '';

    if (arg) {
      // Argumen eksplisit: validasi ketat — tidak ada fallback diam-diam.
      const found = findModel(arg);
      if (!found) {
        const line = chalk.red(
          `✖ Model '${arg}' not found. Available: ${MODEL_ALIAS_LIST}.`,
        );
        if (tui) tui.appendLines([line]);
        else console.log(line);
      } else {
        const line = applyModel(session, found);
        if (tui) tui.appendLines([line]);
        else console.log(line);
      }
    } else if (tui) {
      // /model tanpa argumen: buka kembali selector interaktif (mode session).
      tui.openModelMenu('session', session.model.alias);
    } else {
      const lines = modelListLines(session.model);
      console.log(lines.join('\n'));
    }
    return 'handled';
  }

  // Tugas agen: antre bila masih ada yang berjalan (input tidak pernah mati).
  if (session.busy) {
    session.queue.push(input);
    const line = chalk.gray(`⏳ Added to queue (position ${session.queue.length}).`);
    if (tui) tui.appendLines([line]);
    else console.log(line);
    return 'handled';
  }

  await executeTask(session, input);

  // Lanjutkan antrean tugas berikutnya (REPL tetap hidup).
  while (session.queue.length > 0) {
    const next = session.queue.shift();
    if (next) await executeTask(session, next);
  }
  return 'handled';
}

// -------------------------------------------------------------------- TUI mode

async function startWorkspace(modelAlias = 'glm', initialPrompt?: string): Promise<void> {
  let stats: UserStats | null = null;
  try {
    ({ stats } = await ensureAuthenticated());
  } catch (err: any) {
    console.error(chalk.red(`✖ ${err.message}`));
    process.exit(1);
  }

  const session: Session = {
    tui: null,
    stats,
    model: resolveModel(modelAlias),
    busy: false,
    queue: [],
    history: [],
  };

  const tui = createTui(
    {
      onSubmit: (text) => void processInput(session, text),
      onExit: () => exitCleanly(),
      onModelPick: (index) => {
        const models = Object.values(LOCKED_CODING_MODELS);
        const next = models[index];
        if (!next) return;
        const line = applyModel(session, next);
        if (tui.isStartupSelection) {
          // Startup transition: short status line, then the input box activates.
          tui.appendLines([
            chalk.green(`✔ Active model: ${next.name} (${next.role})`),
          ]);
        } else {
          tui.appendLines([line]);
        }
      },
    },
    { stats, model: session.model },
  );
  session.tui = tui;

  if (tui) {
    tui.start();

    // ---- STARTUP FLOW: pilih model DULU sebelum prompt chat aktif.
    // Prompt awal via CLI (-m / argumen) atau non-interaktif: lewati selector.
    const skipSelector = Boolean(initialPrompt?.trim()) || !process.stdin.isTTY;
    if (!skipSelector) {
      tui.openModelMenu('startup', session.model.alias);
    }

    // Prompt awal via CLI (sarang run "buat crud express") langsung dieksekusi.
    if (initialPrompt && initialPrompt.trim()) {
      void processInput(session, initialPrompt.trim());
    }
    // REPL hidup selamanya di dalam TUI — tidak ada jalur exit otomatis.
    return;
  }

  // -------------------------------------------------- fallback non-TTY (piped/CI)
  //
  // SEMUA baris dari stdin diproses BERURUTAN via antrean — tidak ada baris
  // yang terbuang saat tugas berjalan, dan EOF menunggu antrean selesai.
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  const banner = await import('./ui/banner');
  console.log(banner.bannerLines(stats).join('\n'));
  console.log(chalk.gray(`[Agent: ${chalk.bold.hex('#a78bfa')(session.model.name)} — ${session.model.role}]`));
  console.log(chalk.gray('Enter your coding task.  /model: switch model  /clear: clear context  exit: quit\n'));

  const pending: string[] = [];
  let draining = false;
  let inputClosed = false;

  const drain = async (): Promise<void> => {
    if (draining) return;
    draining = true;
    while (pending.length > 0) {
      const line = pending.shift()!;
      if (!line) continue;
      await processInput(session, line);
    }
    draining = false;
    if (inputClosed) exitCleanly();
    // Interaktif tanpa TTY (mis. some dumb terminals): tampilkan prompt standby.
    process.stdout.write(chalk.bold.hex('#c084fc')(`sarang(${session.model.alias})> `));
  };

  rl.on('line', (line) => {
    pending.push(line.trim());
    void drain();
  });

  rl.on('close', () => {
    // EOF: tunggu antrean & tugas berjalan selesai sebelum keluar.
    if (!draining && pending.length === 0 && !session.busy) exitCleanly();
    inputClosed = true;
    const wait = setInterval(() => {
      if (!draining && pending.length === 0 && !session.busy) {
        clearInterval(wait);
        exitCleanly();
      }
    }, 150);
  });
}

// ------------------------------------------------------------------- commands

program
  .command('run [prompt...]')
  .alias('workspace')
  .description('Mulai sesi autonomous coding (REPL interaktif)')
  .option('-m, --model <alias>', 'Model: glm | sonnet | luna | deepseek | mimo', 'glm')
  .action(async (promptParts: string[] | undefined, options) => {
    const initialPrompt = promptParts && promptParts.length > 0 ? promptParts.join(' ') : undefined;
    await startWorkspace(options.model, initialPrompt);
  });

program.action(async () => {
  await startWorkspace('glm');
});

program.parse(process.argv);
