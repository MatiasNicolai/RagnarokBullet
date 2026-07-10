// Level-1 backdrop built from the real Prontera map art: five stitched map
// tiles that scroll from the outer fields up into the city plaza as the level
// progresses. A subtle dark overlay keeps danmaku readable over the busy art.
// Render-only; driven by sim.biome (0..1) via update().
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { FIELD_W, FIELD_H } from '../sim/constants.js';

const SEAM_H = 56; // feather band height (px) centred on each tile boundary

// Vertical gradient: transparent → dark → transparent. Cached across levels so
// every MapBackground reuses one texture for its seam-hiding bands.
let seamTexture = null;
function getSeamTexture() {
  if (seamTexture) return seamTexture;
  const c = document.createElement('canvas');
  c.width = 1; c.height = SEAM_H;
  const g = c.getContext('2d').createLinearGradient(0, 0, 0, SEAM_H);
  g.addColorStop(0, 'rgba(8,14,26,0)');
  g.addColorStop(0.5, 'rgba(8,14,26,0.7)');
  g.addColorStop(1, 'rgba(8,14,26,0)');
  const ctx = c.getContext('2d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1, SEAM_H);
  seamTexture = Texture.from(c);
  return seamTexture;
}

export class MapBackground {
  constructor(app, parent, mapTextures) {
    this.root = new Container();
    parent.addChild(this.root);

    this.strip = new Container();
    this.root.addChild(this.strip);

    // Order top→bottom so advancing (progress→1) climbs toward the plaza:
    // [plaza(5), avenue(4), gate(3), approach(2), fields(1)].
    const ordered = [...mapTextures].reverse();
    let y = 0;
    const seams = [];
    ordered.forEach((tex, i) => {
      const s = new Sprite(tex);
      const scale = FIELD_W / tex.width;
      s.scale.set(scale);
      s.position.set(0, y);
      this.strip.addChild(s);
      y += tex.height * scale;
      if (i < ordered.length - 1) seams.push(y); // internal boundary
    });
    this.total = y;

    // feather each internal seam with a soft dark band so the joins between
    // separately-captured map tiles don't read as a hard horizontal line.
    for (const sy of seams) {
      const band = new Sprite(getSeamTexture());
      band.width = FIELD_W;
      band.height = SEAM_H;
      band.position.set(0, sy - SEAM_H / 2);
      this.strip.addChild(band);
    }

    // dark wash + soft vignette for bullet contrast
    const wash = new Graphics();
    wash.rect(0, 0, FIELD_W, FIELD_H).fill({ color: 0x0a1020, alpha: 0.28 });
    this.root.addChild(wash);
  }

  update(biome) {
    const p = Math.max(0, Math.min(1, biome));
    // p=0 → bottom of strip (fields) visible; p=1 → top (plaza) visible
    this.strip.y = -(this.total - FIELD_H) * (1 - p);
  }
}
