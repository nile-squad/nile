# Nile Documentation Site

This is the official documentation site for Nile, built with Next.js and Fumadocs.

## Development

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Building

Build the site for production:

```bash
pnpm build
```

Start the production server:

```bash
pnpm start
```

## Documentation Structure

```
web/
├── app/                    # Next.js app directory
│   ├── docs/              # Documentation pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── content/               # MDX documentation files
│   ├── index.mdx         # Documentation home
│   ├── getting-started/  # Getting started guide
│   ├── core-concepts/    # Core concepts
│   ├── api-reference/    # API reference
│   │   ├── rest-rpc.mdx
│   │   ├── websocket-rpc.mdx
│   │   └── agentic.mdx
│   └── guides/           # How-to guides
│       ├── architecture.mdx
│       ├── authentication.mdx
│       └── hooks.mdx
├── lib/                   # Utilities
│   └── source.ts         # Fumadocs source configuration
└── public/               # Static assets

```

## Writing Documentation

All documentation files are written in MDX (Markdown with JSX support).

### File Format

Each documentation file should follow this structure:

```mdx
---
title: Page Title
description: Page description for SEO
---

**Version:** 1.0  
**Date:** January 16, 2025  
**Author:** Hussein Kizz

## Section 1

Content here...

## Section 2

More content...

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at [Nile Squad Labz](https://github.com/nile-squad)

*This documentation reflects the current implementation and is subject to evolution. Contributions and feedback are welcome.*
```

### Documentation Rules

Follow the rules defined in `/docs/documentation-rules.md`:

- Use numbered sections
- Include proper code blocks with language tags
- Add blank lines before and after code blocks
- Use professional, technical language
- No emojis in specification documents
- Include working, tested examples

### Adding New Pages

1. Create a new `.mdx` file in the appropriate `content/` subdirectory
2. Add frontmatter with title and description
3. Follow the documentation format
4. The page will automatically appear in the sidebar

## Deployment

The documentation site can be deployed to any platform that supports Next.js:

- Vercel (recommended)
- Netlify
- AWS Amplify
- Self-hosted with Node.js

## License

Same as the main Nile project - MIT License.
