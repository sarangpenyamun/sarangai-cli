import fs from 'fs';
import path from 'path';
import os from 'os';
import { getConfig } from '../config';
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

export async function ensureAuthenticated(): Promise<{ token: string; stats: UserStats }> {
  const cfg = getConfig();
  const baseUrl = cfg.baseUrl || 'https://idshop.or.id';
  const token = detectLocalSessionToken();

  if (!token) {
    throw new Error('API Key not found in ~/.sarangairc.');
  }

  const stats = await fetchUserMeta(baseUrl, token);
  if (!stats) {
    throw new Error('Failed to fetch real-time balance from the SarangAI gateway (/api/gateway/v1/balance).');
  }

  return { token, stats };
}
