# Art Lab — herramienta interna de revisión visual

No es parte del juego. Sirve para comparar sprites ORIGINAL vs CLEAN V2.1,
revisar poses/frames y registrar veredictos, sin tocar gameplay, balance ni
assets originales.

## Abrir / salir

```bash
npm run dev
```

Abre en tu navegador `http://localhost:5173/?artlab=1`.

- Sin `?artlab=1` el juego arranca normal (título). El Art Lab no altera el
  flujo normal en absoluto.
- Para salir: botón **Salir al título** o tecla `Esc`/`T`.
- Se puede combinar con `?art=v2` (no interfiere: el Art Lab carga sus
  propias tablas desde `public/assets` y `public/assets-v2`).

## Qué muestra

- Columna izquierda: **ORIGINAL** (`public/assets`). Derecha: **CLEAN V2.1**
  (`public/assets-v2/{geffen,bosses}`). Si un asset no tiene versión clean
  (p. ej. personajes), la columna derecha muestra **sin versión clean**.
- Catálogo: primero los 11 jefes/midbosses limpiados, luego los 8 mobs de
  Geffen, personajes y resto de mobs del atlas.
- Sprites anclados por los pies (misma base en ambas columnas) con zoom
  nearest-neighbor.

## Controles

Botones visibles + teclado (misma acción):

| Acción | Botón | Tecla |
|---|---|---|
| Entidad anterior/siguiente | ◀ / ▶ | ← / → |
| Saltar 5 entidades | +5 | Shift + ←/→ |
| Saltar al siguiente grupo | Grupo | G |
| Pose anterior/siguiente | ◀ Pose / Pose ▶ | ↑ / ↓ |
| Cambiar lado down/up | Lado | L |
| Play/pausa | ⏸/▶ | Espacio |
| Avanzar 1 frame | Frame+ | . |
| Fondo (negro→blanco→gris→mapa) | Fondo | B |
| Zoom 1x–8x | Zoom- / Zoom Nx | Z (Shift+Z reduce) |
| Overlays | Overlay | O |
| Veredicto de revisión | Veredicto | R |
| Descargar revisiones JSON | Exportar JSON | E |
| Salir al título | Salir al título | Esc / T |

Poses disponibles: idle, moveL, moveR, hit, attack (down/up donde exista);
personajes muestran sus 7 frames DOWN/UP.

## Overlays

- `rect+ancla`: rectángulo del frame + cruz cian en el punto de ancla (pies).
- `+hitbox ≈`: círculo rojo ilustrativo. **El hitbox real no está disponible
  en el arte**: vive como radios numéricos en la sim (`src/sim`). El overlay
  lo deja claro en pantalla.

## Veredictos

Por entidad: pendiente → aprobado → limpieza manual → regenerar → escala →
animación (tecla `R` o botón). Se guardan solo en `localStorage`
(`artlab_reviews_v1`). **Exportar JSON** descarga `artlab-reviews.json`;
nada se escribe al repositorio automáticamente.

## Límites conocidos

- Requiere los PNG/JSON de `public/assets-v2`; si faltan, todo muestra
  original + 'sin versión clean' (no rompe).
- El fondo de mapa usa el primer tile de Prontera (siempre precargado);
  si no estuviera disponible, el modo mapa se salta solo.
- Sin tests de navegador: cubierto por checks estáticos en
  `server/test-static.mjs` (sección 7) + `npm run build`.
