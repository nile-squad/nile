import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-5xl">
        <h1 className="mb-4 font-bold text-6xl">🌊 Nile</h1>
        <p className="mb-8 text-2xl text-muted-foreground">
          TypeScript-first, service-oriented backend framework for building
          modern, AI-ready backends
        </p>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Link
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
            href="/docs"
          >
            <h2 className="mb-3 font-semibold text-2xl">
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
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
            href="/docs/getting-started"
          >
            <h2 className="mb-3 font-semibold text-2xl">
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
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
            href="/docs/api-reference"
          >
            <h2 className="mb-3 font-semibold text-2xl">
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
