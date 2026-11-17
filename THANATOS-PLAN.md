# Nivel 8 — Torre de Thanatos (plan de la etapa final)

> Estado al 2026-11-16, sobre `main` @ `875069f`:
> - **Hecho:**
>   - **Fases 0 a 2:** prueba de Codex, referencias, y las 6 imágenes generadas y aprobadas.
>   - **Fase 4:** `tools/slice-thanatos.py` genera `public/assets-v2/thanatos/`, pasa todos los gates y es determinista. Las hojas de contacto están aprobadas.
>   - **Fases 5 y 6:** motor y gameplay.
>     - `src/sim/thanatos.js` tiene a Thanatos (7 cartas, 2 formas, supervivencia de 30 s), los fragmentos y los ecos.
>     - `src/levels/level8.js` tiene los 8 mobs y las fases del nivel.
>     - Se cablearon el atlas, los mapas, el render (forma por carta, ecos, curación y teletransporte), la barra del jefe con reloj, la práctica (en dos filas), los diálogos, la semilla y un chiptune provisorio.
>   - **Tests:** 61/61 estáticos (8 nuevos para el nivel 8), 10/10 de blockers y netplay en lockstep. Se verificó en el navegador: oleadas, fragmentos, Thanatos, ecos, transformación y menú de práctica.
>   - **Fase 3, música:** `Music/Thanatos Tower 001.mp3` (Suno, 3:24) está encodeado a `public/assets/music/thanatos.mp3` (128 kbps, 3,43 MB) y conectado como `MP3_TRACKS.level8`. El chiptune queda como respaldo si el archivo falta.
> - **Pendiente:**
>   - La fase 7: balance jugando de verdad.
>   - La fase 8: README, MASTERPLAN y commit.
> Los prompts listos para usar están en [`art-clean/thanatos-gpt/prompts/`](art-clean/thanatos-gpt/prompts/).

## 1. Concepto

La expedición llega a la Torre de Thanatos, en Hugel. Es el último nivel de la campaña y la torre **va con todo**: más enemigos élite, menos respiro entre oleadas, un mid-boss doble en dos tandas y un jefe final de **6 spell cards en dos formas**, con una carta de supervivencia y ecos de los MVP que los aventureros ya derrotaron.

"Va con todo" no significa injusto. Cada patrón conserva las reglas de la casa:
- telegrafía antes de disparar (`e.tele` / `b.tele`);
- deja un carril seguro legible;
- los élite tienen tope de concurrencia;
- ningún tirador dispara en todos los ticks.

La dificultad sube por **densidad, duración y combinación de patrones**, no por balas imposibles de ver.

**Recorrido vertical**, de abajo hacia arriba (`biome` 0 → 1):

Las zonas siguen los pisos reales de la torre en RO (verificados en Divine Pride, `tha_t01`–`tha_t12` y `thana_boss`):

| Tile | Zona | Piso real | Qué se ve |
|---|---|---|---|
| `thanatos001` | Entrada del Museo | tha_t01 | Acantilado de Hugel, puerta sellada, vestíbulo con vitrinas |
| `thanatos002` | Museo | tha_t02 | Salones de piedra antigua, vitrinas y cofres, estatuas rotas |
| `thanatos003` | Espacio Abandonado | tha_t03–04 | Salas derruidas, libros caídos, cristales azul-violeta |
| `thanatos004` | Sala de los Ángeles | tha_t07–08 | Arena circular con 4 sellos: mid-boss **Fragmentos** |
| `thanatos005` | Salas de la Angustia y la Tristeza | tha_t09–10 | Escaleras rotas sobre el vacío, cadenas, plataformas |
| `thanatos006` | Salas de la Desesperación y el Odio | tha_t11–12 | Pasarela estrecha, campo de estrellas a los lados |
| `thanatos007` | Área Desconocida | thana_boss | Arena circular, halo roto gigante: **Thanatos** |

## 2. Elenco

> Elenco **verificado** el 2026-11-16 contra Divine Pride (mapas `tha_t01`–`tha_t12`). La primera versión de este plan nombraba a Isilla, Vanberk, Hodremlin y Seeker, que no aparecen en la torre, y abreviaba los nombres de las cuatro damas ángel. Se reemplazaron por los monstruos reales, manteniendo los mismos roles.

### Mobs comunes (8, en dos hojas de 4)

**Hoja A — las cuatro damas ángel de la Sala de los Ángeles** (`monsters13`):

| Monstruo (ID) | Rol | Comportamiento (determinista, con telegrafía) |
|---|---|---|
| **Dame of Sentinel** (1700) | Francotiradora | Se estaciona en un borde. Marca una línea de mira (`tele` 30) y dispara una ráfaga rápida de 5 balas en esa línea. Tope de 3. |
| **Baroness of Retribution** (1702) | Embestida | Fija la x del jugador, telegrafía y cae en picada. Al frenar, abanico de 5. Tope de 2. |
| **Mistress of Shelter** (1701) | Tanque | Lenta y con mucha vida. Anillo con hueco rotativo; el hueco es el carril. Tope de 2. |
| **Lady Solace** (1703) | Sanadora | **Cura a los enemigos cercanos** cada 120 ticks (mecánica nueva). Hay que matarla primero. Abanicos escasos. Tope de 2. |

**Hoja B — las salas de las emociones, pisos 9 a 12** (`monsters14`):

| Monstruo (ID) | Rol | Comportamiento |
|---|---|---|
| **Book of Death** (20780) | Hechicero | Espiral de 2 brazos con ventana de recuperación, más balas lentas que estallan en anillo pequeño. |
| **Anger of Thanatos** (20775) | Berserker | Zigzag rápido hacia abajo, abanicos cortos y frecuentes. Poca vida. |
| **Void Mimic** (20779) | Emboscada | Cae como un **cofre falso** (reusa la lectura de los mimics de los cofres) y se **teletransporta** (`tele` 24 en el destino, posición desde `sim.rng`), soltando un anillo al aparecer. Tope de 2. |
| **Crow Duke** (20782) | Cazador | Flota a media altura; ráfagas apuntadas en 3 tiempos con *jitter* pequeño. |

**Escalado:** la vida de los mobs va +15–20 % sobre Niflheim (Lude 24 → ~28 … Murderer 95 → ~110). La cadencia sube un 10 % y los topes de élite se mantienen.

### Mid-boss — Fragmentos de Thanatos (`bosses6`)

IDs: Odium 1704, Despero 1705, Maero 1706, Dolor 1707. En RO los cuatro aparecen juntos en `tha_t08`, la Sala de los Ángeles. Los cuatro fragmentos del alma de Thanatos aparecen **en dos parejas** en la Sala del Sello: primero **Odium + Despero**, después **Maero + Dolor**. Son élite inline como Loli Ruri: aviso, salida bloqueada hasta matarlos y cofre al morir. La pareja 2 entra cuando cae la 1.

| Fragmento | Emoción | Firma |
|---|---|---|
| Odium | Odio | Bestia de humo negro con máscara blanca. Ráfagas rojas apuntadas, agresivo y móvil. |
| Despero | Desesperación | Espectro de llamas naranjas. Espirales naranjas cruzadas. |
| Maero | Pena | Fantasma oscuro con máscara de calavera y vetas rojas. Lluvia púrpura lenta y densa, con carriles. |
| Dolor | Dolor | Criatura pequeña encapuchada con máscara. Anillos cian con hueco que respiran. |

Los colores de bala siguen ahora el aspecto real de cada fragmento en sus sprites de RO.

- **Vida:** 4 × 600 = 2400 en total (Loli Ruri tenía 750).
- **Simetría:** cada pareja es simétrica, como el duelo Seyren/Magaleta. Matar primero a uno o al otro se siente igual.

### Jefe final — Thanatos (`bosses7`, dos formas)

Es la ID 1708: en iRO se llama "Memory of Thanatos" y en Divine Pride "Thanatos Phantom". Aparece en `thana_boss`, el Área Desconocida.

**Aspecto (según su sprite de RO):** un héroe guerrero caído, de pelo plateado, con armadura de hueso adornada con calaveras y cadenas, capa carmesí y un garrote con calavera al hombro. No es un ángel.
- **Forma II:** la misma figura desatada. La armadura se agrieta y deja salir luz blanco-violeta, la capa se vuelve jirones ardientes, el arma estalla en energía violeta y lleva fundidas las cuatro máscaras de los fragmentos.

**Vida total de cartas: 10 500**, o sea **3,3× Lord of Death** (3200) y **3,4× Amon-Ra** (3050). Cumple el "al menos 3 veces". En co-op se multiplica por 1,7, igual que el resto.

| # | Forma | Carta | Vida | Idea |
|---|---|---|---|---|
| 1 | I · Memoria | **Juicio del Guardián** | 1400 | Anillos con hueco amplio y abanicos de espada. Calentamiento legible. |
| 2 | I · Memoria | **Odio y Desesperación** | 1500 | Canaliza a los fragmentos y alterna cada 240 ticks entre ráfagas rojas (Odium) y lluvia púrpura con carriles (Despero). |
| 3 | I · Memoria | **Memorias de Midgard** | 1700 | Invoca **ecos** de Orc Hero, Baphomet y Lord of Death: sprites originales teñidos de violeta y semitransparentes. Cada eco dispara su patrón firma durante ~4 s y se disuelve. Thanatos mantiene presión ligera. |
| — | transformación | *(evento `bossForm`)* | — | Limpia la pantalla, flash, línea de diálogo. El sprite pasa a la Forma II. |
| ★ | II · Despierto | **El Fin de la Memoria** *(supervivencia)* | — | **Carta de tiempo:** 30 s invulnerable, sobrevivir y ya. Muros laterales de lluvia que avanzan y se retiran, y una espiral central. |
| 4 | II · Despierto | **Pena y Dolor** | 1800 | Espirales espejo cian y naranja, con Thanatos en movimiento. |
| 5 | II · Despierto | **Réquiem de la Torre** | 2000 | La carta más densa: espiral, anillo con hueco hacia el jugador y lluvia. Bajo 35 %, abanicos de desesperación. |
| 6 | II · Despierto | **Último Aliento** | 2100 | Escala en 3 etapas según la vida de la carta (100–66 / 66–33 / 33–0). Bajo el 15 %, ráfaga final con ventana de respiro garantizada. |

**Duración estimada en solo:** 10 500 / ~65 de DPS ≈ 160 s de pelea, más 30 s de supervivencia y las transiciones: **~3,5 min**. La pelea más larga del juego, como corresponde.

## 3. Trabajo de motor (lo que hoy no existe)

Todo dentro de la sim determinista (`sim.rng` y ticks, nada de `Math.random`):

1. **Forma por carta.** Agregar un campo opcional `card.form` en la definición. `renderer.syncBoss` usa `card.form ?? BOSS_TEX[b.name]` como clave del sprite. Así una sola entidad boss cambia de Forma I a II sin reaparecer.
2. **Carta de supervivencia.** Agregar `card.survive = N` (ticks). Mientras dura, `damageBoss` no resta vida y la carta termina por tiempo. La barra (`src/ui/bossbar.js`) muestra un temporizador en lugar de vida. La vida total del jefe excluye esta carta.
3. **Evento `bossForm`.** Lo emite la transición de la carta 3 a la ★. El `GameScene` hace flash, *shake* y una línea de diálogo corta. La transición dura 150 ticks en vez de 70.
4. **Ecos de jefes.** Son enemigos con `echo: 'baphomet'` (u otro). El renderer los dibuja con la textura del atlas de jefes, tinte violeta y `alpha` 0,6. Tienen poca vida y se disuelven solos. Reusan los sprites existentes: no hace falta arte nuevo.
5. **Curación de Lady Solace.** En su `shoot`, recorre `sim.enemies.active` dentro de un radio y suma vida hasta `maxhp`. Agrega un evento visual `heal`.
6. **Teletransporte de Void Mimic.** Telegrafía en el destino y cambia de posición en un tick fijo.
7. **Color de bala `white`** (opcional): núcleo blanco con borde violeta para la Forma II. Validar contra ítems y fondo con la misma prueba de contraste de `1f18431`. Si no pasa, se queda con la paleta actual.

## 4. Producción de arte con la CLI de Codex

La CLI está instalada (`codex-cli 0.169.0`) y tiene la generación de imágenes activada (`image_generation stable true`). Los niveles 6 y 7 se hicieron con `gpt-image-2-medium`. Se mantiene el mismo contrato de estilo para que la Torre combine con Pirámide y Niflheim.

### 4.0 Prueba de humo (antes de todo)
Una generación chica para confirmar tres cosas:
- **dónde guarda la imagen** Codex y si respeta una ruta de salida pedida en el prompt;
- **qué tamaños acepta**: los anteriores salieron en 793×1983, 1536×1024 y 1774×887;
- que **`-i`** adjunta bien las imágenes de referencia.

### 4.1 Referencias (solo identidad visual)
Juntar en `art-clean/thanatos-gpt/references/`:
- sprites de RO de los 8 mobs, los 4 fragmentos y Memory of Thanatos (Spriters Resource);
- los mapas de Thanatos Tower (Divine Pride).

Mismo criterio de procedencia que Niflheim: son referencias para investigar la identidad visual, no assets de runtime.

**Referencias de estilo** (siempre adjuntas): las hojas aprobadas de Niflheim, `art-clean/niflheim-gpt/niflheim-*-gpt-image-2-medium-v1.png`.

### 4.2 Las 6 imágenes
| # | Archivo de salida | Tamaño | Prompt |
|---|---|---|---|
| 1 | `thanatos-map-v1.png` | 793×1983 | `prompts/PROMPT-map-v1.txt` |
| 2 | `thanatos-mobs-lower-v1.png` | 1536×1024 | `prompts/PROMPT-mobs-lower-v1.txt` |
| 3 | `thanatos-mobs-upper-v1.png` | 1536×1024 | `prompts/PROMPT-mobs-upper-v1.txt` |
| 4 | `thanatos-fragments-v1.png` | 1536×1024 | `prompts/PROMPT-fragments-v1.txt` |
| 5 | `thanatos-boss-form1-v1.png` | 1536×1024 | `prompts/PROMPT-boss-form1-v1.txt` |
| 6 | `thanatos-boss-form2-v1.png` | 1536×1024 | `prompts/PROMPT-boss-form2-v1.txt` |

**Por qué Thanatos va en una imagen por forma:** es el clímax del juego. Con una hoja propia, cada pose sale con más píxeles y detalle que compartiendo media hoja, como pasó con Lord of Death.

**Forma del comando** (se ajusta después de la prueba de humo):
```bash
codex exec -s workspace-write \
  -i art-clean/niflheim-gpt/niflheim-bosses-gpt-image-2-medium-v1.png \
  -i art-clean/thanatos-gpt/references/memory-of-thanatos-ro.png \
  "$(cat art-clean/thanatos-gpt/prompts/PROMPT-boss-form1-v1.txt)"
```

### 4.3 Revisión y aprobación (tú decides)
- Cada imagen se revisa antes de seguir. Si algo falla (identidad, poses fusionadas, fondo no uniforme, texto colado), se genera una `v2` con el prompt corregido. **Nunca se edita una fuente aprobada**: son inmutables, igual que en Niflheim.
- Queda un registro `thanatos-gpt-image.prompt.md` con modelo, tamaños, referencias y procedencia.

### 4.4 Recorte determinista
- Nuevo `tools/slice-thanatos.py`, clonado de `slice-niflheim.py`: solo librería estándar, mismos *gates*, dos corridas con sha256 idéntico.
- Los paneles semánticos se miden **después** de aprobar cada hoja.
- Salidas en `public/assets-v2/thanatos/`:
  - `monsters13.png/json`: mobs inferiores;
  - `monsters14.png/json`: mobs superiores;
  - `monsters15.json`: fragmentos como élite, con los rects dentro de `bosses6.png`;
  - `bosses6.png/json`: fragmentos para práctica;
  - `bosses7.png/json`: Thanatos, con las claves `thanatos` (Forma I) y `thanatosAwake` (Forma II);
  - `maps/thanatos001..007.png`.
- Las hojas de contacto de QA van a `art-clean/thanatos-gpt/qa/`, y se revisan en el Art Lab (`?artlab=1`).

## 5. Música (Suno)

- **Archivo maestro:** `Music/Thanatos Tower 001.mp3`.
- **Integración:**
  - mapping en `tools/encode-music.mjs` (`'Thanatos Tower 001.mp3': 'thanatos.mp3'`) y `npm run music`, que necesita ffmpeg;
  - en `music.js`, `level8: thanatos.mp3` más un *fallback* chiptune;
  - el tema se mantiene durante el jefe, como en Pirámide y Niflheim.
- **Prompt:** está en la sección 9 de este documento.

## 6. Integración en el código

| Archivo | Cambio |
|---|---|
| `src/levels/level8.js` | Script nuevo. Fases: `base` → `lower` → `archive` → `midboss` (2 parejas) → `upper` → `bridge` → `approach` → `boss`. Unos ~9000 ticks de oleadas, contra ~6800 en Niflheim. Antes de Thanatos cae una poción y un cofre garantizados: la torre aprieta, pero el jugador llega con recursos. |
| `src/levels/index.js` | Entrada 8: `mapSet: 'thanatos'`, `midProgress: 0.5`, `biomeNames` según la tabla de la sección 1. |
| `src/sim/boss.js` | `thanatos` (6 cartas más la de supervivencia), helpers de los fragmentos (como `loliP1..3`), defs de práctica de los fragmentos, soporte de `form`, `survive` y `bossForm`. |
| `src/render/renderer.js` | Clave de sprite por forma, render de ecos (tinte y alpha), efecto `heal`. |
| `src/ui/bossbar.js` | Temporizador en la carta de supervivencia. |
| `src/engine/atlas.js` · `mapsets.js` | Árbol `assets-v2/thanatos`, `addMonsters` y `addBosses` tolerantes a nulos, set de 7 tiles. |
| `src/render/themes.js` | `level8Theme` procedural de respaldo (piedra fría, violeta, estrellas). |
| `src/data/dialogue.js` | Thanatos × 6 personajes, línea de transformación y frases de los fragmentos para el aviso. |
| `src/scenes/practice.js` | Thanatos y las dos parejas de fragmentos. |
| `src/scenes/game.js` | `LEVEL_SEEDS[7]`, manejo de `bossForm`. Thanatos pasa a ser el final de forma automática (`isFinal`). |
| `src/scenes/levelselect.js` | Nada: con 8 cartas el ancho queda en 94 px (mínimo 80). Se corrige el comentario que dice "seven" y se actualiza el test de *bounds*. |
| Victoria | Epílogo propio para el final de la Torre (texto). |

## 7. Tests (extensión de `server/test-static.mjs`)

- Registro: el nivel 8 está en `LEVELS`, en práctica, en el tema y en el atlas, y es el final de la campaña.
- **Vida:** `sum(thanatos.cards.hp) >= 3 * sum(lordOfDeath.cards.hp)`, y lo mismo contra Amon-Ra. Es un guard explícito del requisito.
- Thanatos: aparece → recorre las 6 cartas más la de supervivencia → `levelClear`. La supervivencia ignora el daño y termina por tiempo. `form` cambia en la carta ★.
- Línea de tiempo de `level8`: bordes de fase, topes de élite, las dos parejas de fragmentos bloquean la salida.
- *Replay checksum*: dos sims, mismo checksum. Run completo con posiciones finitas.
- Assets: manifests, IDs, matte residual (la sección 16 ya recorre las hojas V2; se agregan las 5 nuevas).
- Música: `thanatos.mp3` encodeado y regenerable.
- Online: el test de netplay existente cubre el lockstep. Hay que agregar una corrida de 600 ticks arrancando en el nivel 8.

> Recordatorio: en esta PC `test-static.mjs` puede colgarse **después** del PASS (Node 26). Se corre con `timeout 60`.

## 8. Orden de trabajo y puntos de control

| Fase | Qué | Quién | Control |
|---|---|---|---|
| 0 | Prueba de humo de Codex y carpetas | Claude | Ruta y tamaño confirmados |
| 1 | Referencias de RO | Claude (te muestra lo que baja) | Identidades confirmadas |
| 2 | Generar las 6 imágenes con Codex | Claude | **Apruebas cada imagen** |
| 3 | Música en Suno | **Tú** | Dejas el mp3 en `Music/` |
| 4 | Slicer, QA y Art Lab | Claude | **Apruebas las hojas de contacto** |
| 5 | Motor (forma, supervivencia, ecos, curación, teletransporte) | Claude | Tests verdes |
| 6 | `level8`, Thanatos, fragmentos, diálogos, práctica | Claude | Tests verdes y capturas |
| 7 | Balance: playtest en Novice, Normal y Nightmare, solo y co-op | Tú + Claude | Thanatos vencible en Normal sin bombas de sobra |
| 8 | README, MASTERPLAN (arreglar el estado desactualizado), commit y push | Claude | Deploy en Pages |

Las fases 3 y 4–6 pueden ir en paralelo: la música no bloquea el código, porque mientras falta el mp3 suena el *fallback* chiptune.

## 9. Prompt para Suno

**Title:** `Thanatos Tower 001`

**Style of Music** (pegar tal cual):
```
epic dark symphonic metal, final dungeon boss theme, JRPG climax, bullet hell shmup, 168 BPM, D minor, phrygian dominant, driving double-kick drums, chugging low-tuned distorted guitars, gothic pipe organ, huge Latin-style wordless choir, tolling cathedral bells, celestial music-box and glockenspiel motif, harpsichord arpeggios, staccato string ostinato, brass stabs, taiko hits, relentless and tragic, heroic yet desperate, cinematic, high energy, loopable, instrumental
```

**Exclude Styles:**
```
lyrics, rap, pop vocals, lo-fi, acoustic, country, EDM drop, dubstep, jazz, happy, calm
```

**Lyrics** (con *Instrumental* activado no hace falta; si el modo personalizado igual pide estructura, pegar esto como etiquetas sin letra):
```
[Intro: slow tolling bells, lonely music-box melody, distant wordless choir, rising tension]
[Build: pipe organ swells, staccato strings, timpani roll]
[Main Theme: full band enters, double-kick drums, distorted guitars, choir chants the main motif]
[Variation: harpsichord arpeggios trade the melody with lead guitar, brass stabs]
[Breakdown: half-time, heavy guitars, bells and organ, ominous]
[Climax: key change up, full choir and orchestra, fastest drums, triumphant but desperate]
[Bridge: music-box motif returns alone over a dark drone, heartbeat drum]
[Final Assault: everything at once, relentless, choir screams the motif]
[Outro: cut back to the opening bells so the track loops seamlessly]
```

**Consejos:**
- Generar varias versiones y elegir la que tenga el intro más corto: el nivel arranca con acción, y si es muy largo conviene recortarlo.
- Que dure **3:30–4:30**: el nivel completo con el jefe dura más que eso, así que va a loopear, y el *outro* vuelve a las campanas del inicio para que el loop no se note.
- Si una versión sale demasiado "metal" y tapa los SFX, regenerar con `heavy` en lugar de `chugging low-tuned distorted guitars`.

## 10. Decisiones abiertas (con mi recomendación)

1. **Ecos de jefes anteriores en la carta 3.** *Recomiendo sí*: reutilizan sprites existentes, son nostálgicos y encajan con el "va con todo". La alternativa es una carta más de patrones puros.
2. **Carta de supervivencia de 30 s.** *Recomiendo sí*: es un clásico de jefe final. En Novice puede bajar a 20 s.
3. **Pista aparte para Thanatos.** *Recomiendo no por ahora*: una sola pista que escala basta. Si después quieres una, la preparo con un prompt derivado de este.
4. **Bala `white`.** *Recomiendo probarla* y quedarse con ella solo si pasa la prueba de contraste.
