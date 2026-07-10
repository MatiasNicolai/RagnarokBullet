# Ragnarok Barrage

Bullet hell 2D estilo Touhou con personajes de Ragnarok Online. Ver [MASTERPLAN.md](MASTERPLAN.md) para el diseño completo y el roadmap.

## Ejecutar

```bash
npm install
npm run dev      # abre http://localhost:5173
```

## Controles

| Acción | P1 | P2 | Gamepad |
|---|---|---|---|
| Mover | WASD | Flechas | Stick/D-pad |
| Disparo | J (mantener) | Numpad 1 | A |
| Foco (lento + hitbox visible) | K | Numpad 2 | X / RB / RT |
| Bomba temática (3 cargas) | L | Numpad 3 | B |
| Especial (medidor lleno) | I | Numpad 0 | Y |
| Menús | Flechas/WASD + ENTER · ESC volver | | |

Gamepads: pad 0 controla a P1, pad 1 a P2 (el teclado siempre funciona para ambos).

Flujo: título → selección (P1 elige; luego P2 puede unirse con las flechas) → Nivel 1 → resultados.

## Campaña — 3 niveles

Campaña completa encadenada (vidas/bombas/power/score se arrastran entre niveles):

1. **Campos de Prontera → Aldea Orc** — mid-boss Mastering, jefe **Orc Hero**.
2. **Torre de Geffen → Geffenia** — mid-boss Doppelganger, jefe **Dark Lord**.
3. **Glast Heim** (lluvia y relámpagos) — mid-boss Baphomet Jr. gigante, jefe final **Baphomet**.

Cada nivel: 8 enemigos distintos por biomas que transicionan, fondo vivo con parallax, diálogo pre-jefe, jefe con 3 spell cards y barra de vida por fases, y pantalla de resultados con medalla S/A/B/C. Al vencer los 3 → pantalla de **victoria**.

Extras: cartas de monstruo coleccionables (drop raro), potenciadores temporales de los cofres (Awakening = más cadencia, Speed = más velocidad, Guardia Kafra = escudo de 1 golpe).

## Menú y extras

- **Título con menú**: JUGAR · PRÁCTICA DE JEFES · RÉCORDS, y selector de dificultad (Novice / Normal / Nightmare).
- **Música chiptune** por escena (menú, cada nivel, jefe, victoria); el tema de jefe acelera en su última spell card.
- **SFX** por clase (cada personaje suena distinto al disparar).
- **Modo práctica de jefes**: elige personaje y jefe y pelea directo.
- **Récords locales** con iniciales arcade (se guardan en el navegador).
- Juice: screen shake, hit-stop, corazones que laten al quedar 1 vida, fundidos de escena.
- **Botones de mute** (arriba a la derecha, siempre visibles): música (♪) y SFX (bocina). Clic o teclas **M** / **N**. El estado se guarda en el navegador (localStorage).

## Mecánicas

- **Graze:** rozar balas da puntos y carga el medidor de especial.
- **Bomba (L):** limpia la pantalla + efecto temático por clase (veneno, congelar, campo sagrado, Asura con esferas...).
- **Items:** Zeny (puntos), Blue Gemstone (POWER ▲), Red Potion (+1 vida), cofres del tesoro (¡cuidado con los mimics!), Yggdrasil Leaf (revive al compañero caído en co-op).
- **Auto-recolección:** sube al tercio superior del campo y todos los items vuelan hacia ti.

## Scripts

- `npm run dev` — dev server con live reload
- `npm run build` — build de producción estática
- `npm run slice` — regenera `public/assets/` (atlas + manifiesto) desde `Character assets full.png` (14 poses por personaje: frente + espalda); escribe `tools/debug-slices.png` para verificar los recortes
- `node tools/slice-monsters.mjs` — recorta las hojas de mobs (`monsters/*.png`) a `public/assets/monsters{,2,3,4}.{png,json}` (23 mobs con poses DOWN/UP); escribe `tools/debug-monsters*.png`
- `node tools/slice-bosses.mjs` — recorta `monsters/Bosses.png` (layout transpuesto) a `public/assets/bosses.{png,json}` (Orc Hero, Dark Lord, Baphomet); escribe `tools/debug-bosses.png`
- Mapas reales: Nivel 1 `Maps/prontera00{1..5}.png` y Nivel 2 `Maps/geffen00{1..5}.png` copiados a `public/assets/maps/` (scroll de fondo por nivel vía `mapSet`)

## Estructura

- `src/engine/` — loop, input, RNG con semilla, pooling, spatial hash, atlas
- `src/sim/` — simulación determinista (solo avanza por ticks + inputs; nada de `Math.random()`/`Date.now()` aquí)
- `src/characters/` — kit de cada clase
- `src/levels/` — scripting de oleadas
- `src/render/` — capa PixiJS (unidireccional: sim → pantalla)
- `tools/slice-sheet.mjs` — recorte automático del sprite sheet
