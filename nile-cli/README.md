# Nile CLI

Command-line interface tool for scaffolding and generating Nile backend projects.

## Installation

```bash
npm install -g @nile-squad/nile-cli
```

Or use with npx:
```bash
npx @nile-squad/nile-cli <command>
```

## Commands

### Create New Project

```bash
npx nile-cli new <project-name>
```

Creates a new Nile backend project with:
- Complete project structure
- Configuration files
- Sample database schema and models
- Service setup with example sub-service

### Generate Service

```bash
npx nile-cli g service <service-name>
# or
npx nile-cli generate service <service-name>
```

Creates a new service with:
- Service directory
- index.ts (service definition)
- actions.ts (actions array)

### Generate Sub-Services

```bash
npx nile-cli g sub <service-name>
# or
npx nile-cli generate sub <service-name>
```

Scans your Drizzle schemas and prompts you to select tables, then:
- Creates sub-services.ts
- Generates sub-service configurations for selected tables
- Updates service index to register subs
- Uses `validationMode: 'auto'` for automatic schema inference

### Generate Action

```bash
npx nile-cli g action <service-name> <action-name>
# or
npx nile-cli generate action <service-name> <action-name>
```

Creates an action with handler:
- Generates handler file `<action-name>.ts`
- Updates actions.ts with action definition
- Includes TODO comments for implementation

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run in development
pnpm dev

# Type check
pnpm type-check

# Lint
pnpm lint
```

## Examples

```bash
# Create a new backend
npx nile-cli new my-backend

cd my-backend

# Generate a service
npx nile-cli g service products

# Generate sub-services for tables
npx nile-cli g sub products

# Generate an action
npx nile-cli g action products get-product-stats
```

