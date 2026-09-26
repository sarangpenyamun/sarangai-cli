import fs from 'fs';
import path from 'path';

export interface FileOperationResult {
  success: boolean;
  message: string;
  filePath: string;
  content?: string;
}

export function safeReadFile(relativeOrFullPath: string): FileOperationResult {
  try {
    const fullPath = path.resolve(process.cwd(), relativeOrFullPath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, message: `File not found: ${relativeOrFullPath}`, filePath: fullPath };
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return { success: true, message: 'Berhasil membaca file', filePath: fullPath, content };
  } catch (err: any) {      return { success: false, message: `Failed to read file: ${err.message}`, filePath: relativeOrFullPath };
  }
}

export function safeWriteFile(relativeOrFullPath: string, content: string): FileOperationResult {
  try {
    const fullPath = path.resolve(process.cwd(), relativeOrFullPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
    return { success: true, message: 'File written successfully', filePath: fullPath, content };
  } catch (err: any) {      return { success: false, message: `Failed to write file: ${err.message}`, filePath: relativeOrFullPath };
  }
}
