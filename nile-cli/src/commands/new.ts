import * as path from 'node:path';
import * as process from 'node:process';
import * as url from 'node:url';
import chalk from 'chalk';
import fs from 'fs-extra';
import { exists, joinPaths, mkdir } from '../utils/file-ops';
import { renderTemplate } from '../utils/template-engine';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get templates directory - handle both development and built locations
function getTemplatesDir(): string {
  const isDevelopment = __dirname.includes('src');
  if (isDevelopment) {
    return path.join(__dirname, '../../src/templates/project');
  }
  // In built output, we're in dist/some-file.js, templates are in dist/templates/project
  return path.join(__dirname, 'templates/project');
}

export default async function newCommand(projectName: string) {
  const cwd = process.cwd();
  const targetDir = joinPaths(cwd, projectName);

  // Check if directory already exists
  if (await exists(targetDir)) {
    console.error(
      chalk.red(`Error: Directory "${projectName}" already exists`)
    );
    process.exit(1);
  }

  console.log(chalk.blue(`Creating Nile project: ${projectName}...`));

  try {
    // Create project directory
    await mkdir(targetDir);

    // Render all template files
    const templatesDir = getTemplatesDir();
    await renderTemplates(templatesDir, targetDir, { projectName });

    console.log(
      chalk.green(`✓ Project "${projectName}" created successfully!`)
    );
    console.log(chalk.yellow('\nNext steps:'));
    console.log(`  cd ${projectName}`);
    console.log('  pnpm install');
    console.log('  cp .env.example .env');
    console.log('  pnpm db:push');
    console.log('  pnpm dev');
  } catch (error) {
    console.error(chalk.red('Error creating project:'), error);
    process.exit(1);
  }
}

async function renderTemplates(
  srcDir: string,
  destDir: string,
  data: { projectName: string }
) {
  // Get all files recursively from template directory
  const files = await getAllFiles(srcDir);

  for (const file of files) {
    const relativePath = path.relative(srcDir, file);
    let destPath = path.join(destDir, relativePath);

    // Remove .hbs extension from destination
    destPath = destPath.replace(/\.hbs$/, '');

    // Special handling for .env.example file
    if (destPath.endsWith('env.example')) {
      destPath = destPath.replace('env.example', '.env.example');
    }

    // Create directories if needed
    await fs.ensureDir(path.dirname(destPath));

    // Read template
    const template = await fs.readFile(file, 'utf-8');

    // Render template
    const rendered = renderTemplate(template, data);

    // Write file (remove .hbs extension)
    await fs.writeFile(destPath, rendered, 'utf-8');
  }
}

async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getAllFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.hbs')) {
      files.push(fullPath);
    }
  }

  return files;
}
