// Pre-boss banter, Touhou style. Keyed by boss, then by character id.
// One exchange per playable character (player line + boss retort).
export const DIALOGUE = {
  'Orc Hero': {
    aramir: { p: '¡Ríndete, jefe orco! Este campo vuelve a Prontera.', b: '¡Un caballero solo? ¡Mi hacha ha partido cosas más duras!' },
    zeos: { p: 'Ni me viste llegar... ni me verás caer.', b: '¡Sombras! ¡Ja! Los orcos peleamos con los puños, no con trucos.' },
    eric: { p: 'Calcularé el hechizo justo para tu cráneo.', b: '¡Magia de libro! Yo escribo mi historia con sangre.' },
    dposada: { p: 'Que la luz te dé descanso... por las malas.', b: '¿Rezas por mí, sacerdotisa? Mejor reza por ti.' },
    chel_snip: { p: 'A esta distancia, no fallo jamás.', b: '¡Una flecha no detiene a un héroe orco!' },
    viri: { p: '¡Un golpe basta! ¡Prepárate, Asura!', b: '¿Puños contra puños? ¡Por fin alguien divertido!' },
  },
  'Dark Lord': {
    aramir: { p: 'Señor de las sombras, tu reino termina hoy.', b: 'Los caballeros siempre creen en finales. Qué tierno.' },
    zeos: { p: 'Un asesino en tu propia oscuridad. Irónico, ¿no?', b: 'La oscuridad es MÍA, pequeño. Deja que te la muestre.' },
    eric: { p: 'He estudiado tu magia. Conozco su punto débil.', b: '¿Un mago mortal leyendo mis secretos? Presuntuoso.' },
    dposada: { p: 'Traigo luz a este lugar sin sol.', b: 'Tu luz no es más que una vela en mi tormenta.' },
    chel_snip: { p: 'Ni las sombras esconden un blanco de mi arco.', b: 'Dispara, entonces. Veamos si tu flecha alcanza la nada.' },
    viri: { p: '¡Mi espíritu arde más que tu penumbra!', b: 'Un monje ardiente... apagarte será un placer.' },
  },
  'Baphomet': {
    aramir: { p: 'Por Prontera, por Midgard. ¡Caes aquí, demonio!', b: 'Tantos héroes bajo mi guadaña... uno más.' },
    zeos: { p: 'El filo más veloz contra el rey demonio. Acepto.', b: 'Rápido eres. Pero yo he cosechado almas por eones.' },
    eric: { p: 'Este es el conjuro para el que nací.', b: '¡Insolente! Tu magia se apagará con tu último aliento.' },
    dposada: { p: 'Que los dioses guíen mi mano contra el mal absoluto.', b: 'Reza cuanto quieras. Aquí, los dioses no escuchan.' },
    chel_snip: { p: 'Un tiro. Entre los cuernos. Fin de la historia.', b: '¿Crees que una flecha detiene al terror de Glast Heim?' },
    viri: { p: '¡Toda mi vida entrenando para este Asura!', b: '¡JA! ¡Ven, monje! ¡Que tu golpe valga la eternidad!' },
  },
  // Level 6: the tomb's judge (midboss) and the enthroned sun (final boss).
  'Osiris': {
    aramir: { p: 'Un juez de chacales. Mi espada ya dictó sentencia.', b: 'Sube a la balanza, caballero. Tu corazón pesa poco.' },
    zeos: { p: '¿Un juicio? Traje mis propias pruebas. ¡Mira!', b: 'Payaso ruidoso. El silencio también es sentencia.' },
    eric: { p: 'Los muertos deberían quedarse quietos. Te enseñaré.', b: 'He visto magos mejores momificados en mi sala.' },
    dposada: { p: 'Que la luz pese tu alma... y la deje descansar.', b: 'Tu diosa no tiene jurisdicción aquí, sacerdotisa.' },
    chel_snip: { p: 'Elegante. Lástima que apunte a tu frente.', b: 'Dispara. Mis vendas ya detuvieron cosas peores.' },
    viri: { p: '¡JUICIO! ¡VEN! ¡MIS PUÑOS SON LA LEY!', b: 'Ruidoso. Te pesaré primero a ti.' },
  },
  'Amon-Ra': {
    aramir: { p: 'Baja de ese trono, falso sol. La noche termina hoy.', b: 'Arrodíllate. Todos lo hacen, al final.' },
    zeos: { p: '¡El espectáculo final! ¡El sol contra el payaso!', b: 'Un bufón en mi santuario. Qué desperdicio de luz.' },
    eric: { p: 'He apagado soles antes. Tú eres el siguiente.', b: '¿Un mortal apagando el sol? Arde conmigo y aprende.' },
    dposada: { p: 'Ningún ídolo soporta la luz verdadera. Arrepiéntete.', b: 'YO SOY la luz, niña. Reza... a mí.' },
    chel_snip: { p: 'El blanco más brillante es el más fácil de acertar.', b: 'Mi corona ciega a arqueros mejores que tú.' },
    viri: { p: '¡EL SOL! ¡POR FIN UN RIVAL A MI ALTURA!', b: 'Ven, monje. Quémate contra la eternidad.' },
  },
  // Level 7: the doll of the dead town (midboss) and the mounted
  // reaper of the fortress (final boss).
  'Loli Ruri': {
    aramir: { p: 'Niña muerta, suelta esa muñeca. Esto termina aquí.', b: '¿Muerta? Qué grosero... Ruri solo juega con almas.' },
    zeos: { p: '¿Una fiesta del té? Yo traje mi espada.', b: '¡Un invitado! Siéntate... para siempre.' },
    eric: { p: 'Tu magia de muñecas tiene hilos. Los cortaré.', b: 'Tira, tira... los hilos tiran de ti también.' },
    dposada: { p: 'Pequeña, deja que tu alma descanse en paz.', b: '¿Descansar? El juego apenas empieza, sacerdotisa.' },
    chel_snip: { p: 'Apunto a los hilos, no a la niña.', b: 'Falla un hilo y la muñeca llorará... tú también.' },
    viri: { p: '¡HASTA LAS MUÑECAS CAEN ANTE MI ASURA!', b: 'Ruri ya rompió cien muñecos. Serás el ciento uno.' },
  },
  'Lord of Death': {
    aramir: { p: 'Baja del caballo, segador. Niflheim despierta hoy.', b: 'TODA ALMA PASA POR MI GUADAÑA. LA TUYA TAMBIÉN.' },
    zeos: { p: 'La muerte a caballo... qué falta de originalidad.', b: 'RÍETE. LOS GRACIOSOS LLEGAN PRIMERO A MI REINO.' },
    eric: { p: 'La nigromancia es solo magia mal escrita. La corrijo.', b: 'CORRIGE ESTO, MAGO: TU NOMBRE EN MI LIBRO.' },
    dposada: { p: 'La luz reclama este reino helado. ¡Vete, sombra!', b: 'TU DIOSA NO ENTRA AQUÍ. SOLO ENTRAS TÚ... PARA QUEDARTE.' },
    chel_snip: { p: 'Jinete pálido: mi flecha es más veloz que tu caballo.', b: 'CORRE, FLECHA. MI REINO ES TODA DIRECCIÓN.' },
    viri: { p: '¡LA MUERTE EN PERSONA! ¡EL RIVAL DEFINITIVO!', b: 'VEN, MONJE. CABALGAREMOS JUNTOS... AL ABISMO.' },
  },
  // Level 8: the memory of the fallen hero at the top of the tower.
  'Thanatos': {
    aramir: { p: 'Fuiste un héroe, Thanatos. Déjame darte el final que mereces.', b: 'MEREZCO EL OLVIDO. Y ME LO NEGARON... COMO TE LO NEGARÉ A TI.' },
    zeos: { p: 'Cuatro pedazos de alma rotos. Faltaba el más grande.', b: 'ME ROMPÍ PARA NO SENTIR. TÚ VAS A SENTIRLO TODO.' },
    eric: { p: 'Odio, desesperación, pena, dolor... ya los vencí uno por uno.', b: 'POR SEPARADO, MAGO. AHORA SOY TODOS A LA VEZ.' },
    dposada: { p: 'Tu memoria sufre. Deja que la luz la lleve a descansar.', b: 'NINGUNA LUZ LLEGA A ESTA TORRE. LA APAGUÉ CON MIS PROPIAS MANOS.' },
    chel_snip: { p: 'Subí doce pisos por este tiro. No voy a fallarlo.', b: 'DISPARA. LA MEMORIA NO SANGRA... PERO RECUERDA CADA HERIDA.' },
    viri: { p: '¡EL ÚLTIMO PISO, EL ÚLTIMO RIVAL! ¡TODO MI ESPÍRITU!', b: 'BIEN, MONJE. NADA DE CONTENERSE. NI TÚ... NI YO.' },
  },
  // Level 5 finale: two Rune-Midgarts Knights at once. Keyed by the combined
  // name spawnBosses() emits ("A & B"). Boss line speaks for both.
  'Seyren Windsor & Magaleta': {
    aramir: { p: 'Dos Caballeros de Runa... el laboratorio termina aquí.', b: 'Somos el escudo y la espada de Rune-Midgarts. No pasarás.' },
    zeos: { p: 'Dos objetivos. Misma hoja. Mismo desenlace.', b: '¿Solo contra ambos? Tu arrogancia será tu tumba.' },
    eric: { p: 'Calculé sus movimientos... a los dos a la vez.', b: 'Ningún cálculo sobrevive al acero de los Windsor.' },
    dposada: { p: 'Que la luz caiga sobre este lugar profanado.', b: 'Guardamos secretos que ninguna diosa debe conocer.' },
    chel_snip: { p: 'Dos blancos. Tengo flechas de sobra.', b: 'Apunta a uno y el otro te partirá en dos.' },
    viri: { p: '¡Dos jefes! ¡El doble de gloria para mi Asura!', b: '¡Contén el aliento, monje! Esto no durará mucho.' },
  },
};

export function bossDialogue(bossName, charId) {
  const set = DIALOGUE[bossName];
  if (!set) return null;
  return set[charId] ?? null;
}
