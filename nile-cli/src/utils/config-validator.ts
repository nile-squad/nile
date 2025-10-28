import { directoryExists, fileExists } from './scanner';

export async function validateNileProject(cwd: string): Promise<boolean> {
  // Check for key files that indicate a Nile project
  const requiredFiles = [
    'package.json',
    'config.ts',
    'server.config.ts',
    'index.ts',
  ];

  for (const file of requiredFiles) {
    const exists = await fileExists(`${cwd}/${file}`);
    if (!exists) {
      return false;
    }
  }

  // Check for typical Nile directory structure
  const requiredDirs = ['services', 'db'];
  for (const dir of requiredDirs) {
    const exists = await directoryExists(`${cwd}/${dir}`);
    if (!exists) {
      return false;
    }
  }

  return true;
}

export async function findServices(cwd: string): Promise<string[]> {
  const servicesPath = `${cwd}/services`;
  const dirExists = await directoryExists(servicesPath);

  if (!dirExists) {
    return [];
  }

  // Scan services directory for service folders
  const fs = await import('fs-extra');
  const entries = await fs.readdir(servicesPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}
