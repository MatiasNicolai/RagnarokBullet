# Pyramid — implementation brief

## Scope
Implement Pyramid as the sixth campaign level, after Biolab, using the approved visual assets in this folder. Muse handles code, deterministic asset processing, manifests, integration, gameplay configuration, documentation, and tests. Muse must not generate or redesign graphical artwork.

## Approved source assets
- Map: `pyramid-map-gpt-image-2-medium-v2-oasis-entrance-tomb.png` (`793x1983`, approved).
- Common-enemy sheet: `pyramid-enemies-gpt-image-2-medium-v1.png` (`1122x1402`, approved).
- Boss sheet: `pyramid-bosses-gpt-image-2-medium-v2-user-references.png` (`1122x1402`, approved).
- User identity references are archived under `references/`; they are references only, not runtime assets.
- Prompts and older V1 candidates remain archival and must not be used as production defaults.

## Level identity
Three visual macro-zones, bottom to top:
1. outdoor desert oasis approach;
2. monumental Pyramid entrance and descent;
3. deep royal tomb and solar sanctuary.

Midboss: Osiris.
Final boss: Amon-Ra.

Common enemy roster:
1. Familiar
2. Soldier Skeleton
3. Archer Skeleton
4. Mummy
5. Verit
6. Matyr
7. Isis
8. Ancient Mummy

## Visual contract
- Preserve all original files under `public/assets` and all approved source images under `art-clean/pyramid-gpt`.
- Runtime derivatives must be written to a new, auditable Pyramid-specific location under `public/assets-v2` or another non-destructive new tree consistent with the project.
- Deterministic processing may crop, remove the off-white review background, decontaminate edge matte, add transparent padding, and pack atlases. It may not redraw or procedurally replace the artwork.
- Keep sprite identities and artwork intact. Avoid clipping weapons, bat wings, Osiris's hands, Amon-Ra's throne/staff, or detached effects.
- Amon-Ra is permanently seated on the carved throne; Osiris is the slim purple mummy.
- Map dimensions and aspect ratio must remain compatible with existing level maps.

## Gameplay contract
- Add Pyramid after Biolab without breaking prior campaign order or practice mode.
- Follow existing level architecture and conventions rather than creating a parallel subsystem.
- Configure waves and enemy behaviors that exploit each roster silhouette:
  - Familiar: agile swoops;
  - Soldier Skeleton: direct shielded advance;
  - Archer Skeleton: ranged aimed volleys;
  - Mummy: slow pressure;
  - Verit: erratic rush;
  - Matyr: fast pursuit;
  - Isis: curved/spread magic;
  - Ancient Mummy: elite curse patterns.
- Place Osiris in a middle-section arena with mobile claw/bandage/curse patterns.
- Place Amon-Ra in the final sanctuary with throne-centered solar/eclipsing radial patterns and clear telegraphs.
- Reuse established deterministic simulation, scaling, collisions, co-op and online conventions.
- Add reasonable defaults where details are unspecified, matching the difficulty progression after Biolab.

## Required implementation
1. Inspect existing level/map/atlas/manifest/wave/boss/practice/online architecture.
2. Create reproducible asset-processing script(s) for the three approved sheets/map; emit runtime PNGs plus manifests/metadata and validation metrics.
3. Integrate Pyramid runtime assets without overwriting originals.
4. Add the sixth level, roster, waves, Osiris encounter and Amon-Ra encounter to campaign and relevant practice/debug selectors.
5. Ensure asset-load failures are diagnosed clearly and fallback behavior remains safe.
6. Update documentation with asset provenance, regeneration commands and how to launch/test Pyramid.
7. Extend deterministic/static tests for roster IDs, level order, assets/manifests and encounter wiring.
8. Run the project build and server test suite; fix failures caused by this work.

## Safety
- The repository is already dirty from prior approved work. Do not revert or overwrite unrelated modifications.
- Do not commit.
- Do not use browser automation or the user's personal Chrome.
- Do not generate any new graphics.
