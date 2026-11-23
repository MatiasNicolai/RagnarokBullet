# Plan: segunda arma por héroe

Recreado el 2026-11-23: el plan original no quedó en el repo, en el historial de git ni en sesiones anteriores.

## ⭐ Estado: implementado (2026-11-23)

- **Mecánica:** `SWAP` funciona en `U` / `Numpad4` / `LB`, con 30 ticks de espera entre cambios. `p.weapon` vive en la sim, entra en el checksum del lockstep y se mantiene entre niveles. El código está en `src/characters/index.js`, con `weapons: [arma1, arma2]` por héroe.
- **El arma 1 no cambió:** es exactamente el código anterior. Los tests de repetición y de balance de los niveles siguen pasando.
- **Sensación:** las diferencias van más allá del patrón de disparo.
  - Pose de ataque después de cada ráfaga, con una duración por arma y modo (`pose`). Antes el juego nunca la mostraba.
  - Un sonido por ráfaga real, con timbre por héroe, arma y modo (`audio.playShot`).
  - Sacudida de cámara en las armas pesadas (`shake`).
  - Al cambiar de arma, un sonido, el nombre flotando sobre el héroe y la barra lateral con los íconos y nombres de J/K del arma activa.
- **Arte** (decisión D2, a pedido del usuario): cada héroe tiene dos sets de 8 poses, uno por arma, con el arma activa visible en todas las poses, de frente y de espaldas. A eso se suman 14 proyectiles y 12 íconos. El set del arma 1 se agregó después: varios sprites originales solo mostraban el arma al atacar, y además así los dos sets comparten estilo. Los sprites originales quedan para el retrato y la selección. Se generó con Codex (gpt-6-sol) y el usuario lo aprobó. El registro está en `art-clean/weapons-gpt/weapons-gpt-image.prompt.md`, el recorte en `tools/slice-weapons.py` y la salida en `public/assets-v2/weapons/`.
- **Balance:** se midió con un bot contra un blanco grande. El mejor DPS del arma 2 respecto del arma 1 queda así: Aramir 0,94, Zeos 1,02, Eric 0,80, Dposada 1,11, Chel_Snip 0,60 y Viri 1,13. La Ballesta y la Vara quedan bajas a propósito, porque la mina hace daño en área y el Fire Wall se come balas. Un test vigila el rango [0,55, 1,2].
- **Cambios contra la tabla original:**
  - el arma 1 de Dposada es un **báculo sagrado**, no un libro (así está dibujada);
  - Duple Light son dos luces que golpean dos veces cada una (no rebotan);
  - la mina se lanza hacia adelante en vez de quedar quieta;
  - el enfocado de espada de Aramir se llama Magnum Break.
- **Arreglo de paso:** la bomba de Aramir (Bowling Bash) ahora le pega a todo enemigo en pantalla (`BOWLING_BASH_DMG`, 12). Antes solo dependía del anillo de ondas y no "limpiaba", con cualquiera de las dos armas.
- **Tests:** sección 22 de `test-static`, y `test-netplay` ahora cambia de arma y usa foco de los dos lados.

Es el último bloque del desarrollo base: cada uno de los 6 héroes suma una **segunda arma** con la que alterna en plena partida. Cada arma sale de las que su clase usa en Ragnarok Online y cambia la **forma** del disparo (ancho contra enfocado, cerca contra lejos), no el poder total.

## 1. Tabla de armas

Cada arma define el **disparo normal** (`J`, mantener) y el **disparo enfocado** (`K`). La bomba (`L`) y el especial (`I`) siguen siendo del héroe y no cambian con el arma (ver la decisión D3).

| Héroe | Clase | Arma 1 (actual) | Arma 2 (nueva) |
|---|---|---|---|
| Aramir | Lord Knight | **Espada**: Bash (abanico de 3–5 ondas) / enfocado Magnum Break | **Lanza**: Brandish Spear (arco frontal corto y muy ancho, atraviesa) / enfocado Spiral Pierce (lanza única, lenta, mucho daño, atraviesa 3) |
| Zeos | Assassin Cross | **Katar**: Grimtooth (4 cortes en abanico) / enfocado Sonic Blow (ráfaga rápida recta) | **Dagas**: Throw Venom Knife (5 cuchillos en abanico cerrado que envenenan) / enfocado Soul Destroyer (proyectil único de largo alcance que atraviesa) |
| Eric. | High Wizard | **Báculo**: Soul Strike (2 orbes lentos) / enfocado Jupitel Thunder | **Vara**: Fire Bolt / Cold Bolt / Lightning Bolt (rotan por elemento, bolas pequeñas y rápidas en ráfaga) / enfocado Fire Wall (muro corto delante que bloquea balas débiles) |
| Dposada | Saint | **Báculo sagrado**: Holy Light (3 luces en abanico) / enfocado Judex | **Maza**: Holy Smite, golpe sagrado de corto alcance (alto daño, vida corta como los puños de Viri) / enfocado Duple Light (dos luces que golpean dos veces) |
| Chel_Snip | Sniper | **Arco**: Double Strafe (2 flechas rápidas) / enfocado Focused Arrow (atraviesa 2) | **Ballesta (Arbalest)**: virotes lentos y pesados que atraviesan / enfocado Blast Mine (lanza una mina lenta que explota al contacto, con daño en área; máximo 3) |
| Viri | Monk | **Nudillos**: Triple Attack (puños de vida corta) / enfocado Chain Combo | **Bastón**: Finger Offensive (lanza esferas espirituales a larga distancia; gasta 1 esfera cada N disparos y cae a un disparo débil sin esferas) / enfocado Investigate (golpe único que daña más a enemigos con mucha vida) |

Notas de diseño:
- **Aramir:** hoy su disparo enfocado se llama *Pierce*, que en RO es una habilidad de lanza. Con la lanza pasa a ella (*Spiral Pierce*), y el enfocado de espada se renombra *Magnum Break* sin cambiar su patrón.
- **Viri:** el bastón compite con Asura Strike por las esferas. Es la única arma con un costo real, y la decisión táctica es gastar las esferas a distancia o guardarlas para la bomba.
- **Chel_Snip:** la mina es la única arma que deja algo en el campo. Necesita un tope de minas activas (3) para no saturar.
- **Eric:** la vara rota el elemento en cada ráfaga (fuego, hielo, rayo). Hielo ralentiza un poco y rayo atraviesa 1, así que el patrón cambia sin otro botón.

## 2. Mecánica de cambio

- **Botón nuevo `SWAP`** (`BTN.SWAP = 256` en `src/engine/input.js`):
  - teclado: `U` para P1 y `Numpad4` para P2;
  - mando: `LB` (botón 4).
- **Al presionar** (flanco, no mantener) se pasa a la otra arma. Hay un enfriamiento de 30 ticks (0,5 s) para que no se pueda alternar en cada frame y combinar los dos patrones.
- **Estado en el jugador:** `p.weapon` (0 o 1). Vive en la sim, así que es determinista y viaja en el lockstep como cualquier otro botón: la máscara va como número en JSON y no tiene ancho fijo.
- **Los modificadores del jugador se aplican a las dos armas:** el power (Blue Gemstones), Quicken/Awakening y `dmgBonus`. Hoy viven dentro de `shot()` y de `aramir.fire`; pasan a una capa común.
- **Arma inicial:** el arma 1. En la selección de personaje no se elige (ver la decisión D4).
- **Fin de nivel y continue:** se mantiene el arma que estaba activa.

## 3. Cambios de código

1. **`src/characters/`**: cada héroe pasa de `fire(sim, p)` a `weapons: [w1, w2]`, y cada arma trae `{ id, name, icon, fire(sim, p) }`. `fire` del héroe delega en `weapons[p.weapon]`. Aramir deja de tener su propio `fire` duplicado y usa el mismo `shot()` común, con un parámetro de origen para su doble lanza.
2. **`src/sim/sim.js`**: lee `SWAP` con detección de flanco, guarda el enfriamiento, emite el evento `weaponSwap` (para SFX y UI) y hace que el checksum del lockstep incluya `p.weapon`.
3. **Mecánicas nuevas:**
   - veneno al pegar (ya existe `e.poison` por Meteor Assault, solo falta aplicarlo por bala);
   - ralentizar (variante corta de `e.frozen`);
   - minas (balas de jugador quietas con `ttl` y explosión al contacto);
   - daño escalado por vida del enemigo (Investigate);
   - gasto de esferas (Viri).
4. **UI:**
   - sidebar: los íconos de skill muestran las dos skills del arma activa y un indicador del arma (ícono + nombre, por ejemplo "Lanza");
   - carta de selección: muestra las dos armas;
   - menú de pausa y título: la ayuda de controles suma `U` / `LB`.
5. **Audio:** un SFX corto de cambio de arma (chiptune, en `audio.js`).

## 4. Arte (CLI de Codex, gpt-6-sol medio, con `tools/codex-image.sh`)

- **Proyectiles nuevos**, 2 o 3 por héroe: ondas de lanza, cuchillos, bolas elementales, golpe de maza y destello, virote y mina, esfera espiritual. Van en una hoja nueva de proyectiles, por ejemplo `assets-v2/weapons/projectiles`, con las claves `aramir:spear1` y siguientes, para no tocar la hoja de personajes.
- **Íconos de skill** para las 12 skills nuevas, en el mismo estilo que `Characters/Character Skills.png`.
- **Íconos de arma**: 12 íconos chicos, uno por arma.
- **Sprites de héroe con el arma 2** (opcional, ver la decisión D2): 6 hojas nuevas con las mismas poses, empuñando la otra arma.

Se mantiene el flujo de siempre: tú apruebas cada hoja antes de recortarla.

## 5. Balance y tests

- **Regla de balance:** las dos armas de un héroe deben tener un DPS parecido contra un objetivo grande, dentro de ±15 %. Lo que cambia es la cobertura (ancho del barrido), el alcance y la utilidad.
- **Medición:** un bot que dispara a un jefe quieto con cada arma (como el de Thanatos), más uno que limpia una oleada del nivel 2, para medir la cobertura.
- **Tests nuevos en `test-static`:**
  - cada héroe expone 2 armas con `fire`;
  - `SWAP` cambia el arma una vez por pulsación y respeta el enfriamiento;
  - la repetición con cambios de arma da el mismo checksum (determinismo);
  - el DPS de cada par queda dentro de ±15 %.
- **Online:** `test-netplay` con cambios de arma de los dos lados.

## 6. Orden de trabajo

1. Mecánica de cambio y refactor `weapons: [w1, w2]` usando proyectiles existentes como placeholder. Los tests de determinismo y netplay van en este paso.
2. Las 6 armas nuevas, jugables con placeholders, más el balance con bots.
3. Arte: proyectiles, íconos de skill y de arma (Codex) e integración.
4. UI y SFX: sidebar, carta de selección, ayuda de controles.
5. Sprites con el arma 2, solo si se decide hacerlos (D2).
6. Actualizar README y MASTERPLAN, y publicar.

## 7. Decisiones abiertas

- **D1. ¿Las armas de la tabla?** Las dos dudosas son la de Eric (vara; en RO un mago también usa daga) y la de Dposada (maza contra libro, o al revés).
- **D2. ¿El sprite del héroe cambia con el arma?** Hacerlo es más fiel, pero suma 6 hojas de personaje. La recomendación es empezar sin cambiar el sprite: proyectiles, íconos y nombre del arma alcanzan para leer el cambio. Los sprites quedan para el final.
- **D3. ¿La bomba y el especial dependen del arma?** La recomendación es que no: así no se duplica el trabajo y el héroe mantiene su identidad.
- **D4. ¿Se elige el arma inicial en la selección de personaje?** La recomendación es que no: se empieza siempre con el arma 1 y se cambia en juego.
- **D5. Tecla:** `U` / `Numpad4` / `LB`, ¿o prefieres otra?
