import { DocsLayout } from 'fumadocs-ui/layout';
import type { ReactNode } from 'react';
import { source } from '@/lib/source';

export default function RootDocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      nav={{
        title: '🌊 Nile',
        url: '/',
      }}
      sidebar={{
        defaultOpenLevel: 0,
      }}
      tree={source.pageTree}
    >
      {children}
    </DocsLayout>
  );
}
