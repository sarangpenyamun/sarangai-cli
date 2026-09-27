import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import chalk from 'chalk';
import { getConfig, saveConfig } from '../config';
import { UserStats } from '../ui/banner';

function detectLocalSessionToken(): string {
  if (process.env.SARANGAI_TOKEN) return process.env.SARANGAI_TOKEN;
  if (process.env.SARANGAI_API_KEY) return process.env.SARANGAI_API_KEY;

  const cfg = getConfig();
  if (cfg.apiKey) return cfg.apiKey;

  const candidatePaths = [
    path.join(os.homedir(), '.sarangairc'),
    path.join(os.homedir(), '.sarangai', 'session.json'),
    path.join(os.homedir(), '.config', 'sarangai', 'auth.json'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const json = JSON.parse(raw);
        const t = json.apiKey || json.token || json.sessionToken || json.jwt;
        if (t) return t;
      } catch {}
    }
  }

  return '';
}

export async function fetchUserMeta(baseUrl: string, token: string): Promise<UserStats | null> {
  try {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}/api/gateway/v1/balance`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (res.ok) {
      const d = await res.json();
      const rawId = d.accountId != null ? String(d.accountId) : '';
      return {
        balance: typeof d.balance === 'number' ? Math.floor(d.balance) : parseInt(d.balance, 10) || 0,
        tier: d.tier || 'DEVELOPER',
        accountId: rawId ? (rawId.startsWith('SA-') ? rawId : `SA-${rawId}`) : 'SA-USER',
      };
    }
  } catch {}
  return null;
}

/** Cek lokal (tanpa network): apakah CLI sudah punya kredensial tersimpan? */
export function hasLocalCredentials(): boolean {
  return detectLocalSessionToken() !== '';
}

/**
 * Alur login asli SarangAI (Browser / Device Code Auth):
 * 1. Generate kode sesi sekali-pakai (SA-XXXXXXXX).
 * 2. Minta user membuka {baseUrl}/auth/cli?code=... di browser.
 * 3. Polling {baseUrl}/api/auth/cli/poll?code=... hingga web gateway
 *    mengembalikan payload auth (API key).
 * 4. API key disimpan otomatis ke ~/.sarangairc.
 * Mengembalikan token bila berhasil, null bila dibatalkan / timeout.
 */
export async function runBrowserAuth(baseUrl: string): Promise<string | null> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const sessionCode = 'SA-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const authUrl = `${cleanBase}/auth/cli?code=${sessionCode}`;

  console.log(chalk.cyanBright('\n🔐 Sesi Otorisasi CLI Diperlukan\n'));
  console.log(chalk.white('Buka URL berikut di browser Anda untuk mengizinkan CLI:'));
  console.log(chalk.underline.cyan(authUrl));
  console.log(chalk.gray(`\nMenunggu verifikasi web browser (Kode: ${sessionCode})...`));
  console.log(chalk.gray('(Ctrl+C untuk membatalkan)'));

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const pollRes = await fetch(`${cleanBase}/api/auth/cli/poll?code=${sessionCode}`);
      if (pollRes.ok) {
        const payload = await pollRes.json();
        if (payload.apiKey) {
          saveConfig({ apiKey: payload.apiKey });
          console.log(chalk.green('\n✔ Berhasil terhubung! API Key tersimpan di ~/.sarangairc\n'));
          return payload.apiKey;
        }
      }
    } catch {}
  }

  console.log(chalk.yellow('\n⏳ Waktu otorisasi habis. Jalankan `sarang login` untuk mencoba lagi.\n'));
  return null;
}

export async function ensureAuthenticated(): Promise<{ token: string; stats: UserStats }> {
  const cfg = getConfig();
  const baseUrl = process.env.SARANGAI_BASE_URL || cfg.baseUrl || 'https://sarangai.id';
  let token = detectLocalSessionToken();

  // Alur asli: tanpa API key, tawarkan login browser otomatis — bukan error mati.
  if (!token) {
    token = (await runBrowserAuth(baseUrl)) || '';
    if (!token) {
      throw new Error('Login dibatalkan. API Key not found in ~/.sarangairc.');
    }
  }

  const stats = await fetchUserMeta(baseUrl, token);
  if (!stats) {
    throw new Error('Failed to fetch real-time balance from the SarangAI gateway (/api/gateway/v1/balance).');
  }

  return { token, stats };
}
