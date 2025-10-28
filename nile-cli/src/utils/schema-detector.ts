import { readFile } from './file-ops';

export interface TableInfo {
  name: string;
  primaryKey?: string;
}

/**
 * Extract table name from a Drizzle schema file string
 * This is a simple regex-based approach to find pgTable() calls
 */
export function extractTableName(sourceCode: string): string | null {
  // Look for pgTable(identifier, ...)
  const match = sourceCode.match(/pgTable\(["'`]([^"'`]+)["'`]/);
  return match ? match[1] : null;
}

/**
 * Get all table definitions from a schema file
 */
export async function getTablesFromFile(
  filePath: string
): Promise<TableInfo[]> {
  const content = await readFile(filePath);
  const tables: TableInfo[] = [];

  // Split by export const and find pgTable declarations
  const lines = content.split('\n');
  let currentTable: { name: string | null; export: string | null } = {
    name: null,
    export: null,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find export const declarations
    const exportMatch = line.match(/export const (\w+)/);
    if (exportMatch) {
      currentTable.export = exportMatch[1];
    }

    // Find pgTable("table_name", ...)
    const tableMatch = line.match(/pgTable\(["'`]([^"'`]+)["'`]/);
    if (tableMatch && currentTable.export) {
      currentTable.name = tableMatch[1];
      tables.push({
        name: currentTable.name,
        primaryKey: 'id', // Default assumption, could be enhanced
      });
      currentTable = { name: null, export: null };
    }
  }

  return tables;
}
