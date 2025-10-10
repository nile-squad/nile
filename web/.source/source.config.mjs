// source.config.ts
import { defineCollections } from 'fumadocs-mdx/config';

const docs = defineCollections({
  type: 'docs',
  dir: 'content',
});
export { docs };
