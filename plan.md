## Plan: Migrate Project to Node.js + tsx

### Implementation Flow

1.  **Update `package.json`:**
    *   Read the current `package.json`.
    *   Remove any bun-related scripts and dependencies.
    *   Add `tsx` as a dev dependency.
    *   Update the `scripts` to use `pnpm` and `tsx`.
    *   Update the `engines` field to specify `pnpm`.

2.  **Clean Up Old Files:**
    *   Remove `bun.lock`.
    *   Remove `node_modules`.

3.  **Install Dependencies:**
    *   Run `pnpm install`.

4.  **Update `tsconfig.json`:**
    *   Read `tsconfig.json`.
    *   Remove any bun-specific types (e.g., `"bun"` in the `types` array).

5.  **Find and Replace Bun-specific APIs:**
    *   Search the codebase for `Bun.`.
    *   Replace `Bun.file()` with `fs.readFileSync()`.
    *   Replace `Bun.write()` with `fs.writeFileSync()`.

6.  **Verify:**
    *   Run the updated tests (`pnpm test`).
    *   Run the linter (`pnpm lint`).
    *   Run the type checker (`pnpm type-check`).

### Tech Stack
*   **Nile Project:** Node.js, TypeScript, tsx, pnpm, tsup (for bundling).

### Key Aspects
*   Successfully migrating the project to a Node.js and `tsx` stack.
*   Ensuring all functionality remains intact after the migration.
*   Maintaining the existing project structure and conventions.
