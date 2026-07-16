# MASTERPLAN — "Ragnarok Bullet Hell"

Bullet hell 2D estilo Touhou, vista top-down (scroll vertical), estética Ragnarok Online, 1–2 jugadores en co-op local, 6 personajes jugables con kits únicos, 3 niveles con jefes MVP clásicos de RO.

---

## ⭐ ESTADO Y PRÓXIMOS PASOS (actualizado 2026-07-09)

**Stack:** PixiJS v8 + Vite, JS ES modules. `npm run dev` → http://localhost:5173. Simulación determinista (`src/sim/`) desacoplada del render (`src/render/`). Verificación en navegador vía Claude Preview + un shot-server (`node tools/shot-server.mjs`, puerto 8123) porque la pestaña de preview corre en background y pausa el render — se captura el canvas y se guarda a `tools/shots/`.

**Hecho (iteraciones 0–5 + arte):** juego completo jugable — título ilustrado con menú/dificultad, selección de 6 personajes, co-op local, 3 niveles con oleadas + mid-boss + jefe (spell cards), mundo vivo, loot, cartas, **música real mp3 en las 4 escenas principales** (menú + niveles 1/2/3; boss/victoria siguen en chiptune), SFX, práctica de jefes, récords, mute buttons (M/N). **23 mobs con sprite real** + **3 jefes con sprite real** + **2 mid-bosses con sprite real** (Doppelganger Nivel 2, Baphomet Jr. gigante Nivel 3 — layout irregular de 9 filas en `Bosses.png` extraído por `slice-bosses.mjs`, cada uno con su UP pose faltante manejada por fallback en el renderer). **Iconos de skill ilustrados** (24 = 6 personajes × 4 skills) en el sidebar solo **y en las cartas de selección**, extraídos de `Characters/Character Skills.png` por `slice-skills.mjs`. **Los 3 niveles con mapas reales** (Prontera, Geffen dungeon, Glast Heim) — la arena del jefe cae exactamente en el 5º mapa de cada set (plaza/santuario/catedral); las costuras entre tiles se difuminan con una banda de gradiente oscuro (`SEAM_H` en `mapbackground.js`). **Nivel 4 — Juperos** (civilización mecánica perdida): 8 mobs nuevos (Dimik, Venatu, Cell, Sentry, Plasma Wisp, Guardian, Repair Drone, Spark Beetle → `monsters6`), mid-boss **Archdam** (`monsters7`) y jefe final **Vesper** (`bosses2`, MVP) — sprites reales animados extraídos de `Monsters/Juperos *.png` (`slice-monsters.mjs` + `slice-juperos.mjs`). Vesper es ahora el jefe final de la campaña. 7 mapas reales de Juperos (`juperos001..007`, set nativo de 7 tiles, 007 = arena de Vesper); `level4Theme` procedural de respaldo. **Co-op ONLINE (Iteración 6) funcionando**: relay `ws` (`server/relay.js`, salas por código de 4 letras), netcode lockstep sobre la sim determinista (`src/net/lockstep.js`, delay de 3 ticks + checksum anti-desync cada 30), lobby online (`src/scenes/online.js`, crear/unirse + elegir personaje + ready), `GameScene` en modo online con auto-avance de nivel por `epoch`. Verificado end-to-end (navegador host vs guest headless): 400+ ticks en lockstep perfecto, checksums idénticos, sin desync. **Solo falta el deploy del relay** (Railway) para jugar entre máquinas distintas.

**🟢 DESPLEGADO Y JUGABLE ONLINE:** cliente en **https://matiasnicolai.github.io/RagnarokBullet/** (GitHub Pages, deploy automático vía Actions en cada push a `main` — `.github/workflows/deploy-pages.yml`), relay en **`wss://ragnarokbullet-production.up.railway.app`** (Railway, servicio con Root Directory `server`). El repo está en https://github.com/MatiasNicolai/RagnarokBullet. El cliente embebe la URL del relay vía `VITE_RELAY_URL` y usa `VITE_BASE=/RagnarokBullet/` (rutas de assets vía `import.meta.env.BASE_URL`).

### ▶ PRÓXIMOS PASOS (pendientes concretos)
1. **Smoke test multi-nivel online**: el encadenado de niveles (epoch++) está implementado y el nivel 1 está verificado en vivo; falta probar una transición completa nivel 1→2 online con dos jugadores reales.
2. **Balance fino** por clase/dificultad con playtesting (continuo).

### Cómo correr el online en local
- `cd server && npm install && npm start` (relay en :8090). `npm run dev` en la raíz. En el título → 🌐 CO-OP ONLINE → CREAR SALA (da un código) / UNIRSE. Dos pestañas del navegador = 2 jugadores en la misma máquina.
- Test headless del stack completo: `cd server && npm test` (relay + lockstep + determinismo). Helper manual: `node server/_guestbot.mjs <CÓDIGO>` (guest headless contra un host real en el navegador).

### Pipeline de assets (cómo integrar hojas nuevas)
- **Mobs** (layout: paneles con banner + fila DOWN de 5 poses + fila UP de 5 + fila de efectos): agregar un `processSheet({...})` en `tools/slice-monsters.mjs` con los `panels` (regiones x/y), correr `node tools/slice-monsters.mjs`, revisar `tools/debug-monstersN.png`, y sumar `monstersN` en `atlas.js` (`addMonsters`). El `name` del panel debe coincidir con el `skin` en el `levelN.js`. El render usa el sprite automáticamente.
- **Jefes** (layout transpuesto: poses en filas etiquetadas a la izquierda, 3 frames/columna): `tools/slice-bosses.mjs` — los frames de idle/moveL/moveR se detectan por gaps de columnas (con corte en valles finos para separar armas fusionadas y recorte de residuo de la fila superior); attack/hit quedan de 1 frame (sus celdas extra traen efectos sueltos). `atlas.bosses[n].down[pose]` es un **array de texturas**; `renderer.syncBoss` elige pose por estado (attack en transición/muerte, moveL/R según dx, idle) y cicla frames cada 9 ticks.
- **Iconos de skill** (grilla 6 filas × 4 iconos, fondo claro horneado): `tools/slice-skills.mjs` — detecta columnas/filas por proyección de píxeles no-fondo, keying por flood-fill desde los bordes (preserva núcleos blancos internos), y emite `skills.json` (`{charId: [rect×4]}`) + `skills.png`. Cargar en `atlas.skills`; el sidebar (`skillIcon()` en `src/ui/sidebar.js`) usa `atlas.skills[char.id][i]` con fallback procedural. Orden de filas = `ROSTER`.
- **Fondo transparente horneado**: las hojas traen un tablero/blanco horneado (alpha 255); los slicers lo quitan por componentes conexas (regiones grandes bright-neutral).

---

## 1. Visión

- **Género:** Bullet hell / danmaku vertical (cámara desde arriba, el escenario avanza hacia abajo).
- **Referencias:** Touhou (patrones de balas, bombas, grazing), Ragnarok Online (clases, monstruos, MVPs, estética chibi).
- **Jugadores:** 1P solo o 2P co-op — local (teclado compartido y/o gamepads) y **online** (salas con código, vía servidor relay).
- **Assets:** 100% creados en el proyecto. El sprite sheet `character assets.png` ya cubre a los 6 personajes (7 poses c/u: idle, move L/R, bank L/R, hit, attack) + proyectiles de ejemplo por clase. Falta todo lo demás (enemigos, jefes, balas enemigas, fondos, UI, audio).

## 2. Stack técnico (propuesta)

- **PixiJS v8 (WebGL 2D) + JavaScript (ES modules) + Vite como dev server/bundler.**
  - Render por GPU: batching de miles de sprites a 60 fps, ideal para danmaku con 2 jugadores.
  - Efectos visuales reales: filtros de bloom/glow en balas, blend modes aditivos, sistemas de partículas (ParticleContainer), screen shake y flashes por shader.
  - La lógica de juego (posiciones, colisiones, patrones) queda desacoplada del render: usaremos object pooling y spatial hashing propios; PixiJS solo dibuja.
  - Vite da live reload instantáneo para iterar; `npm run build` produce un estático que corre en cualquier navegador.
- **Simulación determinista desde el día 0** (requisito del online): timestep fijo (60 ticks/s desacoplados del render), RNG propio con semilla compartida, y el estado del juego avanza solo en función de inputs por tick. Mismo seed + mismos inputs = misma partida exacta en ambos clientes. Bonus gratis: replays y práctica de jefes.
- **Backend online:** servidor Node.js mínimo (`ws`) desplegado en **Railway** — crea salas con código de 4 letras y reenvía inputs entre los 2 jugadores (relay). No simula el juego: con simulación determinista solo viajan inputs (~bytes por tick), nunca el estado de las balas.
- **Audio:** Web Audio API — SFX sintetizados por código + música chiptune generada (secuenciador propio), estilo BGM de RO.
- **Estructura de carpetas:**
  ```
  /index.html
  /package.json   (pixi.js, @pixi/filter-* según se necesiten, vite)
  /src
    /engine      (loop, input, pooling, colisiones, escenas, audio)
    /entities    (player, bullet, enemy, boss, pickup)
    /characters  (un archivo por clase: kit, stats, patrones de disparo)
    /levels      (level1.js, level2.js, level3.js — scripting de oleadas)
    /net         (cliente de red: salas, sincronización de inputs, lockstep)
    /ui          (HUD, menús, selección de personaje)
  /server        (relay Node.js + ws — se despliega a Railway)
  /assets
    /sprites     (recortes del sheet + nuevos assets)
    /audio       (si se pre-generan pistas)
  MASTERPLAN.md
  ```

## 3. Núcleo de gameplay

### Reglas base (para ambos jugadores)
- **Movimiento:** 8 direcciones, velocidad normal + **modo foco** (lento y preciso, muestra el hitbox — estándar Touhou).
- **Hitbox pequeño:** ~4 px en el centro del sprite (el sprite es grande pero solo el núcleo cuenta).
- **Vidas y bombas:** 3 vidas, 3 bombas por vida. La bomba limpia balas en pantalla + i-frames (cada clase tiene su bomba temática).
- **Graze:** rozar balas sin morir da puntos y carga lentamente el medidor de habilidad especial.
- **Power-ups estilo RO:** los enemigos sueltan drops temáticos — *Red Potion* (vida en modo casual), *Blue Gemstone* (sube nivel de disparo), *Zeny* (puntos), *Yggdrasil Leaf* (revive al compañero en co-op, rara).
- **Co-op:** si un jugador muere, respawnea gastando una vida del pool compartido (o el compañero lo revive con Yggdrasil Leaf). Fuego amigo: no existe.

### Controles
| Acción | P1 (teclado) | P2 (teclado) | Gamepad |
|---|---|---|---|
| Mover | WASD | Flechas | Stick/D-pad |
| Disparo | J (mantener) | Numpad 1 | A/X |
| Foco (lento) | K | Numpad 2 | RT/R2 |
| Bomba | L | Numpad 3 | B/Círculo |
| Especial | I | Numpad 0 | Y/Triángulo |

Gamepads detectados vía Gamepad API; cualquier jugador puede usar pad o teclado.

## 4. Los 6 personajes

Cada clase se diferencia en: patrón de disparo normal, disparo en foco, bomba, habilidad especial (se carga con graze/kills) y stats (velocidad, ancho de disparo, daño).

| # | Personaje | Clase | Disparo normal | Disparo en foco | Bomba | Especial (medidor) | Perfil |
|---|---|---|---|---|---|---|---|
| 1 | **Aramir** | Lord Knight | Abanico de 3 ondas de espada (*Bash*), corto-medio alcance, alto daño | *Pierce*: estocada concentrada que atraviesa enemigos | **Bowling Bash**: onda giratoria que barre la pantalla | **Two-Hand Quicken**: x2 cadencia + velocidad por 8 s | Tanque: 4 vidas en vez de 3, hitbox 5 px, lento |
| 2 | **Zeos** | Assassin Cross | Dagas dobles rápidas + shurikens laterales (*Grimtooth*) | *Sonic Blow*: ráfaga estrecha de altísimo DPS | **Meteor Assault**: explosión radial + veneno persistente | **Cloaking**: 3 s intangible, atraviesa balas | El más rápido del juego, daño alto, frágil |
| 3 | **Eric.** | High Wizard | Orbes arcanos teledirigidos suaves (*Soul Strike*) | *Jupitel Thunder*: rayo grueso concentrado | **Storm Gust**: congela y limpia toda la pantalla | **Meteor Storm**: lluvia de meteoros 5 s | Daño de área rey, movimiento lento, homing |
| 4 | **Dposada** | Saint (High Priest) | Cruces de luz (*Holy Light*), daño medio, arco amplio | *Judex*: columnas de luz verticales | **Magnus Exorcismus**: campo sagrado que daña y limpia balas | **Sanctuary/Heal**: cura 1 vida al equipo (o escudo en solo) | Soporte: sus drops curan al aliado, único con curación |
| 5 | **Chel_Snip** | Sniper | Flechas rectas muy rápidas (*Double Strafe*), largo alcance | *Focused Arrow*: láser de flecha perforante + crítico | **Arrow Storm**: cortina de flechas pantalla completa | **Falcon Assault**: el halcón barre y auto-ataca 6 s | Glass cannon de precisión, el disparo más largo y rápido |
| 6 | **Viri** | Monk | Puños de energía en ráfaga corta (*Triple Attack*), gana esferas espirituales al matar | *Chain Combo*: los puños convergen, daño sube por combo | **Asura Strike**: consume esferas, daño masivo en cono (la bomba más fuerte del juego con 5 esferas) | **Steel Body**: 5 s inmune sin poder disparar | Riesgo/recompensa: pegado al enemigo, sistema de esferas único |

Los proyectiles del sheet ya marcan la identidad visual: espadas doradas (Aramir), dagas púrpura (Zeos), orbes azules (Eric.), cruces doradas (Dposada), flechas (Chel_Snip), puños ígneos (Viri).

## 5. Los 3 niveles

Cada nivel: ~4–5 min, 3 fases de oleadas + mid-boss + jefe MVP con 3 spell cards (patrones nombrados, estilo Touhou).

Regla de variedad: **mínimo 6 tipos de enemigo pequeño por nivel**, cada uno con silueta, color y patrón de disparo/movimiento propios, introducidos de a poco para que cada tramo del nivel se sienta distinto.

### Nivel 1 — Campos de Prontera → Aldea Orc
- **Fondo:** praderas con caminos de tierra, árboles, cercas y casitas de Prontera que transicionan a empalizadas y tiendas del campamento orco; el pasto da paso a tierra pisoteada.
- **Enemigos (8):** Poring (rebota, dropea), Drops (kamikaze naranja), Lunatic (se planta y dispara anillos), Fabre (abanicos aimed), Pupa (estática, explota en anillo al morir — castiga matarla de cerca), Picky (zigzag veloz en bandadas), Chonchon (orbita al jugador y embiste), Orc Baby (aparece llegando al campamento, lanzitas aimed).
- **Mid-boss:** Mastering (poring gigante, spawnea porings).
- **Jefe MVP:** **Orc Hero** — spell cards: *Grito de Guerra* (ondas de choque concéntricas que empujan), *Hacha Tormenta* (hachas giratorias que rebotan en los bordes), *Carga del Héroe* (embestidas en línea + lluvia de lanzas orcas desde arriba).

### Nivel 2 — Torre de Geffen → Geffenia
- **Fondo:** interior de la torre (estanterías, círculos mágicos en el suelo, ventanales con la ciudad abajo) descendiendo a Geffenia: mármol oscuro, cristales flotantes, niebla violeta.
- **Enemigos (8):** Willow (tanque lento, suelta zeny extra), Zombie (absorbe daño, revive una vez), Munak (salta en arcos), Bongun (embiste en línea recta), Nine Tails (bolas de fuego en espiral corta), Deviruchi (zigzag + snipes precisos), Marionette (cuelga del borde superior y deja caer cortinas de balas verticales), Wraith (se desvanece y reaparece cerca).
- **Mid-boss:** Doppelganger (copia el patrón de disparo del personaje del jugador, invertido).
- **Jefe MVP:** **Dark Lord** — spell cards: *Meteor Storm* (lluvia de meteoros con zonas de aviso), *Hell Judgement* (su firma: anillos densos multicapa desde el centro), *Tinieblas Eternas* (la arena se oscurece y solo se ve cerca del jugador mientras caen rayos).

### Nivel 3 — Glast Heim
- **Fondo:** castillo gótico en ruinas — patios con estatuas rotas, pasillos con antorchas, vitrales; lluvia con relámpagos que iluminan la escena a golpes.
- **Enemigos (8):** Evil Druid (balas grandes y lentas que maldicen zonas), Dark Priest (teleport + snipes), Raydric (muros de lanzas horizontales que dejan un hueco), Khalitzburg (escudo frontal, hay que flanquearlo), Gargoyle (se posa en los bordes y dispara flechas aimed), Ghoul (enjambres lentos que acorralan), Whisper (intangible salvo el instante en que dispara), Baphomet Jr. (guadañas pequeñas en cruz).
- **Mid-boss:** Baphomet Jr. gigante (guadañas en cruz, veloz).
- **Jefe MVP final:** **Baphomet** — spell cards: *Guadaña Dimensional* (ondas cruzadas en X), *Invocación Demoníaca* (Baphomet Jr. orbitando + disparos), *Juicio Final* (patrón denso multicapa, lo más difícil del juego), fase desesperación al 10% de vida.

## 6. Mundo vivo, loot y game feel

Lo que separa un shooter funcional de uno **agradable y memorable**. Todo lo de esta sección es acumulativo: se reparte entre las iteraciones 2–6 (ver roadmap).

### 6.1 Fondos vivos que evolucionan
- **Multicapa con parallax:** suelo (tiles) + capa de decoración (árboles, casas, cercas, rocas, estatuas) + capa alta ocasional (copas de árboles, nubes sueltas que pasan por encima con sombra).
- **Decoración procedural determinista:** los adornos se colocan con el RNG de semilla sobre bandas laterales del campo (el centro queda limpio para leer las balas). Densidad y tipo cambian a lo largo del nivel.
- **El fondo narra el avance:** cada nivel tiene 3–4 "biomas" que transicionan suavemente (pradera → camino con cercas → empalizada orca → arena del jefe). Llegar al jefe se *ve*, no solo se mide.
- **Luz y clima:** tinte de luz que evoluciona (mediodía → atardecer en nivel 1; antorchas y relámpagos en GH), partículas ambientales (hojas al viento, polvo, lluvia, brasas).
- **Arena de jefe:** al llegar, el scroll se detiene y el fondo se oscurece/enfoca para el duelo.

### 6.2 Loot con personalidad (no solo explotarlos)
- **Imán de items:** los drops se atraen al jugador a corta distancia; **línea de auto-recolección** estilo Touhou — subir al tercio superior del campo absorbe todos los items en pantalla (premia jugar arriesgado).
- **Cofres del tesoro:** drop raro que cae rebotando; al abrirlo (tocarlo) revienta en una lluvia de recompensas (zeny grande + gema o poción). Variante mimic: 1 de cada ~8 muerde (susto inofensivo + más loot).
- **Cartas de monstruo** (RO puro): drop muy raro (~1%) del enemigo correspondiente; coleccionables por partida, cada una da un mini-bonus pasivo mientras dure la run (ej. Carta Poring: +imán; Carta Lunatic: +5% puntos). Colección visible al final.
- **Potenciadores temporales:** Awakening Potion (cadencia +20% por 10 s), Speed Potion (velocidad por 8 s), Guardia Kafra (escudo de 1 golpe).
- **Yggdrasil Leaf** (co-op): revive al compañero — ya planeada, entra aquí como drop raro de cofres.

### 6.3 Lectura del avance
- **Barra de progreso del nivel** al costado izquierdo del campo: línea vertical con marcadores de bioma, icono del mid-boss y retrato del jefe arriba; un cursor sube en tiempo real. En supervivencia (stage actual) marca la próxima oleada élite.
- **Alertas:** "¡WARNING!" parpadeante + silueta cuando entra el mid-boss/jefe, con jingle propio.
- **Post-nivel:** pantalla de resultados con score, grazes, precisión, items/cartas recogidos, muertes, y **medalla S/A/B/C** por desempeño.

### 6.4 Juice (animaciones y feedback)
- **Enemigos:** 2–3 frames de idle/movimiento, telegraph antes de disparar (parpadeo/hinchado 20 ticks), muerte con squash & stretch + pop de partículas del color del bicho + puntos flotantes.
- **Jugador:** estela sutil al moverse en foco, muzzle flash al disparar, ring de aviso al reaparecer, slow-motion de 6 ticks al perder vida (drama) y al dar el golpe final a un jefe (gloria).
- **Impactos:** hit-flash blanco en el enemigo golpeado (ya existe), micro screen-shake en bombas y muertes de élites, chispas en cada bala del jugador que conecta.
- **Jefes:** barra de vida superior con nombre y fases marcadas, corte de pantalla + nombre de la spell card al cambiar de fase, fondo reactivo (se tiñe con la fase).
- **UI:** números que cuentan hacia arriba (score), corazones que laten al quedar 1 vida, transiciones de escena con fade, todo el HUD responde a eventos (el contador de graze "salta" al rozar).

### 6.5 Memorabilidad
- **Diálogos estilo Touhou:** 2–3 líneas con retrato antes de cada jefe (el personaje elegido tiene líneas propias — 6 personajes × 3 jefes = 18 mini-diálogos con humor RO: "¿otra vez me matas por la carta?").
- **Sonido con identidad:** SFX distintos por clase (espada/daga/cast/santo/arco/puño), jingle de spell card, fanfarria de nivel completado, el tema del jefe acelera en su última fase.
- **Modo práctica de jefes:** se desbloquea al verlos una vez; elegir jefe + spell card y practicarla.
- **Cameos y guiños RO:** una Kafra saluda en el título, Porings pacíficos cruzan el fondo del nivel 1 (no disparan, dan puntos si... no, mejor dejarlos vivir), emotes de RO (/gg, /heh) en los diálogos.
- **Records locales:** top 5 de scores por personaje y dificultad (localStorage), con iniciales arcade de 3 letras.

## 7. Plan de assets (todo creado en el proyecto)

| Asset | Fuente | Detalle |
|---|---|---|
| Sprites de los 6 jugadores | ✅ Ya existe (`character assets.png`) | Recortar el sheet a frames individuales + atlas JSON con coordenadas |
| Proyectiles de jugadores | ✅ Parcial en el sheet | Recortar + variantes por nivel de poder |
| Balas enemigas | Crear (SVG→PNG o canvas procedural) | Set estilo danmaku: círculos, agujas, cuchillos, estrellas — paleta por nivel, borde brillante para legibilidad |
| Enemigos (24 tipos: 8 por nivel) | Placeholder propio → hoja del usuario | Sprites 48–64 px, 2–3 frames idle + telegraph, silueta clara |
| 3 jefes (Orc Hero, Dark Lord, Baphomet) + mid-bosses | Placeholder propio → hoja del usuario | Sprites grandes 128–192 px, idle + ataque + fase dañada |
| Decoración de fondos (3 sets) | Placeholder propio → hoja del usuario (opcional) | Árboles, casas, cercas, rocas, estatuas, antorchas; tiles de camino/agua; 32–96 px |
| Items y cofres | Crear (procedural) | Zeny, gema, pociones, cofre (cerrado/abierto/mimic), hoja de Yggdrasil, cartas de monstruo (marco + mini-retrato) |
| Retratos de diálogo | Recorte del idle → opcional hoja del usuario | Busto ~128 px por personaje y jefe para los diálogos pre-jefe |
| Fondos (3 niveles) | Crear | Tiles/capas con parallax vertical, 3–4 biomas por nivel con transiciones, tinte de luz y clima (sección 6.1) |
| UI | Crear | HUD (vidas, bombas, medidor, score, esferas de Viri), retratos, pantalla de selección con los 6, banners estilo RO (como los del sheet) |
| SFX | Sintetizar con Web Audio | Disparo, hit, muerte, bomba, item, voz de spell card |
| Música | Secuenciador chiptune propio | 1 tema por nivel + tema de jefe + menú (inspiración: BGM de Prontera/Geffen/Glast Heim) |

### Estrategia: placeholder primero, swap después
Todos los sprites se cargan vía un **manifiesto de atlas** (`assets/manifest.json`: tipo de entidad → archivo + coordenadas de frames + anchor). El código nunca referencia PNGs directamente, así que reemplazar un placeholder por arte final es editar el manifiesto — cero cambios de código. Los monstruos arrancan con placeholders creados en el proyecto (chibi simple, silueta y paleta correctas) para no bloquear ninguna iteración.

**Assets de personajes — completo (2026-07-05):** `Character assets full.png` reemplazó a la hoja original y añade las 7 poses UP (vista de espalda) por personaje. El juego orienta al personaje según su movimiento: sube → vista de espalda (upIdle/upMoveL/upMoveR), baja o quieto → vista de frente (idle/moveL/moveR). El slicer extrae 14 poses + proyectiles + banner por personaje.

**Especificación para las hojas de referencia del usuario** (mismo formato que `character assets.png`, fondo transparente de verdad — el actual traía el tablero horneado y hubo que removerlo):
- **Enemigos regulares** (~48–64 px, 8 por nivel — ver listas de la sección 5): mínimo 1 frame idle; ideal 2 de idle + 1 de "telegraph" (a punto de disparar). Un frame de muerte es bienvenido pero las partículas lo cubren.
- **Jefes** (128–192 px): idle (2 frames), ataque, y opcional pose "enfurecido" para la última spell card. Prioridad: **Orc Hero, Dark Lord, Baphomet**.
- **Mid-bosses** (~96–128 px): Mastering, Doppelganger, Baphomet Jr. gigante.
- **Decoración de fondos** (opcional — puedo generarla): árboles/casas/cercas (nivel 1), estanterías/cristales (nivel 2), estatuas/ruinas (nivel 3), en tamaños 32–96 px.
- **Retratos** (opcional): busto ~128 px de los 6 personajes y los 3 jefes para los diálogos.
- Grid regular o espaciado uniforme para recorte automático; etiquetas de texto fuera de las celdas de sprites.

## 8. Iteraciones (roadmap)

### Iteración 0 — Fundación ✅ *(completada 2026-07-05)*
- Setup de Vite + PixiJS, estructura del proyecto, escenas, input teclado.
- **Simulación determinista desde el arranque:** timestep fijo a 60 ticks/s, RNG con semilla, estado avanza solo por inputs por tick. Es la base del online — retrofitearlo después sería reescribir el motor.
- Recorte del sprite sheet a atlas.
- **Jugable:** Aramir se mueve y dispara contra Porings de prueba en un fondo simple. Colisiones + pooling funcionando.

> **Avance extra (2026-07-05):** pantalla de título "Ragnarok Bullet Hell", selección de personaje con los 6 del roster, panel lateral estilo RO (retrato, banner, score, vidas, skills con teclas, stats) y kits básicos jugables para las 6 clases (disparo normal + foco con su propio proyectil y perfil de movimiento). Las bombas y especiales siguen para la Iteración 2.

### Iteración 1 — Núcleo bullet hell ✅ *(completada 2026-07-05)*
- Sistema de patrones de balas (emisores parametrizados: anillos, abanicos, aimed con jitter; espirales llegarán con los jefes).
- Hitbox pequeño, foco, vidas, bombas (L, 3 por vida, limpian pantalla y dan puntos), i-frames, graze (+10 pts y contador), drops (Zeny/Blue Gemstone/Red Potion) con niveles de poder que amplían el disparo de las 6 clases.
- 4 tipos de enemigo con comportamientos distintos (Poring, Lunatic con anillos, Fabre con abanicos aimed, Drops kamikaze) en oleadas endless con rampa de dificultad, game over con overlay.
- **Jugable:** loop completo de sobrevivir oleadas con cualquiera de las 6 clases.

### Iteración 2 — Los 6 personajes + co-op local ✅ *(completada 2026-07-05)*
- Kits completos: bombas temáticas (Bowling Bash en anillo, Meteor Assault con veneno, Storm Gust congela, Magnus Exorcismus campo persistente, Arrow Storm global, Asura Strike escalando con esferas) y especiales con medidor cargado por graze/kills (Quicken, Cloaking, Meteor Storm, Sanctuary, Falcon Assault, Steel Body).
- Co-op local: P2 se une en la selección (flechas + Numpad), sidebar dual compacto, jugadores caídos y revivir con Yggdrasil Leaf; gamepads (pad 0 → P1, pad 1 → P2).
- Quick wins: imán de items + línea de auto-recolección (POC), cofres con mimic 1/8, telegraph en enemigos (pulso antes de disparar), puntos flotantes, barra de progreso proto.
- **Jugable:** 2 jugadores locales con cualquier combinación de clases.

### Iteración 3 — Nivel 1 completo + mundo vivo ✅ *(completada 2026-07-05)*
- Estructura de nivel real (máquina de fases): campos → camino → aldea orc → mid-boss → aproximación → jefe → resultados.
- 8 enemigos con comportamiento propio (Poring, Picky en bandada, Chonchon que embiste, Pupa que explota en anillo al morir, Fabre, Lunatic, Orc Baby, Drops) + mid-boss **Mastering** (poring gigante coronado que escupe porings y anillos).
- **Orc Hero** con 3 spell cards (Grito de Guerra: anillos con hueco; Hacha Tormenta: hachas que rebotan; Carga del Héroe: embestida + lluvia de lanzas), barra de vida con segmentos por fase y nombre de spell card, muerte con slow-motion.
- **Fondo vivo Prontera → Aldea Orc:** parallax multicapa con crossfade de 3 biomas, decoración en bandas laterales (árboles, casas, cercas → tiendas y tótems orcos), tinte de luz que evoluciona, motas ambientales.
- Barra de progreso con marcadores de mid-boss y jefe, banners de ¡ALERTA!/¡JEFE!/spell card, diálogo pre-jefe con retratos (18 líneas por jefe, una por clase), pantalla de resultados con medalla S/A/B/C y estadísticas.
- SFX sintetizados con Web Audio (kill, graze, item, cofre, bomba, muerte, warning, spell card, jefe derrotado, fanfarria de nivel).
- **Jugable:** Nivel 1 de inicio a fin con score final y ranking.

### Iteración 4 — Niveles 2 y 3 ✅ *(completada 2026-07-05)*
- 16 enemigos nuevos (Nivel 2: Willow, Zombie que revive, Munak, Bongun, Nine Tails, Deviruchi, Marionette, Wraith que teleporta; Nivel 3: Evil Druid, Dark Priest, Raydric con muro de lanzas, Khalitzburg, Gargoyle, Ghoul, Whisper intangible salvo al disparar, Baphomet Jr.).
- Mid-bosses: **Doppelganger** (refleja la posición del jugador) y **Baphomet Jr. gigante**. Jefes **Dark Lord** (Meteor Storm, Hell Judgement, Tinieblas Eternas) y **Baphomet** (Guadaña Dimensional, Invocación Demoníaca que convoca minions, Juicio Final con fase de desesperación).
- Fondos vivos temáticos (sistema de temas parametrizado): Torre de Geffen → Geffenia (mármol arcano, runas, cristales) y Glast Heim (piedra agrietada, estatuas, antorchas, **lluvia + relámpagos**).
- **Campaña encadenada de 3 niveles** con arrastre de vidas/bombas/power/score entre niveles, pantalla de resultados por nivel y **victoria final** con rango.
- Cartas de monstruo coleccionables (drop ~1.5%, con bonus) y potenciadores temporales (Awakening = cadencia, Speed = velocidad, Guardia Kafra = escudo de 1 golpe) de los cofres.
- **Jugable:** campaña completa de 3 niveles de inicio a fin.

### Iteración 5 — Pulido y memorabilidad ✅ *(completada 2026-07-05)*
- **Música chiptune** con secuenciador propio (Web Audio): temas de menú, 3 niveles, jefe y victoria; el tema de jefe sube de tempo (tensión) en la última spell card.
- **SFX con identidad por clase** (blip de disparo distinto por personaje) + set completo de efectos (kill, graze, item, cofre, bomba, muerte, warning, spell card, jefe, fanfarria).
- **Los 18 mini-diálogos** personaje×jefe completos (Orc Hero, Dark Lord, Baphomet).
- **Modo práctica de jefes** (elegir personaje + jefe y pelear directo), **records locales** con iniciales arcade (localStorage) y pantalla de récords, **cameo de Kafra** en el título.
- **Dificultades Novice/Normal/Nightmare** (velocidad de balas, vidas y multiplicador de score) seleccionables en el título.
- Juice: **screen shake**, **hit-stop**, corazones que laten con 1 vida, fundido de entrada de escena.
- **Pendiente menor:** balance fino por clase queda para ajuste continuo con playtesting.

### Iteración de arte — Prontera real (2026-07-07) ✅
- **Fondo real del Nivel 1:** reemplazado el fondo procedural plano por 5 mapas reales de Ragnarok (`Maps/prontera00{1..5}.png`) que hacen scroll continuo de los campos → puerta de la muralla → avenida real → **plaza central de Prontera** (arena del jefe). Nuevo `MapBackground` con wash oscuro para legibilidad del danmaku.
- **Sprites reales de mobs:** los 5 monstruos del Nivel 1 (Poring, Pupa, Picky, Chonchon, Orc Baby) usan la hoja animada real (`monsters/Prontera Monsters 001.png`) con poses DOWN/UP (idle, move L/R, hit, attack); animan por facing y estado. Slicer robusto (`tools/slice-monsters.mjs`) que quita el checker por componentes conexas y detecta filas de sprites por conteo de columnas.
- Nivel 1 re-tematizado a "Campos de Prontera → Plaza de Prontera" (orcos invaden la ciudad); usa **solo** sprites reales para coherencia visual.
- **Mastering y Lunatic reales (2026-07-07):** segunda hoja (`monsters/Prontera Mastering Lunatic.png`) → `monsters2.{png,json}`. El slicer ahora procesa varias hojas (función `processSheet`) y el atlas las fusiona. El mid-boss Mastering usa el poring coronado real (antes blob) y el Lunatic (conejo) volvió al Nivel 1 como enemigo de anillos con su sprite real.
- **Mapa real del Nivel 2 (2026-07-07):** 5 mapas de mazmorra de Geffen (`Maps/geffen00{1..5}.png`) hacen scroll del vestíbulo → corredor → cripta → cementerio → **arena circular** (santuario de Geffenia) donde pelea el Dark Lord. Carga de mapas generalizada por conjunto (`atlas.maps[set]`), cada nivel declara su `mapSet`. Nivel 2 re-tematizado a "Mazmorra de Geffen → Geffenia".
- **Mobs reales del Nivel 2 (2026-07-07):** hoja de los 8 mobs de Geffen (`monsters/Geffen monsters 001.png`, grid 4×2) → `monsters3.{png,json}`. Willow, Zombie, Munak, Bongun, Nine Tails, Deviruchi, Marionette y Wraith ya usan sprites reales animados. El slicer se robusteció (umbral de banda 90, altura mínima 36) para separar bandas con decoraciones que las puenteaban (cuerdas de la marioneta) y filas de sprites cortas (deviruchi).
- **Mobs reales del Nivel 3 (2026-07-08):** hoja de los 8 mobs de Glast Heim (`monsters/Glast heim monsters.png`) → `monsters4.{png,json}`. Evil Druid, Dark Priest, Raydric, Khalitzburg, Gargoyle, Ghoul, Whisper y Baphomet Jr. ya usan sprites reales. Slicer con tope de altura de banda (≤130) para rechazar fusiones banner/efecto en esta hoja de banners ornamentados. Total: **23 mobs reales**.
- **Música real (2026-07-08):** `music/Prontera map 001.mp3` y `music/Geffen map 001.mp3` → `public/assets/music/{prontera,geffen}.mp3`. El motor de música reproduce mp3 en los niveles 1 y 2 (incluida su pelea de jefe) y mantiene el chiptune para menú, nivel 3, jefe(nivel3) y victoria.
- **Jefes reales + menú ilustrado (2026-07-08):**
  - **Pantalla de título:** reemplazada por la ilustración `Images/Start Menu.png` (logo + personajes + monstruos), con overlays interactivos alineados al arte: resaltado móvil sobre las opciones horneadas (JUGAR/PRÁCTICA/RÉCORDS) y línea de dificultad viva que cubre la horneada sin costura (fondo `0x01021a`).
  - **3 jefes principales** (Orc Hero, Dark Lord, Baphomet) con sprites reales desde `monsters/Bosses.png`. Slicer dedicado (`tools/slice-bosses.mjs`) para el layout transpuesto: centros de fila medidos de las etiquetas + división de 3 columnas de frames, extrae el frame idle/attack por pose. El render de jefe usa idle normal y attack en transición de fase.
- **Pendiente arte:** mapa del Nivel 3 (Glast Heim); mid-bosses **Doppelganger** (sigue procedural) y **Baphomet Jr. gigante** (usa el sprite real de bapho_jr escalado) — sus paneles en `Bosses.png` tienen layout irregular de 9 filas; quedan para un pase posterior.

### Estado del proyecto (2026-07-07)
Iteraciones 0–5 completas + arte real de Prontera en el Nivel 1. El juego es una campaña jugable completa y con el primer nivel ya con look final. Resta la **Iteración 6 (co-op online)** y el arte real de niveles 2–3 / jefes cuando lleguen sus hojas.

### Iteración 6 — Co-op online *(IMPLEMENTADA 2026-07-09)*
- ✅ Servidor relay Node.js (`ws`, `server/relay.js`): salas con código de 4 letras, asignación de slot (0 host / 1 guest), reenvío verbatim de mensajes entre peers, manejo de desconexión (`peerleft`). No simula nada.
- ✅ Cliente de red (`src/net/netclient.js`): host/join, lobby (personaje + ready), start host-autoritativo (personajes + dificultad), transporte inyectable (navegador + Node). Bufferiza frames de juego que llegan antes de que el driver se suscriba (arregla la carrera de los inputs semilla).
- ✅ Netcode lockstep (`src/net/lockstep.js`): delay fijo de 3 ticks, avanza el sim solo con ambos inputs presentes, checksum de estado cada 30 ticks para detectar desync, `epoch` por nivel para aislar sesiones.
- ✅ UI: entrada 🌐 CO-OP ONLINE en el título (overlay), escena de lobby (`src/scenes/online.js`), `GameScene` en modo online con badge de espera y auto-avance de nivel.
- ✅ Verificado end-to-end (navegador host vs guest headless): 400+ ticks en lockstep, checksums idénticos, sin desync; offline sin regresión.
- ⏳ **Pendiente:** deploy del relay a **Railway** (necesita cuenta del usuario) para jugar entre PCs distintas; cliente estático a GitHub Pages / Railway. Ver `server/README.md`.

## 9. Riesgos y decisiones abiertas

1. **Rendimiento con 2P + miles de balas** → pooling y spatial hash desde Iteración 0 + ParticleContainer de PixiJS para las balas; los filtros de bloom se aplican por capa (no por sprite) para no matar el frame rate.
2. **Legibilidad en co-op** (2 sprites + balas propias + balas enemigas) → balas enemigas siempre con paleta cálida/brillante y glow, balas de jugador semitransparentes.
3. **Balance de 6 kits distintos** → se ajusta jugando; stats centralizados en un solo archivo de config por clase.
4. **Determinismo real en JS** → prohibido usar `Math.random()`/`Date.now()` dentro de la simulación (solo el RNG con semilla y el contador de ticks); checksums periódicos del estado en las partidas online para detectar desyncs temprano.
5. **Latencia en lockstep** → el input propio se retrasa 2–4 ticks (33–66 ms), imperceptible en co-op PvE con buena conexión regional; si molestara, el plan B es rollback (más complejo) o host-authoritative con predicción local.
6. **Costo de hosting** → el relay es un proceso Node diminuto (solo reenvía bytes); el plan Hobby de Railway (~$5/mes) sobra. El cliente es estático y puede vivir gratis en GitHub Pages.
7. **Nombre del juego** → decidido: **"Ragnarok Bullet Hell"** (título en pantalla desde la Iteración 1).
