// Campaign level registry: script + visual theme + display metadata per level.
import { level1 } from './level1.js';
import { level2 } from './level2.js';
import { level3 } from './level3.js';
import { level4 } from './level4.js';
import { level5 } from './level5.js';
import { level6 } from './level6.js';
import { level7 } from './level7.js';
import { level1Theme, level2Theme, level3Theme, level4Theme, level5Theme, level6Theme, level7Theme } from '../render/themes.js';

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
  {
    // Lighthalzen Biolab — native 7-tile map set; dual final boss Seyren & Magaleta.
    script: level5, theme: level5Theme, mapSet: 'biolab', midProgress: 0.6,
    title: 'Nivel 5', name: 'Laboratorio de Lighthalzen',
    biomeNames: [[0, 'Zona de contención'], [0.3, 'Laboratorios'], [0.55, 'Sala del reactor'], [0.9, 'Santuario interior']],
  },
  {
    // Pyramid of the Sun — native 7-tile map set; midboss Osiris, final boss Amon-Ra.
    script: level6, theme: level6Theme, mapSet: 'pyramid', midProgress: 0.55,
    title: 'Nivel 6', name: 'Pirámide del Sol',
    biomeNames: [[0, 'Acercamiento al oasis'], [0.3, 'Entrada a la pirámide'], [0.55, 'Descenso interior'], [0.9, 'Santuario solar']],
  },
  {
    // Niflheim — native 7-tile map set; midboss Loli Ruri, final boss Lord of Death.
    script: level7, theme: level7Theme, mapSet: 'niflheim', midProgress: 0.55,
    title: 'Nivel 7', name: 'Reino de Niflheim',
    biomeNames: [[0, 'Valle de Gyoll'], [0.3, 'Bosque embrujado'], [0.55, 'Ciudad de los muertos'], [0.9, 'Fortaleza final']],
  },
];
