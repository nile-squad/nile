import * as process from 'node:process';
import chalk from 'chalk';
import { exists, joinPaths, readFile, writeFile } from '../utils/file-ops';

export default async function generateAction(
  serviceName: string,
  actionName: string
) {
  const cwd = process.cwd();

  // Check if service exists
  const serviceDir = joinPaths(cwd, 'services', serviceName);
  if (!(await exists(serviceDir))) {
    console.error(chalk.red(`Error: Service "${serviceName}" does not exist`));
    process.exit(1);
  }

  console.log(chalk.blue(`Generating action: ${actionName}...`));

  try {
    // Create handler file
    const handlerPath = joinPaths(serviceDir, `${kebabCase(actionName)}.ts`);
    if (await exists(handlerPath)) {
      console.error(
        chalk.red(`Error: Handler "${kebabCase(actionName)}.ts" already exists`)
      );
      process.exit(1);
    }

    const handlerContent = generateHandler(actionName);
    await writeFile(handlerPath, handlerContent);

    // Update actions.ts
    const actionsPath = joinPaths(serviceDir, 'actions.ts');
    if (await exists(actionsPath)) {
      let content = await readFile(actionsPath);

      // Add import
      const importName = `${camelCase(actionName)}Handler`;
      const importLine = `import { ${importName} } from './${kebabCase(actionName)}';`;
      if (!content.includes(importLine)) {
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

      // Add action to array
      const actionNameKebab = kebabCase(actionName);
      const actionDefinition = `  {
    name: '${actionNameKebab}',
    description: 'TODO: Add description',
    handler: ${importName},
    validation: {
      zodSchema: null,
    },
  },`;

      // Find the actions array and add to it
      if (content.includes('export const') && content.includes('Actions')) {
        const match = content.match(
          /export const \w+Actions: ActionTypes\.Actions = \[([\s\S]*)\];/
        );
        if (match) {
          const arrayContent = match[1];
          const newArrayContent = arrayContent + actionDefinition;
          content = content.replace(/\[([\s\S]*)\]/, `[${newArrayContent}]`);
        }
      }

      await writeFile(actionsPath, content);
    }

    console.log(
      chalk.green(`✓ Action "${actionName}" generated successfully!`)
    );
  } catch (error) {
    console.error(chalk.red('Error generating action:'), error);
    process.exit(1);
  }
}

function generateHandler(actionName: string): string {
  const handlerName = `${camelCase(actionName)}Handler`;
  const actionNameKebab = kebabCase(actionName);

  return `import type { ActionTypes } from '@nile-squad/nile/types';
import { Ok, safeError } from '@nile-squad/nile/utils';

export const ${handlerName}: ActionTypes.ActionHandler = async (payload) => {
  // TODO: Implement logic for ${actionNameKebab}
  
  return Ok({ message: '${actionNameKebab} completed' });
};
`;
}

function camelCase(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function kebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}
