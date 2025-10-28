import Handlebars from 'handlebars';

export function renderTemplate(
  template: string,
  data: Record<string, string | number | boolean>
): string {
  const compiled = Handlebars.compile(template);
  return compiled(data);
}

export function registerHelper(
  name: string,
  fn: (...args: unknown[]) => string
): void {
  Handlebars.registerHelper(name, fn);
}

// Register common helpers
Handlebars.registerHelper('camelCase', (str: string) => {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
});

Handlebars.registerHelper('pascalCase', (str: string) => {
  const camel = str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  return camel.charAt(0).toUpperCase() + camel.slice(1);
});

Handlebars.registerHelper('kebabCase', (str: string) => {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
});
