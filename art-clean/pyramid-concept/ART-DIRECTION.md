# Pyramid — dirección visual y producción

## Concepto

**La Calzada Solar Enterrada**: un corredor funerario vertical que desciende desde una entrada de arenisca hacia una cámara solar sellada. Debe sentirse antiguo, oscuro y ceremonial, con oro oxidado, lapislázuli, braseros y arquitectura mortuoria. La zona central queda despejada para el danmaku; la narrativa ambiental vive en los bordes.

El objetivo no es copiar mapas existentes: se conserva el lenguaje visual general de un dungeon clásico de Ragnarok Online —perspectiva superior, sprites/pixel-art detallado y lectura inmediata— con composición original para bullet hell.

## Especificación del mapa final

- Formato: PNG RGB.
- Tamaño nativo: 793 × 1983 px, compatible con los sets Juperos/Biolab.
- Cámara: top-down con ligera perspectiva 3/4, sin horizonte.
- Carril jugable: 520 px centrales aproximadamente, contraste bajo y detalle moderado.
- Bordes: criptas, pilares, sarcófagos, guardianes, relieves, derrumbes y braseros.
- Paleta: sombra volcánica, arenisca envejecida, oro oxidado, lapislázuli y fuego ámbar.
- Sin texto, personajes, monstruos, proyectiles ni UI.
- Sin costuras visibles al conectarse con otros tiles.
- La arena de Amon-Ra debe reservar una composición radial y un disco solar monumental.

## Set previsto

1. `pyramid001`: entrada y calzada funeraria.
2. `pyramid002`: galería de sarcófagos.
3. `pyramid003`: catacumbas derrumbadas.
4. `pyramid004`: cámara de momificación.
5. `pyramid005`: salón de Isis y transición a Osiris.
6. `pyramid006`: cripta real / arena de Osiris.
7. `pyramid007`: santuario solar / arena de Amon-Ra.

## Paleta jugable propuesta

1. Familiar — bat hostigador rápido.
2. Soldier Skeleton — avance frontal y abanicos simples.
3. Archer Skeleton — disparos dirigidos desde los bordes.
4. Mummy — unidad lenta con anillos de maldición.
5. Verit — embestida y proyectiles al morir.
6. Matyr — persecución rápida con ráfagas cortas.
7. Isis — movimiento serpentino y espirales.
8. Ancient Mummy — élite con invocaciones y patrones densos.
9. Midboss: Osiris.
10. Jefe final: Amon-Ra.

## Estándar para sprites futuros

- Fondo transparente real; nunca blanco/cuadriculado horneado.
- RGBA con borde de alpha limpio y sin matte.
- Cinco poses por orientación cuando corresponda: idle, moveL, moveR, hit, attack.
- Silueta legible a escala de juego.
- Iluminación superior cálida y sombra fría inferior.
- Punto de anclaje en el centro de los pies.
- Efectos y armas separados cuando sobresalgan demasiado del cuerpo.
- Contact sheet y manifests antes de integrar al juego.

## Estado

`pyramid001-concept.png` es un layout/concepto procedural para validar composición, paleta y espacio jugable. No es todavía el render final ni está conectado al juego.
