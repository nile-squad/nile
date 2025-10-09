import { pageTree } from '@/lib/page-tree';

export const source = {
  pageTree,
  getPage: (slugs?: string[]) => {
    const slug = slugs?.join('/') || 'index';
    // This is a simplified version - in production you'd load actual MDX files
    return null;
  },
  generateParams: () => {
    return [];
  },
};
