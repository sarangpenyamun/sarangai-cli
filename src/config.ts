import fs from 'fs';
import path from 'path';
import os from 'os';

export interface SarangConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

const CONFIG_FILE = path.join(os.homedir(), '.sarangairc');

export const DEFAULT_CONFIG: SarangConfig = {
  baseUrl: 'https://sarangai.id',
  defaultModel: 'glm',
};

export function getConfig(): SarangConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as SarangConfig;
      }
    }
  } catch {}

  return { ...DEFAULT_CONFIG };
}

export function saveConfig(newConfig: Partial<SarangConfig>): void {
  const current = getConfig();
  const merged = { ...current, ...newConfig };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}
