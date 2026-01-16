import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://cfdemo.site',
  integrations: [tailwind()],
  output: 'static',
  build: {
    format: 'directory',
  },
});
