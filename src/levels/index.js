// Campaign level registry: script + visual theme + display metadata per level.
import { level1 } from './level1.js';
import { level2 } from './level2.js';
import { level3 } from './level3.js';
import { level1Theme, level2Theme, level3Theme } from '../render/themes.js';

export const LEVELS = [
  {
    script: level1, theme: level1Theme, mapSet: 'prontera',
    title: 'Nivel 1', name: 'Campos de Prontera → Plaza de Prontera',
    biomeNames: [[0, 'Campos de Prontera'], [0.3, 'Puerta de la ciudad'], [0.6, 'Avenida real'], [0.85, 'Plaza de Prontera']],
  },
  {
    script: level2, theme: level2Theme, mapSet: 'geffen',
    title: 'Nivel 2', name: 'Mazmorra de Geffen → Geffenia',
    biomeNames: [[0, 'Entrada de la mazmorra'], [0.3, 'Corredor maldito'], [0.6, 'Cripta'], [0.85, 'Santuario de Geffenia']],
  },
  {
    script: level3, theme: level3Theme, mapSet: 'glastheim',
    title: 'Nivel 3', name: 'Glast Heim',
    biomeNames: [[0, 'Patio de Glast Heim'], [0.35, 'Salones malditos'], [0.75, 'Santuario interior']],
  },
];
