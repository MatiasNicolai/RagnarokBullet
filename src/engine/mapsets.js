// Map-set tile inventory + atomic selection. No PixiJS here, so the node
// test suite can import this directly and exercise the exact selection logic
// GameScene uses (not source-string matching).
//
// A themed level's scrolling backdrop tiles, in scroll order (first = start /
// bottom, last = boss arena / top). Prontera inserts two extra "royal approach"
// screens between the avenue (004) and the plaza arena (005). Juperos, Biolab
// and Pyramid ship native 7-tile sets. Loaded lazily so first paint isn't
// blocked on maps.
export const MAP_SETS = {
  prontera: {
    dir: 'assets/maps',
    files: ['prontera001', 'prontera002', 'prontera003', 'prontera004', 'pronteraNewA', 'pronteraNewB', 'prontera005'],
  },
  geffen: {
    dir: 'assets/maps',
    files: ['geffen001', 'geffen002', 'geffen003', 'geffen004', 'geffenNewA', 'geffenNewB', 'geffen005'],
  },
  glastheim: {
    dir: 'assets/maps',
    files: ['glastheim001', 'glastheim002', 'glastheim003', 'glastheim004', 'glastheimNewA', 'glastheimNewB', 'glastheim005'],
  },
  // native 7-tile set (007 = Vesper arena)
  juperos: {
    dir: 'assets/maps',
    files: ['juperos001', 'juperos002', 'juperos003', 'juperos004', 'juperos005', 'juperos006', 'juperos007'],
  },
  // native 7-tile set (007 = core lab arena)
  biolab: {
    dir: 'assets/maps',
    files: ['biolab001', 'biolab002', 'biolab003', 'biolab004', 'biolab005', 'biolab006', 'biolab007'],
  },
  // Pyramid of the Sun — native 7-tile set (001=oasis floor … 007=sanctuary).
  // Served from the non-destructive assets-v2/pyramid tree (see tools/slice-pyramid.py).
  pyramid: {
    dir: 'assets-v2/pyramid/maps',
    files: ['pyramid001', 'pyramid002', 'pyramid003', 'pyramid004', 'pyramid005', 'pyramid006', 'pyramid007'],
  },
  // Niflheim — native 7-tile set (001=valley floor … 007=fortress approach).
  // Served from the non-destructive assets-v2/niflheim tree (see tools/slice-niflheim.py).
  niflheim: {
    dir: 'assets-v2/niflheim/maps',
    files: ['niflheim001', 'niflheim002', 'niflheim003', 'niflheim004', 'niflheim005', 'niflheim006', 'niflheim007'],
  },
  // Thanatos Tower — native 7-tile set (001=museum entrance … 004=room of
  // angel … 007=unknown area). Served from assets-v2/thanatos (see
  // tools/slice-thanatos.py).
  thanatos: {
    dir: 'assets-v2/thanatos/maps',
    files: ['thanatos001', 'thanatos002', 'thanatos003', 'thanatos004', 'thanatos005', 'thanatos006', 'thanatos007'],
  },
};

// Expected tile filenames for a set ([] for unknown names).
export function mapTileFiles(name) {
  return MAP_SETS[name]?.files ?? [];
}

// Asset directory for a set (null for unknown names).
export function mapTileDir(name) {
  return MAP_SETS[name]?.dir ?? null;
}

// Atomic selection: a set is usable only when COMPLETE — same length as the
// inventory and no holes. A partial set must never render (tiles would show
// missing/reordered progression); callers fall back to the procedural theme.
export function selectMapTextures(maps, name) {
  const want = mapTileFiles(name);
  const set = maps?.[name];
  if (!want.length || !Array.isArray(set) || set.length !== want.length) return null;
  return set.every(Boolean) ? set : null;
}

// Filenames of one load attempt that failed, for per-file diagnosis
// (atlas warns each one). Pure so the missing-tile case is testable.
export function missingMapTiles(name, loaded) {
  const files = mapTileFiles(name);
  return files.filter((_, i) => !loaded[i]);
}

// Readiness for a level: the current complete set, else wait for one
// ensureMapSet pass and re-select (still atomic — a partial load resolves
// to null). GameScene calls this for its own mapSet at construction.
export async function resolveLevelMaps(atlas, name) {
  const ready = selectMapTextures(atlas.maps, name);
  if (ready || !mapTileFiles(name).length) return ready ?? null;
  const late = await atlas.ensureMapSet(name);
  return selectMapTextures({ [name]: late }, name);
}
