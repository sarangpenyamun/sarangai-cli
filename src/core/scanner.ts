import fs from 'fs';
import path from 'path';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.cache',
  'baileys_auth',
]);

const IGNORED_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.DS_Store',
  'Thumbs.db',
]);

const EXTENSION_ALLOWLIST = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json',
  '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h',
  '.html', '.css', '.scss', '.md', '.sql', '.sh',
  '.yaml', '.yml', '.env.example'
]);

export interface ProjectSummary {
  tree: string[];
  totalFiles: number;
}

export function scanProjectTree(dir: string, prefix = '', maxFiles = 100): ProjectSummary {
  const tree: string[] = [];
  let totalFiles = 0;

  function walk(currentDir: string, currentPrefix: string) {
    if (totalFiles >= maxFiles) return;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    // Sort: direktori lebih dulu, baru file
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (totalFiles >= maxFiles) break;

      const fullPath = path.join(currentDir, entry.name);
      const isDir = entry.isDirectory();

      if (isDir) {
        if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        tree.push(`${currentPrefix}📁 ${entry.name}/`);
        walk(fullPath, `${currentPrefix}  `);
      } else {
        if (IGNORED_FILES.has(entry.name) || entry.name.endsWith('.png') || entry.name.endsWith('.jpg')) continue;
        tree.push(`${currentPrefix}📄 ${entry.name}`);
        totalFiles++;
      }
    }
  }

  walk(dir, prefix);
  return { tree, totalFiles };
}

export function readFileContent(filePath: string): string {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      return `[Error: File not found at ${filePath}]`;
    }
    const stat = fs.statSync(fullPath);
    if (stat.size > 200 * 1024) { // Batasi 200KB per file agar tidak blow-up token
      return `[Error: File ${filePath} is too large (${Math.round(stat.size / 1024)}KB) - skipped]`;
    }
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (err: any) {
    return `[Error reading ${filePath}: ${err.message}]`;
  }
}
