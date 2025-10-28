import * as path from 'node:path';
import * as fs from 'fs-extra';

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await fs.copy(src, dest);
}

export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function readFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

export async function exists(filePath: string): Promise<boolean> {
  return await fs.pathExists(filePath);
}

export async function mkdir(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

export function joinPaths(...paths: string[]): string {
  return path.join(...paths);
}

export function getDirName(filePath: string): string {
  return path.dirname(filePath);
}

export function resolvePath(...paths: string[]): string {
  return path.resolve(...paths);
}
