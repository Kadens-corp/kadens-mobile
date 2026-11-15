/**
 * Les jours de l'écran « Aujourd'hui » (KL-28).
 *
 * Deux choses vivent ici, et elles n'ont rien de décoratif :
 *
 * 1. **L'arithmétique de calendrier**, qui se fait sur des `Date` locales puis
 *    repasse par `localDate()` — jamais sur la chaîne `AAAA-MM-JJ` par
 *    découpage. Un `-2` posé sur le quantième traverse les fins de mois, les
 *    changements d'année et les heures d'été sans qu'on ait à y penser ; une
 *    soustraction de chaînes non.
 * 2. **Les libellés français, écrits à la main.** Pas d'`Intl` : la présence
 *    d'ICU dans Hermes dépend de la variante embarquée, et un `toLocaleDateString`
 *    qui retombe silencieusement sur l'anglais donnerait « Tuesday » au milieu
 *    d'une identité qui n'a qu'une langue. Sept noms de jours et douze de mois
 *    coûtent moins que cette incertitude, et l'app n'a aucune i18n prévue.
 */

import { localDate } from '@/db';

/**
 * Combien de jours de part et d'autre d'aujourd'hui la bande montre **au repos**.
 * Le ticket d'origine disait J-2 → J+2 : deux jours pour rattraper la veille et
 * l'avant-veille, deux pour voir ce qui vient. C'est toujours ce qui s'affiche à
 * l'ouverture, et c'est la largeur de la bande : cinq cases à l'écran.
 *
 * Ce n'est plus une limite. La bande glisse au-delà, jusqu'au bout de ce que le
 * téléphone sait (`dayWindow`) : regarder la séance de jeudi prochain ne
 * demandait pas d'ouvrir le web, seulement de pousser la bande du doigt.
 */
export const DAY_REACH = 2;

/** Le nombre de cases visibles à la fois : aujourd'hui, et `DAY_REACH` de chaque côté. */
export const VISIBLE_DAYS = DAY_REACH * 2 + 1;

/**
 * Au-delà de cet écart, le nom du jour ne suffit plus à le situer : « mardi »
 * peut être celui de cette semaine ou du suivant. Le titre passe alors à la date.
 */
const SAME_WEEK = 6;

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const WEEKDAYS_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** Un jour de la bande, tel que l'écran le peint. */
export interface DayCell {
  /** `AAAA-MM-JJ`, la clé de lecture en base. */
  date: string;
  /** Écart en jours par rapport à aujourd'hui. Négatif avant, positif après. */
  offset: number;
  /** « lun », « mar »… Le composant met les capitales, pas la donnée. */
  weekday: string;
  /** Le quantième, sans zéro de tête : « 4 ». */
  dayOfMonth: string;
}

/** Convertit une date de calendrier en `Date` locale, à midi. */
function parse(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);

  // Midi, et pas minuit : un décalage d'heure d'été appliqué à minuit peut
  // basculer la date d'un jour. À midi, aucune transition connue ne le fait.
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** La date de calendrier située `days` jours après `date` (avant, si négatif). */
export function shiftDate(date: string, days: number): string {
  const shifted = parse(date);
  shifted.setDate(shifted.getDate() + days);

  return localDate(shifted);
}

/** L'écart en jours entre deux dates de calendrier. Positif si `date` est après `from`. */
export function dayOffset(date: string, from: string): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((parse(date).getTime() - parse(from).getTime()) / millisecondsPerDay);
}

/**
 * La fenêtre de séances datées annoncée par le dernier pull, telle que
 * `sync_state` la garde. Nulle tant qu'aucun pull n'a abouti.
 */
export interface SyncedWindow {
  from: string | null;
  to: string | null;
}

/**
 * La bande de jours : ce que le téléphone sait, jamais moins que J-2 → J+2.
 *
 * **Elle s'arrête au bord de la fenêtre synchronisée**, et c'est le point.
 * Dans la fenêtre, le pull fait autorité : un jour sans séance est vraiment un
 * jour sans séance. Au-delà, le téléphone ne sait rien, et une case vide y
 * dirait « rien de prévu » sur un jour que le coach a peut-être rempli. La
 * fenêtre suit la date du dernier pull (J-30 → J+14 côté serveur) : un
 * téléphone resté hors ligne une semaine voit donc moins loin devant lui, ce
 * qui est exactement ce qu'il sait.
 *
 * J-2 → J+2 reste un plancher : c'est ce que l'écran a toujours montré, y
 * compris avant le premier pull, et cinq cases remplissent la bande.
 */
export function dayWindow(today: string, synced: SyncedWindow | null = null): DayCell[] {
  const first = Math.min(-DAY_REACH, synced?.from ? dayOffset(synced.from, today) : 0);
  const last = Math.max(DAY_REACH, synced?.to ? dayOffset(synced.to, today) : 0);
  const cells: DayCell[] = [];

  for (let offset = first; offset <= last; offset += 1) {
    const date = shiftDate(today, offset);
    const at = parse(date);

    cells.push({
      date,
      offset,
      weekday: WEEKDAYS_SHORT[at.getDay()],
      dayOfMonth: `${at.getDate()}`,
    });
  }

  return cells;
}

/**
 * Le titre de l'écran pour un jour donné.
 *
 * « Hier » et « Demain » plutôt qu'une date : c'est ce qu'on se dit en pensant à
 * la séance qu'on n'a pas faite. Dans la semaine qui entoure aujourd'hui, le
 * jour de la semaine suffit. Plus loin, il devient ambigu (lequel des deux
 * mardis ?) et le titre prend la date.
 */
export function dayTitle(date: string, today: string): string {
  const offset = dayOffset(date, today);

  switch (offset) {
    case 0:
      return "Aujourd'hui";
    case -1:
      return 'Hier';
    case 1:
      return 'Demain';
    default:
      return Math.abs(offset) > SAME_WEEK ? shortDate(date) : WEEKDAYS[parse(date).getDay()];
  }
}

/** « mardi 4 août », en toutes lettres. Sert de sur-titre et de titre par défaut. */
export function longDate(date: string): string {
  const at = parse(date);

  return `${WEEKDAYS[at.getDay()]} ${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

/** « 4 août ». Le jour sans son nom, pour un titre de séance libre. */
export function shortDate(date: string): string {
  const at = parse(date);

  return `${at.getDate()} ${MONTHS[at.getMonth()]}`;
}
