import * as process from 'node:process';
import chalk from 'chalk';
import {
  exists,
  joinPaths,
  mkdir,
  readFile,
  writeFile,
} from '../utils/file-ops';

export default async function generateService(serviceName: string) {
  const cwd = process.cwd();
  const serviceDir = joinPaths(cwd, 'services', serviceName);

  // Check if service already exists
  if (await exists(serviceDir)) {
    console.error(chalk.red(`Error: Service "${serviceName}" already exists`));
    process.exit(1);
  }

  console.log(chalk.blue(`Generating service: ${serviceName}...`));

  try {
    // Create service directory
    await mkdir(serviceDir);

    // Create index.ts
    const indexContent = `import type { ActionTypes } from '@nile-squad/nile/types';
import { ${pascalCase(serviceName)}Actions } from './actions';

export const ${camelCase(serviceName)}Service: ActionTypes.Service = {
  name: '${serviceName}',
  description: '${pascalCase(serviceName)} service',
  actions: ${pascalCase(serviceName)}Actions,
};
`;

    await writeFile(joinPaths(serviceDir, 'index.ts'), indexContent);

    // Create actions.ts
    const actionsContent = `import type { ActionTypes } from '@nile-squad/nile/types';

export const ${pascalCase(serviceName)}Actions: ActionTypes.Actions = [];
`;

    await writeFile(joinPaths(serviceDir, 'actions.ts'), actionsContent);

    // Update services/index.ts
    const servicesIndexPath = joinPaths(cwd, 'services', 'index.ts');
    if (await exists(servicesIndexPath)) {
      let content = await readFile(servicesIndexPath);
      const importLine = `import { ${camelCase(serviceName)}Service } from './${serviceName}';`;
      const exportLine = `export const services = [${camelCase(serviceName)}Service];`;

      if (!content.includes(importLine)) {
        // Find the last import and add after it
        const lines = content.split('\n');
        let lastImportIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('import ')) {
            lastImportIndex = i;
          }
        }
        lines.splice(lastImportIndex + 1, 0, importLine);
        content = lines.join('\n');
      }

      // Update exports array
      if (content.includes('export const services')) {
        content = content.replace(
          /export const services = \[([^\]]+)\];/,
          (_match, services) => {
            const serviceList = services.trim()
              ? services.split(',').map((s: string) => s.trim())
              : [];
            if (!serviceList.includes(`${camelCase(serviceName)}Service`)) {
              serviceList.push(`${camelCase(serviceName)}Service`);
            }
            return `export const services = [${serviceList.join(', ')}];`;
          }
        );
      } else {
        content += `\n${exportLine}\n`;
      }

      await writeFile(servicesIndexPath, content);
    }

    console.log(
      chalk.green(`✓ Service "${serviceName}" generated successfully!`)
    );
    console.log(
      chalk.yellow(
        `\nNext: Add actions with "npx nile-cli g action ${serviceName} <action-name>"`
      )
    );
  } catch (error) {
    console.error(chalk.red('Error generating service:'), error);
    process.exit(1);
  }
}

function pascalCase(str: string): string {
  return str
    .replace(/-([a-z])/g, (g) => g[1].toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());
}

function camelCase(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}
