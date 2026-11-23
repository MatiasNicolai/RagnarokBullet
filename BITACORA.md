# Bitácora del proyecto

Este es el primer archivo que hay que leer al retomar el proyecto, sobre todo después de formatear o de perder sesiones. Reúne en un solo lugar el estado del proyecto, el historial, cómo volver a armar el entorno y las reglas de trabajo acordadas.

El detalle de cada área vive en otros documentos:
- [MASTERPLAN.md](MASTERPLAN.md): estado general y próximos pasos.
- [WEAPONS-PLAN.md](WEAPONS-PLAN.md): segunda arma.
- [THANATOS-PLAN.md](THANATOS-PLAN.md): nivel 8.
- [README.md](README.md): cómo jugar y los controles.

**Regla:** cada vez que se publica algo, se agrega una entrada al final de este archivo.

---

## 1. Estado actual (2026-11-23)

- **Desarrollo base cerrado.**
  - Campaña de 8 niveles, de Prontera a la Torre de Thanatos.
  - 6 héroes con dos armas cada uno, co-op local y online, y práctica de jefes.
  - Música mp3 en todos los niveles.
- **En línea:**
  - cliente: https://matiasnicolai.github.io/RagnarokBullet/ (se despliega solo con cada push a `main`);
  - relay del co-op online: Railway, en `wss://ragnarokbullet-production.up.railway.app`;
  - repo: https://github.com/MatiasNicolai/RagnarokBullet.
- **Arte al día:**
  - jefes y mid-bosses de los niveles 1 a 6 (Bosses V3);
  - todos los mobs comunes de los niveles 1 a 5 (Prontera V3 y Mobs V3);
  - los niveles 6, 7 y 8 nacieron con arte GPT;
  - los héroes tienen un set de sprites por arma.

### Pendientes
1. Probar las dos armas jugando de verdad, porque el balance se midió con un bot contra un blanco quieto. Lo que más conviene mirar: la mina de la Ballesta y el Fire Wall de la Vara, que quedaron con menos DPS a propósito (hacen daño en área y comen balas).
2. Balance del nivel 8 jugando de verdad: la carta de supervivencia, "Último Aliento" y el mid-boss de dos parejas, en Normal y Nightmare, solo y en co-op.
3. Smoke test online con dos jugadores reales, pasando de un nivel al siguiente.
4. Bug menor: el sintetizador de `music.js` ignora las notas con bemol (`Bb`, `Eb`), así que el chiptune del nivel 3 pierde notas.
5. Presupuesto de música: 37,9 MB contra un límite de 40 MB en el test. Un nivel 9 obligaría a subir el límite o a bajar el bitrate.

---

## 2. Historial de publicaciones

| PR | Fecha | Qué |
|---|---|---|
| #1 | 2026-11-17 | Nivel 8: Torre de Thanatos (etapa final) |
| #2 | 2026-11-17 | README y MASTERPLAN al día con los 8 niveles |
| #3 | 2026-11-17 | Thanatos: vida ×2, side-steps y adds (feedback del playtest) |
| #4 | 2026-11-17 | Bosses V3: Orc Hero, Dark Lord, Baphomet y Doppelganger |
| #5 | 2026-11-17 | Bosses V3: Mastering, Vesper, Seyren, Magaleta y Amon-Ra |
| #6 | 2026-11-17 | Bosses V3: Baphomet Jr., Archdam, Experimento Fallido y Osiris |
| #7 | 2026-11-21 | Mobs V3: los 32 mobs comunes de los niveles 2 a 5, más la limpieza de bordes de los de Prontera |
| #8 | 2026-11-23 | Segunda arma por héroe, sprites por arma y arreglo de la bomba de Aramir |

---

## 3. Volver a armar el entorno (después de formatear)

**Versiones con las que funciona** (2026-11-23): Node v26.13, Python 3.12, git 2.56 y codex-cli 0.169.

1. **Clonar:**
   ```powershell
   git clone https://github.com/MatiasNicolai/RagnarokBullet.git
   ```
   Después, `npm install` en la raíz y también dentro de `server/`.
2. **Git sobre el disco H:** git reclama *dubious ownership*. Se resuelve corriéndolo como `git -c safe.directory=* ...`, o de forma permanente:
   ```powershell
   git config --global --add safe.directory '*'
   ```
3. **GitHub CLI:**
   - está en `C:\Program Files\GitHub CLI\gh.exe` (en shells viejos no está en el PATH);
   - hay dos cuentas, las dos del usuario: **MatiasNicolai** (admin del repo, la activa para publicar) y **MNicolai02** (solo lectura);
   - login con `gh auth login`.
4. **Codex CLI** (arte): `npm i -g @openai/codex`, y después `codex login` con la cuenta de ChatGPT.
   - Toda llamada de arte pasa por `tools/codex-image.sh`. Ese script fija **gpt-6-sol con esfuerzo medio**, corta si Codex no corrió con ese modelo, toma la imagen de la carpeta de su propia sesión y nunca sobrescribe una fuente.
   - Codex dice que no puede guardar porque el workspace es de solo lectura. No importa: el script copia la imagen igual.
5. **Python:** los slicers (`tools/slice-*.py`) usan solo la librería estándar, así que no hace falta instalar nada.
6. **ffmpeg:** solo hace falta para codificar música (`node tools/encode-music.mjs <pista>.mp3`).

### Correr y probar
- **Juego:** `npm run dev`, y se abre en http://localhost:5173. El Art Lab está en `?artlab=1`.
- **Online local:** `cd server && npm start` (relay en :8090).
- **Tests:**
  - `node server/test-static.mjs`: hoy da 65/65;
  - `node server/test-niflheim-blockers.mjs`;
  - `cd server && node test-netplay.mjs`.
- **Ojo con Node 26:** a veces `test-static` se queda colgado *después* de imprimir PASS. Hay que correrlo con un timeout y tomar "PASS y luego timeout" como pasado. Ya se investigó y se decidió no tocarlo.
- **Capturas del canvas con la pestaña en segundo plano:** `node tools/shot-server.mjs` (puerto 8123). Las capturas van a `tools/shots/`, que está en el `.gitignore`.

---

## 4. Reglas de trabajo acordadas

- **Arte:**
  - lo genera Claude con Codex;
  - el usuario aprueba cada hoja **antes** de recortarla;
  - las fuentes aprobadas son inmutables, y una corrección sale como `-v2`;
  - cada set lleva su registro `*-gpt-image.prompt.md`, con el prompt, las referencias y el sha256;
  - los tests verifican que las fuentes y las salidas no cambien.
- **Diseño:**
  - si un monstruo existe en Ragnarok Online y el arte viejo difiere, se usa el sprite oficial de RO;
  - las criaturas propias del juego conservan su diseño (las hojas de `Monsters/`);
  - los diseños que vienen de referencias del usuario se respetan (por ejemplo, Amon-Ra en su trono).
- **Música:** la hace el usuario en Suno. Claude escribe el prompt (estilo, exclusiones y estructura), y el mp3 va a `Music/`.
- **Publicar:** cuando el usuario dice "publícalo", se hace rama nueva desde `origin/main`, PR, `gh pr merge --rebase` y, de paso, se actualiza esta bitácora.
  - Las ramas remotas no se borran.
  - El push a `main` despliega solo.
- **Al retomar:** primero `git fetch` y comparar con `origin/main` (una vez, después de formatear, el checkout local estaba atrasado). Después leer esta bitácora y el bloque de estado del MASTERPLAN.

---

## 5. Entradas

### 2026-11-23: Segunda arma (PR #8)
- **Plan:** el plan original de armas se había perdido y se recreó en `WEAPONS-PLAN.md`.
- **Armas:** cada héroe tiene dos y las cambia con U / Numpad 4 / LB:
  - Aramir: Espada / Lanza;
  - Zeos: Katar / Dagas;
  - Eric: Báculo / Vara;
  - Dposada: Báculo sagrado / Maza;
  - Chel_Snip: Arco / Ballesta;
  - Viri: Nudillos / Bastón.
- **Cada arma se siente distinta:** patrón y efecto propios (veneno, ralentizar, muro de fuego que come balas, minas en área, Investigate y gasto de esferas), pose de ataque, sonido por ráfaga y sacudida en las armas pesadas.
- **Sprites:** dos sets de 8 poses por héroe, uno por arma, así que el arma activa se ve en todas las poses; los sprites originales quedan para el retrato y la selección. Además, 14 proyectiles y 12 íconos. Todo con Codex, aprobado hoja por hoja.
- **Arreglo:** la bomba de Aramir (Bowling Bash) no limpiaba la pantalla, con ninguna de las dos armas. Ahora le hace 12 de daño a todo enemigo en pantalla.
- **Tests:** sección 22 de `test-static`; `test-netplay` ahora también cambia de arma.

### 2026-11-21: Mobs V3 (PR #7)
- **Modelo:** desde esta fecha, todas las llamadas de arte a Codex usan gpt-6-sol con esfuerzo medio, a través de `tools/codex-image.sh`.
- **Mobs:** se rehicieron los 32 mobs comunes de los niveles 2 a 5 (`public/assets-v2/mobs-v3/`, `tools/slice-mobs-v3.py`), siguiendo el diseño oficial de RO donde existía.
- **Prontera:** se limpiaron el borde blanco y las sombras de los 6 mobs de Prontera V3.
- **Arreglos del recorte:** quedaron ahí la pasada de sombras oscuras planas y el relleno de huecos que la limpieza abría en arte gris (Ghoul, Marionette, el domo del Repair Drone).

### 2026-11-16/17: Nivel 8 y Bosses V3 (PRs #1 a #6)
- **Nivel 8:** la Torre de Thanatos, etapa final, con un rebalance después del primer playtest.
- **Bosses V3:** los 13 jefes y mid-bosses de los niveles 1 a 6, redibujados al estándar de Thanatos.
