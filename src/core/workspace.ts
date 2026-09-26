import fs from 'fs';
import path from 'path';
import { CodingModel } from '../constants';
import { streamChatCompletion, ChatMessage } from './gateway';
import { scanProjectTree, readFileContent } from './scanner';
import { safeReadFile, safeWriteFile } from './fs-agent';
import { buildSystemPrompt, buildUserMessage } from './prompt-builder';
import { boundedHistory, historyToMessages, HistoryTurn } from './memory';

export interface AgentRunOptions {
  model: CodingModel;
  userPrompt: string;
  /** Riwayat percakapan sesi berjalan (multi-giliran, sudah dibatasi). */
  history?: HistoryTurn[];
  /** Callback status ringkas (muncul di status bar, bukan di area konten). */
  onStatus?: (label: string) => void;
}

export interface AgentRunResult {
  explanation: string;
  writtenFiles: { path: string; success: boolean }[];
  editedFiles: { path: string; success: boolean }[];
  rawLength: number;
}

const IGNORED = [
  'node_modules', '.git', 'dist', '.next', 'build', 'out',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.DS_Store'
];

const MAX_TREE_LINES = 60;
const MAX_SNIPPET_FILES = 4;
const MAX_SNIPPET_CHARS = 1200;

function scanFiles(dir: string, base = dir, max = 25): string[] {
  let res: string[] = [];
  try {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      if (IGNORED.includes(item)) continue;
      const full = path.join(dir, item);
      const rel = path.relative(base, full);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        res = res.concat(scanFiles(full, base, max));
      } else if (/\.(ts|tsx|js|jsx|json|md|py|go|rs)$/i.test(item)) {
        res.push(rel);
      }
      if (res.length >= max) break;
    }
  } catch {}
  return res;
}

/** Rakit konteks proyek gaya Codebuff: peta + snippet file paling relevan. */
function assembleProjectContext(): { context: string; isEmpty: boolean } {
  const cwd = process.cwd();
  const files = scanFiles(cwd);
  const isEmpty = files.length === 0;

  if (isEmpty) {
    return { context: '', isEmpty: true };
  }

  const scanRes = scanProjectTree(cwd, '', MAX_TREE_LINES);
  const tree = Array.isArray(scanRes) ? scanRes : (scanRes?.tree || []);
  const treeText = tree.join('\n');

  // Snippet file: pilih file teks pertama yang benar-benar ada & terbaca.
  const snippets: string[] = [];
  for (const f of files.slice(0, MAX_SNIPPET_FILES)) {
    const r = safeReadFile(f);
    if (r.success && r.content) {
      snippets.push(
        `[FILE: ${f}]\n\`\`\`\n${r.content.slice(0, MAX_SNIPPET_CHARS)}\n\`\`\``,
      );
    }
  }
  const snippetText = snippets.length > 0
    ? `\nKey file snippets:\n${snippets.join('\n\n')}`
    : '';

  return {
    context: `File tree:\n${treeText}${snippetText}`,
    isEmpty: false,
  };
}

export interface WriteResult { path: string; success: boolean }

/**
 * Eksekusi tag WRITE_FILE langsung ke disk — senyap, tanpa dump ke terminal.
 * (Kontrak file-tool mengikuti pola write_file Codebuff: konten final lengkap.)
 */
export function executeFileWrites(rawResponse: string): WriteResult[] {
  const fileRegex = /<<<WRITE_FILE\s+path=["']([^"']+)["']>>>([\s\S]*?)<<<END_FILE>>>/g;
  const results: WriteResult[] = [];
  let match;

  while ((match = fileRegex.exec(rawResponse)) !== null) {
    const filePath = match[1].trim();
    let content = match[2].trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
    }
    const writeRes = safeWriteFile(filePath, content);
    results.push({ path: filePath, success: writeRes.success });
  }

  return results;
}

/**
 * Eksekusi tag REPLACE/WITH (pola str_replace Codebuff): cari teks persis di
 * file yang ada, ganti tanpa menulis ulang seluruh berkas.
 */
export function executeFileReplaces(rawResponse: string): WriteResult[] {
  const replaceRegex =
    /<<<REPLACE\s+path=["']([^"']+)["']>>>([\s\S]*?)<<<WITH>>>([\s\S]*?)<<<END_REPLACE>>>/g;
  const results: WriteResult[] = [];
  let match;

  while ((match = replaceRegex.exec(rawResponse)) !== null) {
    const filePath = match[1].trim();
    // Trim hanya whitespace artefak posisi tag (newline setelah `>>>`);
    // indentasi interior tetap dipertahankan byte-for-byte.
    const find = match[2].trim();
    const replaceWith = match[3].trim();

    const existing = safeReadFile(filePath);
    if (!existing.success || existing.content == null) {
      results.push({ path: filePath, success: false });
      continue;
    }

    const current = existing.content;
    if (!current.includes(find)) {
      results.push({ path: filePath, success: false });
      continue;
    }

    const updated = current.replace(find, () => replaceWith);
    const writeRes = safeWriteFile(filePath, updated);
    results.push({ path: filePath, success: writeRes.success });
  }

  return results;
}

/**
 * Hapus seluruh blok operasi berkas (WRITE_FILE dan REPLACE/WITH) dari jawaban
 * agar tidak tercetak ke layar — presentasi bersih di atas kotak input.
 */
export function stripFileBlocks(rawResponse: string): string {
  return rawResponse
    .replace(/<<<WRITE_FILE\s+path=["'][^"']+["']>>>[\s\S]*?<<<END_FILE>>>/g, '')
    .replace(/<<<REPLACE\s+path=["'][^"']+["']>>>[\s\S]*?<<<END_REPLACE>>>/g, '')
    .replace(/<<<WITH>>>/g, '')
    .trim();
}

export async function runAutonomousAgent({ model, userPrompt, history, onStatus }: AgentRunOptions): Promise<AgentRunResult> {
  const { context, isEmpty } = assembleProjectContext();

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(model) },
    // Riwayat multi-giliran: konteks baca-saja agar tugas lanjutan tersambung.
    ...historyToMessages(boundedHistory(history ?? [])),
    // Task-first: tugas user di atas, konteks sebagai background read-only.
    { role: 'user', content: buildUserMessage(userPrompt, context, isEmpty) },
  ];

  onStatus?.(`[${model.name}] Reading context files...`);

  let rawResponse = '';
  let writeNotified = false;

  await streamChatCompletion({
    model,
    messages,
    // Reasoning monologue TIDAK PERNAH dicetak ke layar.
    onReasoningProgress: () => {},
    onContentToken: (token) => {
      rawResponse += token;
      if (!writeNotified && (rawResponse.includes('<<<WRITE_FILE') || rawResponse.includes('<<<REPLACE'))) {
        writeNotified = true;
        onStatus?.(`[${model.name}] Applying code changes...`);
      }
    },
  });

  // Tulis berkas & terapkan edit ke disk di background — senyap.
  const writtenFiles = executeFileWrites(rawResponse);
  const editedFiles = executeFileReplaces(rawResponse);
  const cleanExplanation = stripFileBlocks(rawResponse);

  onStatus?.(`[${model.name}] Done`);

  return { explanation: cleanExplanation, writtenFiles, editedFiles, rawLength: rawResponse.length };
}
