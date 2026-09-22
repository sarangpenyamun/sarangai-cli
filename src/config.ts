import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.sarangairc');

export interface CliConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

export function getConfig(): CliConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  return {
    baseUrl: 'https://panel.idshop.or.id',
    defaultModel: 'openai/gpt-5-pro',
  };
}

export function saveConfig(cfg: Partial<CliConfig>) {
  const current = getConfig();
  const next = { ...current, ...cfg };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf-8');
}
