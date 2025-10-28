import chalk from 'chalk';
import { Command } from 'commander';

const program = new Command();

program
  .name('nile-cli')
  .description('CLI tool for scaffolding and generating Nile backend projects')
  .version('0.1.0');

// New command - scaffold project
program
  .command('new <project-name>')
  .description('Create a new Nile backend project')
  .action(async (projectName: string) => {
    try {
      const { default: newCommand } = await import('./commands/new.js');
      await newCommand(projectName);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Generate commands
const generate = program.command('generate').alias('g');

generate
  .command('service <name>')
  .description('Generate a new service')
  .action(async (name: string) => {
    try {
      const { default: generateService } = await import(
        './commands/generate-service.js'
      );
      await generateService(name);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

generate
  .command('sub <service-name>')
  .description('Generate sub-services for a service')
  .action(async (serviceName: string) => {
    try {
      const { default: generateSub } = await import(
        './commands/generate-sub.js'
      );
      await generateSub(serviceName);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

generate
  .command('action <service-name> <action-name>')
  .description('Generate an action with handler for a service')
  .action(async (serviceName: string, actionName: string) => {
    try {
      const { default: generateAction } = await import(
        './commands/generate-action.js'
      );
      await generateAction(serviceName, actionName);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program.parse();
