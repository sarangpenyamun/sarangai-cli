import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { execSync } from 'child_process';
import crypto from 'crypto';
import clipboard from 'clipboardy';
import { getConfig, saveConfig } from './config';

export interface CodingModel {
  id: string;
  name: string;
  desc: string;
  rate: string;
  tag?: string;
}

export const CODING_MODELS: CodingModel[] = [
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek-V3', desc: 'Fast & Accurate • Code specialist', rate: '450 Credits/hr', tag: 'HOT' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek-R1', desc: 'Deep reasoning • Logic & Math specialist', rate: '1,500 Credits/hr', tag: 'REASONING' },
  { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', desc: 'Hybrid reasoning • Complex tasks', rate: '12,000 Credits/hr', tag: 'NEW' },
  { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', desc: 'Multilingual code specialist • Fast completion', rate: '700 Credits/hr', tag: 'RECOMMENDED' },
  { id: 'openai/o3-mini', name: 'OpenAI o3-mini', desc: 'Fast reasoning • STEM & Algorithm', rate: '3,000 Credits/hr', tag: 'NEW' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: '1M context • Full repo analysis', rate: '500 Credits/hr', tag: 'FAST' },
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
      execSync(`echo -n "${text}" | xclip -selection clipboard 2>/dev/null || echo -n "${text}" \vert{} pbcopy 2>/dev/null \vert{}\vert{} echo \vert{} set /p="${text}" | clip 2>/dev/null`);
    } catch {}
  }
}

function getDisplayDir() {
  const cwd = process.cwd();
  const home = process.env.HOME || '/root';
  if (cwd.startsWith(home)) {
    return '~' + cwd.slice(home.length);
  }
  return cwd;
}

// -------------------------------------------------------------
// KOMPONEN UTAMA CLI
// -------------------------------------------------------------
const App = () => {
  const { exit } = useApp();
  const [inWorkspace, setInWorkspace] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [cursorIdx, setCursorIdx] = useState(0); 
  const [activeModel, setActiveModel] = useState<CodingModel>(CODING_MODELS[0]);
  const [timeLeft, setTimeLeft] = useState(3600);
  const [inputTask, setInputTask] = useState('');
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [userMeta, setUserMeta] = useState({ balance: 75313, tier: 'DEVELOPER', accountId: 'SA-8WwREVSJ' });

  // Ambil saldo dan model default dari config
  useEffect(() => {
    const cfg = getConfig();
    const found = CODING_MODELS.find(m => m.id === cfg.defaultModel);
    if (found) setActiveModel(found);

    const baseUrl = resolveBaseUrl();
    if (cfg.apiKey) {
      fetch(`${baseUrl}/api/user/stats`, { headers: { Authorization: `Bearer ${cfg.apiKey}` } })
        .then(r => r.json())
        .then(d => {
          if (d.balance !== undefined) {
            setUserMeta({ balance: d.balance, tier: d.tier || 'DEVELOPER', accountId: d.accountId || 'SA-8WwREVSJ' });
          }
        })
        .catch(() => {});
    }
  }, []);

  // Timer Workspace
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (inWorkspace) {
      timer = setInterval(() => {
        setTimeLeft(t => (t > 0 ? t - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [inWorkspace]);

  // Handle Input Keyboard
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    // Navigasi di Modal Pemilihan
    if (!inWorkspace) {
      if (input === 'q' || key.escape) {
        exit();
        return;
      }

      if (input === 'c' || input === 'C') {
        copyToClipboard('https://idshop.or.id/user/dashboard');
        setCopiedNotice(true);
        return;
      }

      setCopiedNotice(false);

      if (key.downArrow) {
        if (!expanded) {
          // Siklus: 0 (Card Utama) -> 1 (See All) -> 2 (Start) -> 3 (Copy)
          setCursorIdx(c => (c + 1) % 4);
        } else {
          // Siklus Expanded: 10..15 (Cards) -> 20 (Show Fewer)
          setCursorIdx(c => {
            if (c >= 10 && c < 10 + CODING_MODELS.length - 1) return c + 1;
            if (c === 10 + CODING_MODELS.length - 1) return 20;
            return 10;
          });
        }
      }

      if (key.upArrow) {
        if (!expanded) {
          setCursorIdx(c => (c - 1 + 4) % 4);
        } else {
          setCursorIdx(c => {
            if (c === 20) return 10 + CODING_MODELS.length - 1;
            if (c > 10) return c - 1;
            return 20;
          });
        }
      }

      if (key.return || input === ' ') {
        if (!expanded) {
          if (cursorIdx === 0 || cursorIdx === 2) {
            setInWorkspace(true);
          } else if (cursorIdx === 1) {
            setExpanded(true);
            setCursorIdx(10);
          } else if (cursorIdx === 3) {
            copyToClipboard('https://idshop.or.id/user/dashboard');
            setCopiedNotice(true);
          }
        } else {
          if (cursorIdx === 20) {
            setExpanded(false);
            setCursorIdx(1);
          } else if (cursorIdx >= 10) {
            const chosen = CODING_MODELS[cursorIdx - 10];
            if (chosen) {
              setActiveModel(chosen);
              saveConfig({ defaultModel: chosen.id });
              setExpanded(false);
              setInWorkspace(true);
            }
          }
        }
      }
      return;
    }

    // Navigasi di Mode Workspace
    if (inWorkspace) {
      if (key.escape) {
        setInWorkspace(false);
        setInputTask('');
        return;
      }

      if (key.return) {
        const query = inputTask.trim();
        if (query === '/exit' || query === 'exit') {
          exit();
          return;
        }
        if (query === '/model' || query === '/back') {
          setInWorkspace(false);
          setInputTask('');
          return;
        }
        // Kirim query di sini jika ingin stream
        return;
      }

      if (key.backspace || key.delete) {
        setInputTask(t => t.slice(0, -1));
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        setInputTask(t => t + input);
      }
    }
  });

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const timeFormatted = `${m}m ${s < 10 ? '0' : ''}${s}s left`;

  // -----------------------------------------------------------
  // TAMPILAN 1: WORKSPACE CODING SCREEN
  // -----------------------------------------------------------
  if (inWorkspace) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="white">
          {'███████╗ █████╗ ██████╗  █████╗ ███╗   ██╗ ██████╗  █████╗ ██╗\n' +
           '██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗  ██║██╔════╝ ██╔══██╗██║\n' +
           '███████╗███████║██████╔╝███████║██╔██╗ ██║██║  ███╗███████║██║\n' +
           '╚════██║██╔══██║██╔══██╗██╔══██║██║╚██╗██║██║   ██║██╔══██║██║\n' +
           '███████║██║  ██║██║  ██║██║  ██║██║ ╚████║╚██████╔╝██║  ██║██║\n' +
           '╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝'}
        </Text>
        <Box marginTop={1}>
          <Text color="white">SarangAI will run commands on your behalf to help you build.</Text>
        </Box>
        <Box marginTop={1}>
          <Text bold color="white">Directory </Text>
          <Text color="gray">{getDisplayDir()}</Text>
        </Box>

        {/* Status Bar */}
        <Box marginTop={1} paddingX={1} backgroundColor="#1e293b" width={78} justifyContent="space-between">
          <Text bold color="white">{activeModel.name}  •  {timeFormatted}</Text>
          <Text color="gray">[Esc] End session</Text>
        </Box>

        {/* Input Box Native */}
        <Box borderStyle="round" borderColor="gray" width={78} paddingX={1}>
          <Text color={inputTask ? 'white' : 'gray'}>
            {inputTask ? inputTask : 'Enter a coding task or / for commands'}
          </Text>
          <Text color="cyan">▍</Text>
        </Box>
      </Box>
    );
  }

  // -----------------------------------------------------------
  // TAMPILAN 2: MODAL SELEKSI MODEL (IDENTIK FREEBUFF STYLE)
  // -----------------------------------------------------------
  return (
    <Box flexDirection="column" paddingLeft={4}>
      {/* ASCII Logo */}
      <Text bold color="#c084fc">
        {'  ____                                _    ___ \n' +
         ' / ___|  __ _ _ __ __ _ _ __   __ _  / \\  |_ _|\n' +
         ' \\___ \\ / _` | \'__/ _` | \'_ \\ / _` |/ _ \\  | | \n' +
         '  ___) | (_| | | | (_| | | | | (_| / ___ \\ | | \n' +
         ' |____/ \\__,_|_|  \\__,_|_| |_|\\__, /_/   \\_\\___|\n' +
         '                              |___/            '}
      </Text>
      <Box marginBottom={1}>
        <Text bold color="white">AI Coding Workspace </Text>
        <Text color="gray">• Connected to idshop.or.id</Text>
      </Box>

      {/* Header Info */}
      <Box width={72} justifyContent="space-between" marginBottom={1}>
        <Box>
          <Text bold color="white">Start coding for SarangAI   </Text>
          <Text color="#4ade80">●●●●●○</Text>
        </Box>
        <Text color="gray">✕</Text>
      </Box>

      {/* Mode Terlipat (Single Card) */}
      {!expanded ? (
        <Box flexDirection="column">
          <Box
            borderStyle="round"
            borderColor={cursorIdx === 0 ? '#a855f7' : '#334155'}
            flexDirection="column"
            paddingX={2}
            width={72}
          >
            <Box justifyContent="space-between">
              <Box>
                <Text bold color="cyan">{cursorIdx === 0 ? '› ' : '  '}</Text>
                <Text bold color="white">{activeModel.name}</Text>
                <Text color="#94a3b8">  •  {activeModel.desc}</Text>
              </Box>
              {activeModel.tag && <Text bold color="#e9d5ff" backgroundColor="#7c3aed"> {activeModel.tag} </Text>}
            </Box>
            <Box paddingLeft={2}>
              <Text bold color="#c084fc">{activeModel.rate}</Text>
            </Box>
          </Box>

          <Box marginY={1}>
            <Text bold color="white">{userMeta.tier}  •  </Text>
            <Text bold color="yellow">{userMeta.balance.toLocaleString()} Credits remaining  •  </Text>
            <Text color="#a855f7">{userMeta.accountId}</Text>
          </Box>

          <Box marginBottom={1}>
            <Text bold color="cyan">{cursorIdx === 1 ? '› ' : '  '}</Text>
            <Text underline={cursorIdx === 1} color={cursorIdx === 1 ? 'cyan' : '#a855f7'}>
              ↓  See all {CODING_MODELS.length} models
            </Text>
          </Box>

          <Box marginBottom={1}>
            <Text bold color="green">{cursorIdx === 2 ? '› ' : '  '}</Text>
            <Text bold color={cursorIdx === 2 ? 'green' : 'white'}>[🚀 Start Coding Workspace ↵]</Text>
          </Box>

          <Box>
            <Text color="gray">✦ Refer friends  →  manage credits:</Text>
          </Box>
          <Box marginTop={1}>
            <Text bold color="cyan">{cursorIdx === 3 ? '› ' : '  '}</Text>
            <Text underline={cursorIdx === 3} color={cursorIdx === 3 ? 'cyan' : 'white'}>📋 Copy invite / dashboard link</Text>
          </Box>
        </Box>
      ) : (
        /* Mode Expand (Semua Model dalam Kotak Sendiri-sendiri) */
        <Box flexDirection="column">
          {CODING_MODELS.map((m, idx) => {
            const isSel = cursorIdx === idx + 10;
            return (
              <Box
                key={m.id}
                borderStyle="round"
                borderColor={isSel ? '#a855f7' : '#334155'}
                flexDirection="column"
                paddingX={2}
                width={72}
                marginBottom={1}
              >
                <Box justifyContent="space-between">
                  <Box>
                    <Text bold color="cyan">{isSel ? '› ' : '  '}</Text>
                    <Text bold color="white">{m.name}</Text>
                    <Text color="#94a3b8">  •  {m.desc}</Text>
                  </Box>
                  {m.tag && <Text bold color="#e9d5ff" backgroundColor="#7c3aed"> {m.tag} </Text>}
                </Box>
                <Box paddingLeft={2}>
                  <Text bold color="#c084fc">{m.rate}</Text>
                </Box>
              </Box>
            );
          })}

          <Box marginY={1}>
            <Text bold color="white">{userMeta.tier}  •  </Text>
            <Text bold color="yellow">{userMeta.balance.toLocaleString()} Credits remaining  •  </Text>
            <Text color="#a855f7">{userMeta.accountId}</Text>
          </Box>

          <Box marginBottom={1}>
            <Text bold color="cyan">{cursorIdx === 20 ? '› ' : '  '}</Text>
            <Text underline={cursorIdx === 20} color={cursorIdx === 20 ? 'cyan' : '#a855f7'}>↑  Show fewer</Text>
          </Box>
        </Box>
      )}

      {copiedNotice && (
        <Box marginTop={1}>
          <Text color="green">✔ Dashboard link copied to clipboard: https://idshop.or.id/user/dashboard</Text>
        </Box>
      )}

      <Box marginTop={1} width={72} borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray">
        <Text color="gray">Navigasi: [↑/↓ Panah]  •  [Enter/Space] Pilih  •  [c] Copy Link  •  [q] Keluar</Text>
      </Box>
    </Box>
  );
};

// Auto Auth jika belum login
async function main() {
  const cfg = getConfig();
  const baseUrl = resolveBaseUrl();

  if (!cfg.apiKey) {
    const sessionCode = 'SA-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const authUrl = `${baseUrl}/auth/cli?code=${sessionCode}`;

    console.clear();
    console.log('\n  🔐 Sesi Otorisasi CLI Diperlukan\n');
    copyToClipboard(authUrl);
    console.log(`  Buka URL berikut untuk mengizinkan:\n  \x1b[36m${authUrl}\x1b[0m\n`);
    console.log('  ✔ Link otomatis disalin ke clipboard!\n');
    console.log(`  Menunggu verifikasi web browser (Kode: ${sessionCode})...\n`);

    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const res = await fetch(`${baseUrl}/api/auth/cli/poll?code=${sessionCode}`);
        if (res.ok) {
          const payload = await res.json();
          if (payload.apiKey) {
            saveConfig({ apiKey: payload.apiKey });
            break;
          }
        }
      } catch {}
    }
  }

  // Render aplikasi Ink React
  console.clear();
  render(<App />);
}

main();
