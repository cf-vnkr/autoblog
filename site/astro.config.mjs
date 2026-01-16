import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import { renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Custom integration to rename sitemap-index.xml to sitemap.xml
function renameSitemap() {
  return {
    name: 'rename-sitemap',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const distPath = fileURLToPath(dir);
        const oldPath = join(distPath, 'sitemap-index.xml');
        const newPath = join(distPath, 'sitemap.xml');
        
        if (existsSync(oldPath)) {
          renameSync(oldPath, newPath);
          console.log('✓ Renamed sitemap-index.xml to sitemap.xml');
        }
      },
    },
  };
}

export default defineConfig({
  site: 'https://cfdemo.site',
  integrations: [tailwind(), sitemap(), renameSitemap()],
  output: 'static',
  build: {
    format: 'directory',
  },
});
