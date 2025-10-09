import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-5xl w-full">
        <h1 className="text-6xl font-bold mb-4">🌊 Nile</h1>
        <p className="text-2xl text-muted-foreground mb-8">
          TypeScript-first, service-oriented backend framework for building modern, AI-ready backends
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <Link
            href="/docs"
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          >
            <h2 className="mb-3 text-2xl font-semibold">
              Documentation{' '}
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Learn how to build backends with Nile
            </p>
          </Link>

          <Link
            href="/docs/getting-started"
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          >
            <h2 className="mb-3 text-2xl font-semibold">
              Quick Start{' '}
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Get started in minutes with our quick start guide
            </p>
          </Link>

          <Link
            href="/docs/api-reference"
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          >
            <h2 className="mb-3 text-2xl font-semibold">
              API Reference{' '}
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Complete API reference for all protocols
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
