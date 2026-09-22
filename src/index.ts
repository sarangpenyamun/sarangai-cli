import { Command } from 'commander';
import chalk from 'chalk';
import prompts from 'prompts';
import ora from 'ora';
import readline from 'readline';
import { execSync } from 'child_process';
import path from 'path';
import { getConfig, saveConfig } from './config';

const program = new Command();

function resolveBaseUrl(): string {
  const cfg = getConfig();
  return process.env.SARANGAI_BASE_URL || cfg.baseUrl || 'https://api.sarang.ai';
}

function getGitBranch(): string {
  try {
    return execSync('git branch --show-current 2>/dev/null').toString().trim() || 'no-git';
  } catch {
    return 'no-git';
  }
}

function renderBanner(modelName: string) {
  console.clear();
  const banner = `
  ███████╗ █████╗ ██████╗  █████╗ ███╗   ██╗ ██████╗  █████╗ ██╗
  ██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗  ██║██╔════╝ ██╔══██╗██║
  ███████╗███████║██████╔╝███████║██╔██╗ ██║██║  ███╗███████║██║
  ╚════██║██╔══██║██╔══██╗██╔══██║██║╚██╗██║██║   ██║██╔══██║██║
  ███████║██║  ██║██║  ██║██║  ██║██║ ╚████║╚██████╔╝██║  ██║██║
  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝
  `;

  console.log(chalk.cyanBright(banner));
  console.log(chalk.gray('  Tips for getting started:'));
  console.log(chalk.gray('  1. Ketik pesan Anda langsung untuk chat streaming.'));
  console.log(chalk.gray('  2. Perintah khusus: ') + chalk.yellow('/clear') + chalk.gray(' (bersihkan layar), ') + chalk.yellow('/model <id>') + chalk.gray(', ') + chalk.yellow('/exit') + chalk.gray('.'));
  console.log('');

  // Status Bar
  const cwd = path.basename(process.cwd());
  const branch = getGitBranch();
  const leftStatus = chalk.gray(`📂 ~/${cwd} `) + chalk.magenta(`(${branch})`);
  const rightStatus = chalk.bgCyan.black(` ${modelName} `) + chalk.greenBright(' (ready)');

  console.log(`  ${leftStatus}   ${rightStatus}`);
  console.log(chalk.cyan('  ' + '─'.repeat(65)));
  console.log('');
}

// Interactive TUI REPL Session
async function startInteractiveSession(initialModel?: string) {
  const cfg = getConfig();
  if (!cfg.apiKey) {
    console.log(chalk.yellow('Silakan login terlebih dahulu: sarang login'));
    return;
  }

  let currentModel = initialModel || cfg.defaultModel || 'minimax/minimax-m2.7';
  const baseUrl = resolveBaseUrl();
  const history: { role: string; content: string }[] = [];

  renderBanner(currentModel);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = () => {
    rl.question(chalk.cyanBright('❯ '), async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        ask();
        return;
      }

      if (trimmed === '/exit' || trimmed === 'exit' || trimmed === ':q') {
        console.log(chalk.gray('\nSampai jumpa!\n'));
        rl.close();
        process.exit(0);
      }

      if (trimmed === '/clear' || trimmed === 'clear') {
        renderBanner(currentModel);
        ask();
        return;
      }

      if (trimmed.startsWith('/model')) {
        const parts = trimmed.split(' ');
        if (parts[1]) {
          currentModel = parts[1].trim();
          saveConfig({ defaultModel: currentModel });
          console.log(chalk.green(`\n✔ Model dialihkan ke: ${currentModel}\n`));
        } else {
          console.log(chalk.yellow(`\nFormat: /model <model-id> (contoh: /model openai/gpt-4o-mini)\n`));
        }
        ask();
        return;
      }

      history.push({ role: 'user', content: trimmed });
      process.stdout.write(chalk.gray(`\n[${currentModel}]\n`));

      try {
        const res = await fetch(`${baseUrl}/api/gateway/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: currentModel,
            messages: history,
            stream: true,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          let parsedErr: any;
          try { parsedErr = JSON.parse(errText); } catch {}
          throw new Error(parsedErr?.error?.message || `HTTP ${res.status}: ${errText.slice(0, 80)}`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let assistantReply = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  const delta = parsed.choices?.[0]?.delta?.content;
                  if (delta) {
                    process.stdout.write(delta);
                    assistantReply += delta;
                  }
                } catch {}
              }
            }
          }
          console.log('\n');
          history.push({ role: 'assistant', content: assistantReply });
        }
      } catch (err: any) {
        console.error(chalk.red(`\nError: ${err.message}\n`));
      }

      ask();
    });
  };

  ask();
}

program
  .name('sarang')
  .description(chalk.cyanBright('SarangAI CLI — Gateway ratusan model AI langsung di terminal'))
  .version('1.0.0')
  .action(() => {
    // Mengetik `sarang` tanpa subperintah akan langsung masuk ke interactive TUI mode
    startInteractiveSession();
  });

// 1. sarang login
program
  .command('login')
  .description('Hubungkan API Key SarangAI akun Anda')
  .action(async () => {
    const baseUrl = resolveBaseUrl();
    console.log(chalk.cyanBright('\n🔐 Autentikasi SarangAI CLI'));
    console.log(chalk.gray('Dapatkan API Key Anda di: ') + chalk.underline.cyan(`${baseUrl}/dashboard`));
    console.log(chalk.gray('--------------------------------------------------\n'));

    const res = await prompts({
      type: 'password',
      name: 'key',
      message: 'Masukkan SarangAI API Key Anda:',
    });

    if (!res.key) {
      console.log(chalk.red('\nLogin dibatalkan.\n'));
      return;
    }

    saveConfig({ apiKey: res.key.trim() });
    console.log(chalk.green('\n✔ Berhasil terhubung! API Key tersimpan di ~/.sarangairc\n'));
  });

// 2. sarang balance
program
  .command('balance')
  .description('Cek sisa saldo kredit akun SarangAI Anda')
  .action(async () => {
    const cfg = getConfig();
    if (!cfg.apiKey) {
      console.log(chalk.yellow('Anda belum login. Jalankan: sarang login'));
      return;
    }

    const baseUrl = resolveBaseUrl();
    const spinner = ora('Mengambil status saldo...').start();
    try {
      const res = await fetch(`${baseUrl}/api/gateway/v1/balance`, {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
      });

      const rawText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Endpoint mengembalikan respons non-JSON (${res.status}): ${rawText.slice(0, 120)}...`);
      }

      spinner.stop();

      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      console.log(chalk.bold('\nStatus Akun SarangAI:'));
      console.log(`Credit Balance : ${chalk.greenBright(data.balance ?? 0)} CREDIT`);
      console.log(`Email          : ${chalk.gray(data.email || '—')}\n`);
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
    }
  });

// 3. sarang models
program
  .command('models')
  .option('-s, --search <keyword>', 'Filter nama model (contoh: claude, deepseek, free)')
  .description('Daftar model AI yang tersedia di SarangAI Gateway')
  .action(async (cmd) => {
    const cfg = getConfig();
    if (!cfg.apiKey) {
      console.log(chalk.yellow('Anda belum login. Jalankan: sarang login'));
      return;
    }

    const baseUrl = resolveBaseUrl();
    const spinner = ora('Mengambil katalog model...').start();
    try {
      const res = await fetch(`${baseUrl}/api/gateway/v1/models`, {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
      });

      const rawText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Respons tidak valid: ${rawText.slice(0, 100)}`);
      }

      spinner.stop();

      if (!res.ok) throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);

      let list: any[] = Array.isArray(data) ? data : data.data || [];
      if (list.length === 0) {
        console.log(chalk.yellow('Tidak ada model aktif yang ditemukan.'));
        return;
      }

      if (cmd.search) {
        const query = cmd.search.toLowerCase();
        list = list.filter((m) => {
          const id = (m.id || m.modelId || m.name || '').toLowerCase();
          return id.includes(query);
        });
      }

      if (list.length === 0) {
        console.log(chalk.yellow(`\nTidak ada model yang cocok dengan kata kunci "${cmd.search}".\n`));
        return;
      }

      console.log(chalk.bold(`\nModel Tersedia (${list.length}${cmd.search ? ` cocok dengan "${cmd.search}"` : ''}):`));
      console.log(chalk.gray('---------------------------------------------------------'));

      list.forEach((m) => {
        const id = m.id || m.modelId || m.name;
        const isCurrent = id === cfg.defaultModel;
        const prefix = isCurrent ? chalk.green('✔ [Aktif] ') : '  ';
        console.log(`${prefix}${chalk.cyan(id)}`);
      });

      console.log(chalk.gray('---------------------------------------------------------'));
      console.log(chalk.dim('Ganti model default : sarang set-model <model-id>'));
      console.log(chalk.dim('Chat model tertentu : sarang chat -m <model-id> "..."\n'));
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
    }
  });

// 4. sarang set-model
program
  .command('set-model [modelId]')
  .description('Atur model default untuk chat')
  .action(async (modelId) => {
    let target = modelId;
    if (!target) {
      const res = await prompts({
        type: 'text',
        name: 'model',
        message: 'Masukkan Model ID default baru (contoh: minimax/minimax-m2.7):',
      });
      target = res.model;
    }
    if (!target) return;
    saveConfig({ defaultModel: target.trim() });
    console.log(chalk.green(`✔ Default model berhasil diubah ke: ${target.trim()}`));
  });

// 5. sarang chat
program
  .command('chat [prompt...]')
  .option('-m, --model <modelId>', 'Pilih model AI spesifik')
  .description('Kirim instruksi / chat ke AI (Mendukung streaming teks atau Unix Pipe)')
  .action(async (promptArr, cmd) => {
    let prompt = promptArr?.join(' ');

    // Cek apakah ada input pipa (stdin pipe)
    if (!process.stdin.isTTY) {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const pipedData = Buffer.concat(chunks).toString('utf-8').trim();
      prompt = prompt ? `${prompt}\n\n${pipedData}` : pipedData;
    }

    // Jika tanpa pipe dan tanpa prompt, luncurkan TUI Interactive Mode
    if (!prompt) {
      await startInteractiveSession(cmd.model);
      return;
    }

    // Jika ada prompt / stdin pipe, jalankan mode direct pipe (Unix style)
    const cfg = getConfig();
    if (!cfg.apiKey) {
      console.log(chalk.yellow('Silakan login terlebih dahulu: sarang login'));
      return;
    }

    const baseUrl = resolveBaseUrl();
    const selectedModel = cmd.model || cfg.defaultModel || 'minimax/minimax-m2.7';
    console.log(chalk.gray(`\n[Model: ${selectedModel}]`));

    try {
      const res = await fetch(`${baseUrl}/api/gateway/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        let parsedErr: any;
        try { parsedErr = JSON.parse(errText); } catch {}
        throw new Error(parsedErr?.error?.message || `HTTP ${res.status}: ${errText.slice(0, 80)}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const parsed = JSON.parse(line.slice(6));
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) process.stdout.write(content);
              } catch {}
            }
          }
        }
        console.log('\n');
      }
    } catch (err: any) {
      console.error(chalk.red(`\nError: ${err.message}`));
    }
  });

program.parse(process.argv);
