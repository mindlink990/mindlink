import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths work on GitHub Pages and Cloudflare Workers.
  base: './',
  plugins: [],
  build: {
    target: 'es2022',
  },
});
