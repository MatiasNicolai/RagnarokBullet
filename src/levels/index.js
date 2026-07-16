// Campaign level registry: script + visual theme + display metadata per level.
import { level1 } from './level1.js';
import { level2 } from './level2.js';
import { level3 } from './level3.js';
import { level4 } from './level4.js';
import { level1Theme, level2Theme, level3Theme, level4Theme } from '../render/themes.js';

export const LEVELS = [
  {
    script: level1, theme: level1Theme, mapSet: 'prontera', midProgress: 0.6,
    title: 'Nivel 1', name: 'Campos de Prontera → Plaza de Prontera',
    biomeNames: [[0, 'Campos de Prontera'], [0.25, 'Puerta de la ciudad'], [0.5, 'Avenida real'], [0.9, 'Plaza de Prontera']],
  },
  {
    script: level2, theme: level2Theme, mapSet: 'geffen', midProgress: 0.6,
    title: 'Nivel 2', name: 'Mazmorra de Geffen → Geffenia',
    biomeNames: [[0, 'Entrada de la mazmorra'], [0.25, 'Corredor maldito'], [0.5, 'Cripta'], [0.9, 'Santuario de Geffenia']],
  },
  {
    script: level3, theme: level3Theme, mapSet: 'glastheim', midProgress: 0.6,
    title: 'Nivel 3', name: 'Glast Heim',
    biomeNames: [[0, 'Patio de Glast Heim'], [0.3, 'Salones malditos'], [0.55, 'Cripta profunda'], [0.9, 'Santuario interior']],
  },
  {
    // Juperos — native 7-tile map set (juperos001..007); level4Theme is the fallback.
    script: level4, theme: level4Theme, mapSet: 'juperos', midProgress: 0.6,
    title: 'Nivel 4', name: 'Juperos — la civilización perdida',
    biomeNames: [[0, 'Entrada a las ruinas'], [0.3, 'Corredor ancestral'], [0.55, 'Gran sala de máquinas'], [0.9, 'Núcleo de Vesper']],
  },
];
