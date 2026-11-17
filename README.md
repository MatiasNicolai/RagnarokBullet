# 🏹 Ragnarok Bullet Hell

Bullet hell 2D vertical estilo Touhou con la estética y los personajes de Ragnarok Online.
6 personajes jugables, 8 niveles con jefes MVP, co-op local **y online**.
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
| Pausa | P | P | |
| Menús | Flechas/WASD + ENTER · ESC volver | | |

En **online**, cada jugador está solo en su máquina y puede usar cualquier set
local (teclas de P1 o de P2, cualquier gamepad).

Gamepads en local: pad 0 → P1, pad 1 → P2 (el teclado siempre funciona para ambos).

**P** congela la partida (sim, partículas y música) y **ESC** pregunta *¿Volver al
menú principal?* con **NO** preseleccionado — un ESC de más ya no tira la partida.
En co-op **online** no se puede pausar (el lockstep acopla a los dos clientes:
congelar de un lado colgaría al otro), así que ahí P avisa y ESC pregunta sin
frenar la partida.

## 🗺️ Campaña — 8 niveles

Campaña encadenada (vidas / bombas / power / score se arrastran entre niveles):

1. **Campos de Prontera → Plaza de Prontera** — mid-boss Mastering, jefe **Orc Hero**.
2. **Mazmorra de Geffen → Geffenia** — mid-boss **Doppelganger**, jefe **Dark Lord**.
3. **Glast Heim** — mid-boss **Baphomet Jr. gigante**, jefe **Baphomet**.
4. **Juperos** — mid-boss **Archdam**, jefe **Vesper**.
5. **Laboratorio de Lighthalzen** — mid-boss **Experimento Fallido**, jefes duales **Seyren Windsor & Magaleta**.
6. **Pirámide del Sol** — mid-boss **Osiris**, jefe **Amon-Ra**.
7. **Reino de Niflheim** — mid-boss **Loli Ruri**, jefe **Lord of Death**.
8. **Torre de Thanatos** — mid-boss: los **cuatro fragmentos del alma** en dos parejas (Odium + Despero, Maero + Dolor); jefe final **Thanatos**.

Cada nivel: oleadas de enemigos por biomas que transicionan sobre mapas inspirados en RO,
diálogos pre-jefe, jefe con spell cards y barra de vida por
fases (duelo doble en el nivel 5), y resultados con medalla S/A/B/C.
Vencer los 8 → pantalla de **victoria**.

**La Torre de Thanatos va con todo.** Es el nivel más largo y sus mobs traen mecánicas propias: Lady Solace **cura** a los enemigos cercanos (mátala primero), Void Mimic se **teletransporta** con aviso y Dame of Sentinel dispara por una línea de mira marcada.

**Thanatos** tiene 3,3 veces la vida de Lord of Death, repartida en 7 cartas:
- En su primera forma invoca **ecos** de Orc Hero, Baphomet y Lord of Death.
- Después **despierta** en una segunda forma y abre una carta de **supervivencia**: 30 s invulnerable (20 s en Novice) en los que solo hay que aguantar.
- Las tres últimas cartas son las más densas del juego.

Extras: cartas de monstruo coleccionables (drop raro) y potenciadores de los cofres
(Awakening = más cadencia, Speed = más velocidad, Guardia Kafra = escudo de 1 golpe).

## 🕹️ Menú y extras

- **Título**: JUGAR · PRÁCTICA DE JEFES · RÉCORDS · 🎯 ELEGIR NIVEL (jugar cualquier nivel suelto con cualquier personaje, sin avanzar la campaña) · 🌐 CO-OP ONLINE, con selector de dificultad (Novice / Normal / Nightmare).
- **Personajes** con iconos de skill ilustrados en la selección y en el HUD.
- **Música mp3** en menú y los 8 niveles, con fallback chiptune si una pista falla; Pirámide, Niflheim y la Torre de Thanatos conservan su tema durante sus jefes, y victoria usa chiptune.
- **SFX** por clase, **récords locales** con iniciales arcade.
- **Práctica de jefes**: los jefes de los 8 niveles, más Loli Ruri y los dos duelos de fragmentos. Las tarjetas van en dos filas: ←→ recorre la lista y ↑↓ cambia de fila.
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
- **Peso del build:** el `dist` publicado ronda los 210 MB. Dos reglas lo mantienen ahí:
  - la música de runtime se encodea a 128 kbps desde los masters de `Music/` (`npm run music`), no se copia tal cual;
  - el arte que solo alcanzan las herramientas internas (`?art=v2`, `?artlab=1`) se poda del build en `vite.config.js`. Sigue disponible en `npm run dev` y archivado en `art-clean/`. Para publicarlo igual: `VITE_PREVIEW_ART=1 npm run build`.

## 🧪 Tests y herramientas

- `cd server && npm test` — tests headless:
  - **estáticos:** determinismo del sim, práctica dual, aislamiento de epoch, inventario de assets y, para la Torre, el piso de vida de Thanatos (≥3× cualquier jefe final anterior), la carta de supervivencia, los ecos, la sanadora y un run completo con checksum de replay;
  - **stack online:** relay + lockstep + determinismo (los checksums de dos sims deben coincidir).
  - Con Node 26 en Windows, `test-static.mjs` a veces se cuelga **después** de imprimir `PASS`. Si pasa, córrelo con `timeout 60`.
- `node server/_guestbot.mjs <CÓDIGO>` — guest headless para probar un host real del navegador contra un peer.
- `npm run slice` — regenera `public/assets/` (atlas + manifiesto de personajes).
- `node tools/slice-monsters.mjs` · `slice-bosses.mjs` · `slice-skills.mjs` — recortan las hojas de mobs / jefes+mid-bosses / iconos de skill.
- `python tools/slice-pyramid.py` · `slice-niflheim.py` · `slice-prontera-v3.py` · `slice-thanatos.py`: slicers deterministas del arte v2 hacia `public/assets-v2/`. Validan antes de escribir y dos corridas dan sha256 idéntico.
  - `slice-thanatos.py` reutiliza el núcleo de `slice-niflheim.py` y además quita las sombras del suelo.
  - Con `--qa-on-error` dibuja las hojas de contacto aunque falle un chequeo.
- `npm run music`: regenera `public/assets/music/` desde los masters de `Music/` a 128 kbps (necesita `ffmpeg` en el PATH).
  - `node tools/encode-music.mjs thanatos.mp3` encodea solo las pistas nombradas, para no reescribir las demás con otra versión de ffmpeg.
- **Arte nuevo:** se genera con la CLI de Codex y se aprueba hoja por hoja. Prompts, referencias y procedencia van en `art-clean/<set>-gpt/`; el de la Torre está en `art-clean/thanatos-gpt/`, y el plan completo del nivel en [THANATOS-PLAN.md](THANATOS-PLAN.md).

## 📁 Estructura

- `src/engine/` — loop, input, RNG con semilla, pooling, spatial hash, atlas, audio/música
- `src/sim/` — **simulación determinista** (solo avanza por ticks + inputs; nada de `Math.random()`/`Date.now()`)
- `src/net/` — cliente de red + **driver lockstep** (netcode online)
- `src/characters/` · `src/levels/` — kits de clase y scripting de oleadas
- `src/render/` · `src/ui/` · `src/scenes/` — capa PixiJS (unidireccional sim → pantalla), HUD y escenas
- `server/` — **relay WebSocket** (Node + `ws`)
- `tools/` — slicers de sprite sheets

Diseño completo y roadmap en [MASTERPLAN.md](MASTERPLAN.md).
