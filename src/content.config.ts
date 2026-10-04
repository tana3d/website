import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({title:z.string(),description:z.string(),pubDate:z.coerce.date(),updatedDate:z.coerce.date().optional(),heroImage:z.string().optional(),author:z.string().default('Tana'),tags:z.array(z.string()).default([])}),
});
export const collections = { blog };
