import fs from 'fs';
import path from 'path';
import os from 'os';
import { ChatMessage } from './gateway';

const SARANGAI_DIR = path.join(os.homedir(), '.sarangai');
const SESSIONS_DIR = path.join(SARANGAI_DIR, 'sessions');

export interface SessionData {
  id: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

function ensureDirExists() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

export function saveSession(session: SessionData): void {
  ensureDirExists();
  const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
}

export function getSession(id: string): SessionData | null {
  ensureDirExists();
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function listSessions(): { id: string; updatedAt: string; messageCount: number; model: string }[] {
  ensureDirExists();
  try {
    const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
    return files.map((file) => {
      const fullPath = path.join(SESSIONS_DIR, file);
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as SessionData;
      return {
        id: data.id,
        updatedAt: data.updatedAt,
        messageCount: data.messages.length,
        model: data.model,
      };
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}
