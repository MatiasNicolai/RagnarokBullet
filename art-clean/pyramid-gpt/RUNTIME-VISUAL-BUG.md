# Runtime visual bug - opaque sheet background in sprites (RESUELTO)

**Estado: cerrado.** El defecto se corrigio en `tools/slice-pyramid.py` y hoy
esta cubierto por un gate automatico. Este archivo queda como historial; no
hay trabajo pendiente en el.

## Sintoma original

Reportado en practica de Amon-Ra: un rectangulo blanco/pergamino grande,
artefactos de grilla roja y decoracion residual de la hoja fuente alrededor
del trono. No era un defecto de generacion de arte sino remocion incompleta
del fondo al recortar.

Medicion de entonces sobre `public/assets-v2/pyramid/bosses4.png`:

- los frames de Amon-Ra retenian 13-35% de pixeles bright-neutral opacos;
- `down.idle[0]`: 12.165 pixeles opacos, 4.102 bright-neutral (33,7%).

## Correccion aplicada

Remocion del fondo por celda de pose con matte conectado al borde y
pertenencia por componentes, en lugar de ensanchar el umbral global de
bright-neutral (que se hubiera comido huesos palidos, vendas y brillos
legitimos). Se preservaron las identidades: trono y cadaver sentado de
Amon-Ra, baculo y efecto de ataque adherido, manos y vendas de Osiris, armas
y alas de los mobs.

## Medicion actual (misma metrica, atlas en produccion)

| Frame | bright-neutral residual |
|---|---|
| `amonRa.down.idle[0]` | 2,3% (era 33,7%) |
| `amonRa.down.attack[0]` | 3,2% |
| `amonRa.down.hit[0]` | 3,2% |

Para referencia, Niflheim (mismo pipeline, posterior) queda en 3,6-4,0%.

## Gate automatico

`server/test-static.mjs` seccion 16 - "V2 sheets: no residual opaque matte" -
recorre los **272 frames** de runtime de las seis hojas v2 (pyramid, niflheim
y prontera V3) y falla si alguno vuelve a ser un parche opaco.

Mide la firma **geometrica** del bug, no la cromatica: contar pixeles
bright-neutral marcaria arte legitimamente palido (huesos de esqueleto,
vendas de momia, el vestido de Loli Ruri, que llegan al 14% sin estar
sucios). Un recorte real de sprite no puede hacer dos cosas:

- rellenar toda su caja: `fill <= 90%` (peor caso real 76,4%);
- quedar opaco en todo su borde: `border <= 75%` (peor caso real 55,4%).

Un frame re-matteado da ~100%/100% y rompe el gate. Verificado inyectando el
bug a proposito: el idle de Amon-Ra relleno de pergamino falla con
`fill 100.0%`, y el PNG se restauro byte-exacto despues.
