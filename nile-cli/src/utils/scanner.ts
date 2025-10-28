import * as path from 'node:path';
import * as fs from 'fs-extra';
import type { TableInfo } from './schema-detector';
import { getTablesFromFile } from './schema-detector';

async function scanFiles(pattern: string): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const glob = (await import('glob')).glob;
  return glob(pattern);
}

export async function scanSchemaFiles(dirPath: string): Promise<string[]> {
  const pattern = path.join(dirPath, '**/*.ts');
  const files = await scanFiles(pattern);
  return files;
}

export async function scanSchemasForTables(
  dirPath: string
): Promise<TableInfo[]> {
  const schemaFiles = await scanSchemaFiles(dirPath);
  const allTables: TableInfo[] = [];

  for (const file of schemaFiles) {
    try {
      const tables = await getTablesFromFile(file);
      allTables.push(...tables);
    } catch {
      // Skip files that can't be parsed
      console.warn(`Warning: Could not parse ${file}`);
    }
  }

  return allTables;
}

export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
