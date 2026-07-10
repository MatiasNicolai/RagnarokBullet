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
};

export function bossDialogue(bossName, charId) {
  const set = DIALOGUE[bossName];
  if (!set) return null;
  return set[charId] ?? null;
}
