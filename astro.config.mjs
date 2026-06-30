// @ts-check
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [react()],
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    plugins: [
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Rustrack',
          short_name: 'Rustrack',
          description: 'Rust server intelligence and wipe collaboration.',
          theme_color: '#15110d',
          background_color: '#f7f2ea',
          display: 'standalone',
          start_url: '/es/dashboard',
          icons: [
            {
              src: '/icons/icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: '/es/dashboard',
          globPatterns: ['**/*.{css,js,html,svg,png,ico,webmanifest}'],
        },
      }),
    ],
  },
});
