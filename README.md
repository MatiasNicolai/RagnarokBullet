# 🏹 Ragnarok Bullet Hell

Bullet hell 2D vertical estilo Touhou con la estética y los personajes de Ragnarok Online.
6 personajes jugables, 3 niveles con jefes MVP, co-op local **y online**.
PixiJS v8 + Vite, con simulación determinista y netcode lockstep.

## ▶ Jugar ahora

**https://matiasnicolai.github.io/RagnarokBullet/**

Sin instalar nada. Funciona en 1 jugador, co-op local (2 en el mismo teclado) y co-op online.

## 🌐 Co-op online (2 jugadores en PCs distintas)

Ambos abren la URL de arriba, luego en el título → **🌐 CO-OP ONLINE**:

1. Un jugador elige **CREAR SALA** → aparece un **código de 4 letras**; se lo pasa al otro.
2. El otro elige **UNIRSE A SALA** → escribe el código.
3. Cada uno elige su personaje → **ESPACIO** para marcar *LISTO*.
4. El anfitrión presiona **ENTER** → ¡a jugar la campaña juntos!

> El netcode es lockstep sobre la simulación determinista: solo viajan los inputs
> (un par de bytes por tick), nunca el estado de las balas. Un servidor relay
> mínimo empareja las salas y reenvía esos inputs.

## 🎮 Controles

| Acción | P1 | P2 (co-op local) | Gamepad |
|---|---|---|---|
| Mover | WASD | Flechas | Stick / D-pad |
| Disparo | J (mantener) | Numpad 1 | A |
| Foco (lento + hitbox visible) | K | Numpad 2 | X / RB / RT |
| Bomba temática (3 cargas) | L | Numpad 3 | B |
| Especial (medidor lleno) | I | Numpad 0 | Y |
| Menús | Flechas/WASD + ENTER · ESC volver | | |

En **online**, cada jugador usa las teclas de P1 en su propia máquina.
Gamepads: pad 0 → P1, pad 1 → P2 (el teclado siempre funciona para ambos).

## 🗺️ Campaña — 3 niveles

Campaña encadenada (vidas / bombas / power / score se arrastran entre niveles):

1. **Campos de Prontera → Plaza de Prontera** — mid-boss Mastering, jefe **Orc Hero**.
2. **Mazmorra de Geffen → Geffenia** — mid-boss **Doppelganger**, jefe **Dark Lord**.
3. **Glast Heim** — mid-boss **Baphomet Jr. gigante**, jefe final **Baphomet**.

Cada nivel: 8 enemigos por biomas que transicionan sobre mapas reales de RO, diálogo
pre-jefe, jefe con 3 spell cards y barra de vida por fases, y resultados con medalla
S/A/B/C. Vencer los 3 → pantalla de **victoria**.

Extras: cartas de monstruo coleccionables (drop raro) y potenciadores de los cofres
(Awakening = más cadencia, Speed = más velocidad, Guardia Kafra = escudo de 1 golpe).

## 🕹️ Menú y extras

- **Título**: JUGAR · PRÁCTICA DE JEFES · RÉCORDS · 🌐 CO-OP ONLINE, con selector de dificultad (Novice / Normal / Nightmare).
- **Personajes** con iconos de skill ilustrados en la selección y en el HUD.
- **Música mp3** en menú y los 3 niveles; jefe/victoria en chiptune que acelera en la última spell card.
- **SFX** por clase, **práctica de jefes**, **récords locales** con iniciales arcade.
- Juice: screen shake, hit-stop, corazones que laten con 1 vida, fundidos.
- **Mute** (arriba a la derecha, siempre visible): música (♪) y SFX (bocina), teclas **M** / **N**. Se guarda en el navegador.

## ⚙️ Mecánicas

- **Graze:** rozar balas da puntos y carga el especial.
- **Bomba (L):** limpia la pantalla + efecto temático por clase (veneno, congelar, campo sagrado, Asura con esferas…).
- **Items:** Zeny (puntos), Blue Gemstone (POWER ▲), Red Potion (+1 vida), cofres (¡cuidado con los mimics!), Yggdrasil Leaf (revive al compañero caído).
- **Auto-recolección:** sube al tercio superior del campo y los items vuelan hacia ti.

## 💻 Desarrollo local

```bash
npm install
npm run dev            # cliente en http://localhost:5173

# para probar el online en local, en otra terminal:
cd server && npm install && npm start   # relay en ws://localhost:8090
```

Con el relay corriendo, "CO-OP ONLINE" funciona en la misma máquina (dos pestañas del navegador). Ver [`server/README.md`](server/README.md) para el relay y el deploy.

## 🚀 Despliegue

- **Cliente:** GitHub Pages, deploy automático en cada push a `main` vía GitHub Actions ([`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)). El build usa `VITE_RELAY_URL` (apunta al relay) y `VITE_BASE=/RagnarokBullet/`.
- **Relay:** Railway (`wss://ragnarokbullet-production.up.railway.app`), servicio con Root Directory `server`, redeploy automático al cambiar `server/`.

## 🧪 Tests y herramientas

- `cd server && npm test` — test headless del stack online (relay + lockstep + determinismo: los checksums de dos sims deben coincidir).
- `node server/_guestbot.mjs <CÓDIGO>` — guest headless para probar un host real del navegador contra un peer.
- `npm run slice` — regenera `public/assets/` (atlas + manifiesto de personajes).
- `node tools/slice-monsters.mjs` · `slice-bosses.mjs` · `slice-skills.mjs` — recortan las hojas de mobs / jefes+mid-bosses / iconos de skill.

## 📁 Estructura

- `src/engine/` — loop, input, RNG con semilla, pooling, spatial hash, atlas, audio/música
- `src/sim/` — **simulación determinista** (solo avanza por ticks + inputs; nada de `Math.random()`/`Date.now()`)
- `src/net/` — cliente de red + **driver lockstep** (netcode online)
- `src/characters/` · `src/levels/` — kits de clase y scripting de oleadas
- `src/render/` · `src/ui/` · `src/scenes/` — capa PixiJS (unidireccional sim → pantalla), HUD y escenas
- `server/` — **relay WebSocket** (Node + `ws`)
- `tools/` — slicers de sprite sheets

Diseño completo y roadmap en [MASTERPLAN.md](MASTERPLAN.md).
