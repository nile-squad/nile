# Nile Documentation Setup

This folder contains comprehensive framework documentation for Nile, built with Next.js and Fumadocs.

## Current Status

✅ **Completed:**
- All documentation content written in MDX format
- Next.js app structure created
- Tailwind CSS and Fumadocs UI configured
- Complete documentation covering:
  - Getting Started guide
  - Core Concepts
  - REST-RPC API Reference
  - WebSocket RPC API Reference
  - Agentic System API Reference
  - Architecture Guide
  - Authentication Guide
  - Hooks Guide

⚠️ **Requires Completion:**
- Fumadocs source configuration needs finalization
- MDX file loading needs to be connected
- Build process needs testing

## Documentation Files

All documentation is written following the project's documentation rules from `/docs/documentation-rules.md`:

### Structure

```
web/content/
├── index.mdx                      # Home page
├── getting-started/
│   └── index.mdx                  # Installation and first server
├── core-concepts/
│   └── index.mdx                  # Services, actions, hooks
├── api-reference/
│   ├── index.mdx                  # API overview
│   ├── rest-rpc.mdx              # REST-RPC protocol
│   ├── websocket-rpc.mdx         # WebSocket protocol  
│   └── agentic.mdx               # AI agent protocol
└── guides/
    ├── architecture.mdx           # Layered architecture
    ├── authentication.mdx         # Auth setup
    └── hooks.mdx                  # Hook system
```

## Documentation Quality

All documentation follows these principles:

- **Beginner-friendly:** Clear explanations with practical examples
- **Show, don't tell:** Working code examples throughout
- **Consistent formatting:** Following documentation-rules.md
- **Professional tone:** Technical but accessible
- **Comprehensive:** Covers all major features

## Next Steps to Complete Setup

1. **Fix Fumadocs MDX Loading:**
   ```bash
   # The generated .source files need proper configuration
   # See: https://fumadocs.dev/docs/mdx
   ```

2. **Test Build:**
   ```bash
   cd web
   npm run build
   ```

3. **Verify Pages Load:**
   ```bash
   npm run dev
   # Visit http://localhost:3000/docs
   ```

## Alternative Approach

If Fumadocs MDX proves complex, consider:

1. **Next.js MDX Plugin:** Use `@next/mdx` directly
2. **Static HTML:** Pre-render MDX to HTML
3. **Different Framework:** Consider Docusaurus or VitePress

## Files Created

- `package.json` - Dependencies and scripts
- `next.config.mjs` - Next.js configuration  
- `tailwind.config.ts` - Tailwind CSS setup
- `tsconfig.json` - TypeScript configuration
- `app/layout.tsx` - Root layout with Fumadocs provider
- `app/page.tsx` - Home page
- `app/docs/layout.tsx` - Docs layout with sidebar
- `app/docs/[[...slug]]/page.tsx` - Dynamic doc pages
- `lib/source.ts` - Source configuration
- `lib/page-tree.ts` - Navigation tree
- `mdx-components.tsx` - MDX component overrides

## Documentation Features

Each documentation page includes:

- Clear titles and descriptions
- Version and author information
- Numbered sections for easy reference
- Code examples with syntax highlighting
- Links to related documentation
- Author attribution and feedback note

## Contributing

When adding new documentation:

1. Create MDX file in appropriate `content/` subdirectory
2. Follow the template format from existing files
3. Include practical, working examples
4. Add to `lib/page-tree.ts` navigation
5. Test the page renders correctly

## License

MIT License - Same as the main Nile project
