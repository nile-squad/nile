import * as process from 'node:process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { exists, joinPaths, readFile, writeFile } from '../utils/file-ops';
import { scanSchemasForTables } from '../utils/scanner';

export default async function generateSub(serviceName: string) {
  const cwd = process.cwd();

  // Check if service exists
  const serviceDir = joinPaths(cwd, 'services', serviceName);
  if (!(await exists(serviceDir))) {
    console.error(chalk.red(`Error: Service "${serviceName}" does not exist`));
    process.exit(1);
  }

  console.log(chalk.blue('Scanning schemas for sub-services...'));

  try {
    // Scan for tables
    const schemasPath = joinPaths(cwd, 'db', 'schemas');
    const tables = await scanSchemasForTables(schemasPath);

    if (tables.length === 0) {
      console.error(chalk.red('No tables found in db/schemas/'));
      process.exit(1);
    }

    console.log(chalk.green(`Found ${tables.length} table(s):`));
    tables.forEach((table) => {
      console.log(`  - ${table.name}`);
    });

    // Prompt user for table selection
    const { selectedTables } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedTables',
        message: 'Select tables to create sub-services for:',
        choices: tables.map((t) => ({
          name: t.name,
          value: t.name,
        })),
      },
    ]);

    if (!selectedTables || selectedTables.length === 0) {
      console.log(chalk.yellow('No tables selected. Exiting.'));
      return;
    }

    // Generate sub-services
    const subServices = selectedTables.map((tableName: string) => ({
      name: tableName,
      description: `${pascalCase(tableName)} management`,
      tableName,
      idName: 'id',
      actions: [],
      validation: {
        validationMode: 'auto',
      },
    }));

    // Create or update sub-services.ts
    const subServicesPath = joinPaths(serviceDir, 'sub-services.ts');
    const subServicesContent = generateSubServicesFile(subServices);
    await writeFile(subServicesPath, subServicesContent);

    // Update service/index.ts to import and register subs
    await updateServiceIndex(serviceDir, serviceName);

    console.log(
      chalk.green(`✓ Generated sub-services for: ${selectedTables.join(', ')}`)
    );
  } catch (error) {
    console.error(chalk.red('Error generating sub-services:'), error);
    process.exit(1);
  }
}

function generateSubServicesFile(
  subServices: Array<{
    name: string;
    description: string;
    tableName: string;
    idName: string;
    actions: unknown[];
    validation: { validationMode: string };
  }>
): string {
  return `import type { ActionTypes } from '@nile-squad/nile/types';

export const subServices: ActionTypes.SubServices = [
${subServices
  .map(
    (sub) => `  {
    name: '${sub.name}',
    description: '${sub.description}',
    tableName: '${sub.tableName}',
    idName: '${sub.idName}',
    actions: ${JSON.stringify(sub.actions)},
    validation: {
      validationMode: '${sub.validation.validationMode}',
    },
  },`
  )
  .join('\n')}
];
`;
}

async function updateServiceIndex(serviceDir: string) {
  const indexPath = joinPaths(serviceDir, 'index.ts');
  if (await exists(indexPath)) {
    let content = await readFile(indexPath);

    // Add import for sub-services if not present
    if (!content.includes('import { subServices }')) {
      const importLine = "import { subServices } from './sub-services';";
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

    // Update service definition to include subs
    if (
      content.includes('export const') &&
      !content.includes('subs: subServices')
    ) {
      content = content.replace(
        /export const \w+Service: ActionTypes\.Service = \{/,
        '$&\n  autoService: true,\n  subs: subServices,'
      );
    }

    await writeFile(indexPath, content);
  }
}

function pascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
