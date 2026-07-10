import { defineConfig } from 'vite';

// `base` is the public path the app is served from. '/' locally and on a
// root-served host; '/RagnarokBullet/' on GitHub Pages (a project subpath).
// Set via VITE_BASE at build time so runtime asset URLs (import.meta.env.BASE_URL)
// resolve correctly under any deploy path.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
});
