import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

// Preview-only art trees: reachable ONLY through the internal tools
// (?art=v2 Clean-Art preview and ?artlab=1 Art Lab), never by a player on
// the normal campaign path. Vite copies public/ verbatim, so without this
// they ship ~16 MB of unreachable sheets to GitHub Pages on every deploy.
// They stay in the repo (and in `npm run dev`): the byte-identical archive
// copies live under art-clean/{bosses-v2.1,geffen-v2.1}/.
// Keep them in a build with VITE_PREVIEW_ART=1 (e.g. to share a preview URL).
const PREVIEW_ONLY_ART = ['assets-v2/bosses', 'assets-v2/geffen'];

function prunePreviewArt() {
  const keep = process.env.VITE_PREVIEW_ART === '1';
  return {
    name: 'prune-preview-art',
    apply: 'build',
    closeBundle() {
      if (keep) {
        this.info('VITE_PREVIEW_ART=1 -> preview art kept in the build');
        return;
      }
      const outDir = path.resolve(process.cwd(), 'dist');
      for (const rel of PREVIEW_ONLY_ART) {
        const dir = path.join(outDir, rel);
        if (!fs.existsSync(dir)) continue;
        const bytes = fs.readdirSync(dir)
          .reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
        fs.rmSync(dir, { recursive: true, force: true });
        this.info(`pruned ${rel} (${(bytes / 1e6).toFixed(1)} MB, preview-only)`);
      }
    },
  };
}

// `base` is the public path the app is served from. '/' locally and on a
// root-served host; '/RagnarokBullet/' on GitHub Pages (a project subpath).
// Set via VITE_BASE at build time so runtime asset URLs (import.meta.env.BASE_URL)
// resolve correctly under any deploy path.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [prunePreviewArt()],
});
