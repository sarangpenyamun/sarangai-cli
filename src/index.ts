import { Command } from 'commander';
import chalk from 'chalk';
import readline from 'readline';
import { execSync } from 'child_process';
import crypto from 'crypto';
import clipboard from 'clipboardy';
import { getConfig, saveConfig } from './config';

const program = new Command();

const borderActive = chalk.hex('#a855f7');
const borderMuted = chalk.hex('#334155');
const violetText = chalk.hex('#c084fc');
const greenDot = chalk.hex('#4ade80');
const grayMuted = chalk.hex('#94a3b8');

export interface CodingModel {
  id: string;
  name: string;
  desc: string;
  rate: string;
}

export const CODING_MODELS: CodingModel[] = [
  {
    id: 'anthropic/claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet',
    desc: 'Anthropic • Best coding & agentic workflow',
    rate: '12,000 Credits/hr',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    desc: 'OpenAI • Fast full-stack & complex logic',
    rate: '5,000 Credits/hr',
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek-R1',
    desc: 'DeepSeek • Deep reasoning & hard algorithms',
    rate: '1,500 Credits/hr',
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder',
    desc: 'Alibaba • Multi-language syntax specialist',
    rate: '700 Credits/hr',
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    desc: 'Google • 1M context & full repo analysis',
    rate: '500 Credits/hr',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    desc: 'Meta • Robust open-source coding engine',
    rate: '600 Credits/hr',
  },
];

function resolveBaseUrl(): string {
  const cfg = getConfig();
  return process.env.SARANGAI_BASE_URL || cfg.baseUrl || 'https://idshop.or.id';
}

function copyToClipboard(text: string) {
  try {
    clipboard.writeSync(text);
  } catch {
    try {
      execSync(`echo -n "${text}" | xclip -selection clipboard 2>/dev/null || echo -n "${text}" | pbcopy 2>/dev/null || echo | set /p="${text}" | clip 2>/dev/null`);
    } catch {}
  }
}

async function fetchUserMeta(baseUrl: string, apiKey: string) {
  try {
    const res = await fetch(`${baseUrl}/api/user/stats`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const d = await res.json();
      return {
        balance: d.balance ?? 75313,
        tier: d.tier || 'DEVELOPER',
        accountId: d.accountId || 'SA-8WwREVSJ',
      };
    }
  } catch {}
  return { balance: 75313, tier: 'DEVELOPER', accountId: 'SA-8WwREVSJ' };
}

function getDisplayDir() {
  const cwd = process.cwd();
  const home = process.env.HOME || '/root';
  if (cwd.startsWith(home)) {
    return '~' + cwd.slice(home.length);
  }
  return cwd;
}

// Menghitung margin padding kiri agar elemen selalu berada tepat di tengah
function getCenterPad(contentWidth: number = 72): string {
  const termCols = process.stdout.columns || 80;
  const padLen = Math.max(2, Math.floor((termCols - contentWidth) / 2));
  return ' '.repeat(padLen);
}

function renderCard(model: CodingModel, isFocused: boolean, cardWidth: number, pad: string): string[] {
  const borderFn = isFocused ? borderActive : borderMuted;
  const prefix = isFocused ? chalk.cyan.bold('› ') : '  ';
  const innerW = cardWidth - 2;

  const rawL1 = `  ${model.name}  •  ${model.desc}`;
  const padL1 = Math.max(0, innerW - rawL1.length);
  const line1 = `${prefix}${chalk.bold.white(model.name)}  •  ${grayMuted(model.desc)}${' '.repeat(padL1)}`;

  const rawL2 = `                 ${model.rate}`;
  const padL2 = Math.max(0, innerW - rawL2.length);
  const line2 = `                 ${violetText.bold(model.rate)}${' '.repeat(padL2)}`;

  return [
    pad + borderFn('┌' + '─'.repeat(innerW) + '┐'),
    pad + borderFn('│') + line1 + borderFn('│'),
    pad + borderFn('│') + line2 + borderFn('│'),
    pad + borderFn('└' + '─'.repeat(innerW) + '┘'),
  ];
}

// -------------------------------------------------------------
// LAYAR 1: MODAL SELEKSI MODEL (TENGAH PRESISI)
// -------------------------------------------------------------
function drawSelectionModal(
  activeModel: CodingModel,
  userMeta: { balance: number; tier: string; accountId: string },
  expanded: boolean,
  cursorIdx: number,
  copiedNotice = false
) {
  const cardWidth = 72;
  const pad = getCenterPad(cardWidth);
  const lines: string[] = [];

  const banner = [
    '███████╗ █████╗ ██████╗  █████╗ ███╗   ██╗ ██████╗  █████╗ ██╗',
    '██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗  ██║██╔════╝ ██╔══██╗██║',
    '███████╗███████║██████╔╝███████║██╔██╗ ██║██║  ███╗███████║██║',
    '╚════██║██╔══██║██╔══██╗██╔══██║██║╚██╗██║██║   ██║██╔══██║██║',
    '███████║██║  ██║██║  ██║██║  ██║██║ ╚████║╚██████╔╝██║  ██║██║',
    '╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝',
  ];
  banner.forEach(l => lines.push(pad + chalk.white.bold(l)));
  lines.push('');

  lines.push(
    pad +
    chalk.bold.white('Start coding for SarangAI') +
    '   ' +
    greenDot('●●●●●○') +
    ' '.repeat(30) +
    chalk.gray('✕')
  );
  lines.push('');

  if (!expanded) {
    lines.push(...renderCard(activeModel, cursorIdx === 0, cardWidth, pad));
    lines.push('');

    const balanceStr = `${Number(userMeta.balance).toLocaleString()} Credits`;
    lines.push(
      pad +
      chalk.bold.white(userMeta.tier) +
      chalk.gray('  •  ') +
      chalk.yellow.bold(balanceStr) +
      chalk.gray(' remaining  •  ') +
      chalk.hex('#a855f7')(userMeta.accountId)
    );
    lines.push('');

    const isSeeAllActive = cursorIdx === 1;
    const seeAllPrefix = isSeeAllActive ? chalk.cyan.bold('› ') : '  ';
    const seeAllText = isSeeAllActive 
      ? chalk.bold.cyan.underline(`↓  See all ${CODING_MODELS.length} models`)
      : chalk.hex('#a855f7')(`↓  See all ${CODING_MODELS.length} models`);
    lines.push(pad + seeAllPrefix + seeAllText);
    lines.push('');

    const isStartActive = cursorIdx === 2;
    lines.push(pad + (isStartActive ? chalk.green.bold('› [🚀 Start Coding Workspace ↵]') : chalk.white('  [🚀 Start Coding Workspace ↵]')));
    lines.push('');

    lines.push(pad + chalk.gray('✦ Refer friends  →  manage credits:'));
    lines.push('');

    const isCopyActive = cursorIdx === 3;
    const copyPrefix = isCopyActive ? chalk.cyan.bold('› ') : '  ';
    const copyLabel = isCopyActive ? chalk.bold.cyan.underline('📋 Copy invite / dashboard link') : chalk.white('📋 Copy invite / dashboard link');
    lines.push(pad + copyPrefix + copyLabel);

  } else {
    CODING_MODELS.forEach((m, idx) => {
      lines.push(...renderCard(m, cursorIdx === idx + 10, cardWidth, pad));
    });
    lines.push('');

    const balanceStr = `${Number(userMeta.balance).toLocaleString()} Credits`;
    lines.push(
      pad +
      chalk.bold.white(userMeta.tier) +
      chalk.gray('  •  ') +
      chalk.yellow.bold(balanceStr) +
      chalk.gray(' remaining  •  ') +
      chalk.hex('#a855f7')(userMeta.accountId)
    );
    lines.push('');

    const isFewerActive = cursorIdx === 20;
    const fewerPrefix = isFewerActive ? chalk.cyan.bold('› ') : '  ';
    const fewerText = isFewerActive
      ? chalk.bold.cyan.underline('↑  Show fewer')
      : chalk.hex('#a855f7')('↑  Show fewer');
    lines.push(pad + fewerPrefix + fewerText);
  }

  if (copiedNotice) {
    lines.push('');
    lines.push(pad + chalk.green('✔ Dashboard link copied to clipboard: https://idshop.or.id/user/dashboard'));
  }

  lines.push('');
  lines.push(pad + chalk.gray('─'.repeat(cardWidth)));
  lines.push(pad + chalk.gray('Navigasi: [↑/↓ Panah]  •  [Enter/Space] Pilih  •  [c] Copy Link  •  [q] Keluar'));

  process.stdout.write('\x1b[2J\x1b[3J\x1b[H\x1b[?25l' + lines.join('\n'));
}

// -------------------------------------------------------------
// LAYAR 2: WORKSPACE CODING (TENGAH PRESISI)
// -------------------------------------------------------------
function drawWorkspaceScreen(model: CodingModel, timeLeftSec: number, userInput: string) {
  const boxWidth = 72;
  const pad = getCenterPad(boxWidth);

  const banner = [
    '███████╗ █████╗ ██████╗  █████╗ ███╗   ██╗ ██████╗  █████╗ ██╗',
    '██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗  ██║██╔════╝ ██╔══██╗██║',
    '███████╗███████║██████╔╝███████║██╔██╗ ██║██║  ███╗███████║██║',
    '╚════██║██╔══██║██╔══██╗██╔══██║██║╚██╗██║██║   ██║██╔══██║██║',
    '███████║██║  ██║██║  ██║██║  ██║██║ ╚████║╚██████╔╝██║  ██║██║',
    '╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝',
  ];

  const lines: string[] = [];
  banner.forEach(l => lines.push(pad + chalk.white.bold(l)));
  lines.push('');
  lines.push(pad + chalk.white('SarangAI will run commands on your behalf to help you build.'));
  lines.push('');
  lines.push(pad + chalk.bold.white('Directory ') + chalk.gray(getDisplayDir()));
  lines.push('');

  // Status Bar
  const m = Math.floor(timeLeftSec / 60);
  const s = timeLeftSec % 60;
  const timeFormatted = `${m}m ${s < 10 ? '0' : ''}${s}s left`;
  const statusLeft = ` ${model.name}  •  ${timeFormatted}`;
  const statusRight = `[Esc] End session `;
  const spaceBetween = Math.max(2, boxWidth - statusLeft.length - statusRight.length);
  const statusBar = chalk.bgHex('#1e293b').white.bold(statusLeft + ' '.repeat(spaceBetween) + chalk.gray(statusRight));
  lines.push(pad + statusBar);

  // Kotak Border Utuh
  const innerWidth = boxWidth - 2;
  const borderTop = '┌' + '─'.repeat(innerWidth) + '┐';
  const borderBottom = '└' + '─'.repeat(innerWidth) + '┘';

  const textContent = userInput ? userInput : chalk.gray('Enter a coding task or / for commands');
  const visibleLen = userInput ? userInput.length : 37;
  const paddingRight = Math.max(0, innerWidth - 2 - visibleLen);
  const middleLine = `│  ${textContent}${' '.repeat(paddingRight)}│`;

  lines.push(pad + chalk.gray(borderTop));
  const inputRowNumber = lines.length + 1;
  lines.push(pad + chalk.gray(middleLine));
  lines.push(pad + chalk.gray(borderBottom));

  process.stdout.write('\x1b[2J\x1b[3J\x1b[H' + lines.join('\n'));

  // Posisi kursor dinamis mengikuti margin tengah
  const cursorCol = pad.length + 3 + userInput.length + 1;
  process.stdout.write(`\x1b[${inputRowNumber};${cursorCol}H\x1b[?25h`);
}

// Global Variables
let inWorkspace = false;
let isExecuting = false;
let expanded = false;
let cursorIdx = 0;
let copiedNotice = false;
let activeModel: CodingModel;
let userMeta: { balance: number; tier: string; accountId: string };
let sessionTimeLeft = 3600;
let timerInterval: any = null;
let currentTaskInput = '';
let cfg: any;
let baseUrl: string;

function cleanupAndExit() {
  if (timerInterval) clearInterval(timerInterval);
  process.stdout.write('\x1b[?1049l\x1b[?25h\n');
  process.exit(0);
}

function triggerCopyLink() {
  copyToClipboard('https://idshop.or.id/user/dashboard');
  copiedNotice = true;
  drawSelectionModal(activeModel, userMeta, expanded, cursorIdx, copiedNotice);
}

function leaveWorkspace() {
  inWorkspace = false;
  isExecuting = false;
  if (timerInterval) clearInterval(timerInterval);
  currentTaskInput = '';
  process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
  drawSelectionModal(activeModel, userMeta, expanded, cursorIdx, copiedNotice);
}

function enterWorkspace() {
  inWorkspace = true;
  isExecuting = false;
  currentTaskInput = '';

  drawWorkspaceScreen(activeModel, sessionTimeLeft, currentTaskInput);

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (sessionTimeLeft > 0) {
      sessionTimeLeft--;
      if (inWorkspace && !isExecuting) {
        drawWorkspaceScreen(activeModel, sessionTimeLeft, currentTaskInput);
      }
    }
  }, 1000);
}

async function runPromptStream(query: string) {
  isExecuting = true;
  process.stdout.write('\x1b[?25l');

  const pad = getCenterPad(72);
  console.log('\n\n' + pad + chalk.bold.hex('#c084fc')(`› Task: ${query}`));
  console.log(pad + chalk.gray(`[Generating with ${activeModel.name}...]\n`));

  try {
    const res = await fetch(`${baseUrl}/api/gateway/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: activeModel.id,
        messages: [{ role: 'user', content: query }],
        stream: true,
      }),
    });

    if (!res.ok) {
      console.log(pad + chalk.red(`\nError: ${res.statusText}\n`));
    } else {
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const linesArr = chunk.split('\n');
          for (const l of linesArr) {
            if (l.startsWith('data: ') && l !== 'data: [DONE]') {
              try {
                const p = JSON.parse(l.slice(6));
                const delta = p.choices?.[0]?.delta?.content;
                if (delta) process.stdout.write(delta);
              } catch {}
            }
          }
        }
        console.log('\n');
      }
    }
  } catch (err: any) {
    console.log(pad + chalk.red(`\nError: ${err.message}\n`));
  }

  console.log(pad + chalk.gray('\nTekan sembarang tombol untuk kembali ke workspace...'));
  
  process.stdin.once('keypress', () => {
    isExecuting = false;
    currentTaskInput = '';
    drawWorkspaceScreen(activeModel, sessionTimeLeft, currentTaskInput);
  });
}

async function handleAutoAuth(baseUrl: string): Promise<string | null> {
  const sessionCode = 'SA-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const authUrl = `${baseUrl}/auth/cli?code=${sessionCode}`;

  console.clear();
  const pad = getCenterPad(72);
  console.log('\n' + pad + violetText.bold('🔐 Sesi Otorisasi CLI Diperlukan\n'));
  copyToClipboard(authUrl);
  console.log(pad + chalk.white('Buka URL berikut untuk mengizinkan:'));
  console.log(pad + violetText.underline(authUrl));
  console.log(pad + chalk.green('✔ Link otomatis disalin ke clipboard!\n'));
  console.log(pad + chalk.gray(`Menunggu verifikasi web browser (Kode: ${sessionCode})...\n`));

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const pollRes = await fetch(`${baseUrl}/api/auth/cli/poll?code=${sessionCode}`);
      if (pollRes.ok) {
        const payload = await pollRes.json();
        if (payload.apiKey) {
          saveConfig({ apiKey: payload.apiKey });
          return payload.apiKey;
        }
      }
    } catch {}
  }
  return null;
}

async function startInteractiveSession() {
  cfg = getConfig();
  baseUrl = resolveBaseUrl();

  if (!cfg.apiKey) {
    const key = await handleAutoAuth(baseUrl);
    if (!key) {
      console.log('Login dibatalkan.');
      process.exit(1);
    }
    cfg = getConfig();
  }

  userMeta = await fetchUserMeta(baseUrl, cfg.apiKey || '');
  activeModel = CODING_MODELS.find((m) => m.id === cfg.defaultModel) || CODING_MODELS[0];

  // Aktifkan alternate screen buffer
  process.stdout.write('\x1b[?1049h\x1b[2J\x1b[3J\x1b[H');

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  drawSelectionModal(activeModel, userMeta, expanded, cursorIdx, copiedNotice);

  // Tangani event resize terminal agar layout otomatis menyesuaikan posisi tengah
  process.stdout.on('resize', () => {
    if (inWorkspace) {
      if (!isExecuting) {
        drawWorkspaceScreen(activeModel, sessionTimeLeft, currentTaskInput);
      }
    } else {
      drawSelectionModal(activeModel, userMeta, expanded, cursorIdx, copiedNotice);
    }
  });

  process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') {
      cleanupAndExit();
      return;
    }

    // WORKSPACE MODE
    if (inWorkspace) {
      if (isExecuting) return;

      if (key.name === 'escape') {
        leaveWorkspace();
        return;
      }

      if (key.name === 'return') {
        const query = currentTaskInput.trim();
        if (!query) return;

        if (query === '/exit' || query === 'exit' || query === ':q') {
          cleanupAndExit();
          return;
        }

        if (query === '/model' || query === '/back') {
          leaveWorkspace();
          return;
        }

        runPromptStream(query);
        return;
      }

      if (key.name === 'backspace') {
        currentTaskInput = currentTaskInput.slice(0, -1);
        drawWorkspaceScreen(activeModel, sessionTimeLeft, currentTaskInput);
        return;
      }

      if (str && !key.ctrl && !key.meta && !str.startsWith('\x1b')) {
        currentTaskInput += str;
        drawWorkspaceScreen(activeModel, sessionTimeLeft, currentTaskInput);
        return;
      }
      return;
    }

    // SELECTION MODAL MODE
    if (key.name === 'escape' || str === 'q') {
      cleanupAndExit();
      return;
    }

    copiedNotice = false;

    if (key.name === 'down') {
      if (!expanded) {
        cursorIdx = (cursorIdx + 1) % 4;
      } else {
        if (cursorIdx >= 10 && cursorIdx < 10 + CODING_MODELS.length - 1) {
          cursorIdx++;
        } else if (cursorIdx === 10 + CODING_MODELS.length - 1) {
          cursorIdx = 20;
        } else {
          cursorIdx = 10;
        }
      }
      drawSelectionModal(activeModel, userMeta, expanded, cursorIdx, copiedNotice);
      return;
    }

    if (key.name === 'up') {
      if (!expanded) {
        cursorIdx = (cursorIdx - 1 + 4) % 4;
      } else {
        if (cursorIdx === 20) {
          cursorIdx = 10 + CODING_MODELS.length - 1;
        } else if (cursorIdx > 10) {
          cursorIdx--;
        } else {
          cursorIdx = 20;
        }
      }
      drawSelectionModal(activeModel, userMeta, expanded, cursorIdx, copiedNotice);
      return;
    }

    if (str === 'c' || str === 'C') {
      cursorIdx = 3;
      triggerCopyLink();
      return;
    }

    if (key.name === 'return' || key.name === 'space') {
      if (!expanded) {
        if (cursorIdx === 0 || cursorIdx === 2) {
          enterWorkspace();
        } else if (cursorIdx === 1) {
          expanded = true;
          cursorIdx = 10;
          drawSelectionModal(activeModel, userMeta, expanded, cursorIdx, copiedNotice);
        } else if (cursorIdx === 3) {
          triggerCopyLink();
        }
      } else {
        if (cursorIdx === 20) {
          expanded = false;
          cursorIdx = 1;
          drawSelectionModal(activeModel, userMeta, expanded, cursorIdx, copiedNotice);
        } else if (cursorIdx >= 10) {
          const selected = CODING_MODELS[cursorIdx - 10];
          if (selected) {
            activeModel = selected;
            saveConfig({ defaultModel: activeModel.id });
            expanded = false;
            enterWorkspace();
          }
        }
      }
      return;
    }
  });
}

program
  .name('sarang')
  .description('SarangAI CLI — Gateway AI Coding Workspace')
  .version(require('../package.json').version)
  .action(() => {
    startInteractiveSession();
  });

program.parse(process.argv);
