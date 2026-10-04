import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ site: 'https://tana.gg', output: 'server', devToolbar: { enabled: false }, session: false, adapter: cloudflare({ imageService: 'compile' }), vite: { plugins: [tailwindcss()] } });
