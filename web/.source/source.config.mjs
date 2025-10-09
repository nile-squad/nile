// source.config.ts
import { defineCollections } from 'fumadocs-mdx/config';

var docs = defineCollections({
  type: 'docs',
  dir: 'content',
});
export { docs };
