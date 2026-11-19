/**
 * Les sept derniers jours, en un coup d'œil — le haut de l'écran « Historique ».
 *
 * Jumeau de `LastSevenDays` côté serveur (la carte de l'accueil web), avec la
 * même fenêtre et le même comptage des muscles, sur la base locale. Il répond à
 * « qu'est-ce que j'ai fait cette semaine » sans réseau : combien de séances de
 * muscu, et quels muscles, à combien de séries.
 *
 * ## La fenêtre glisse, elle ne suit pas le calendrier
 *
 * Aujourd'hui et les six jours d'avant, en dates **locales** (`db/time.ts`). Une
 * semaine du lundi au dimanche serait vide chaque lundi matin, précisément quand
 * on veut relire ce qu'on vient de faire. Elle tient toujours dans la fenêtre
 * synchronisée (J-30), il n'y a donc rien à annoncer en plus de l'historique.
 *
 * ## Les séances : celles que le téléphone reçoit, faites
 *
 * Le téléphone ne descend que des séances de muscu (`TrackableSchedule` côté
 * serveur : au moins un exercice de salle, ou du réalisé). Compter ses séances
 * faites, c'est donc compter les séances de muscu faites — pas besoin d'une
 * activité que `scheduled_workout` ne porte pas. Une séance cochée faite sur le
 * web compte, même sans une série consignée : elle a eu lieu.
 *
 * ## Les muscles : le réalisé, et rien d'autre
 *
 * Mêmes règles que la carte de clôture (`areas.ts`), dont le cœur est partagé
 * (`tallyBodyLoad`) : échauffement, exercice sauté et série sans valeur dehors ;
 * une série compte pour chaque zone de l'exercice. Le statut de la séance n'est
 * pas lu, comme côté serveur (`LoggedSetRepository::workingSetWindow`) : une
 * série consignée est un fait, que la séance soit close ou pas encore.
 */

import type { SetType } from '@/db';

import { tallyBodyLoad, type BodyLoad, type ExerciseAreaBook } from './areas';
import { shiftDate } from './days';
import { isMeasured } from './summary';

/** Aujourd'hui compris : J-6 → J. */
export const WEEK_DAYS = 7;

/** Les bornes de la fenêtre, incluses, au format de `scheduled_workout.date`. */
export function weekBounds(today: string): { from: string; to: string } {
  return { from: shiftDate(today, -(WEEK_DAYS - 1)), to: today };
}

/** Une série consignée de la fenêtre, telle que la lit `weekSetsQuery`. */
export interface WeekSetRow {
  exerciseId: number | null;
  type: SetType;
  reps: number | null;
  durationSeconds: number | null;
}

/** Ce que l'écran affiche. */
export interface WeekGlance {
  from: string;
  to: string;
  /** Séances faites (clôturées ici ou marquées faites sur le web). */
  sessions: number;
  load: BodyLoad;
}

/**
 * La charge par zone des séries de la fenêtre.
 *
 * Les séries se regroupent par exercice avant d'être attribuées : c'est la forme
 * qu'attend `tallyBodyLoad`, et l'ordre de première rencontre départage les
 * zones à égalité.
 */
export function buildWeekLoad(rows: readonly WeekSetRow[], areas: ExerciseAreaBook): BodyLoad {
  const byExercise = new Map<number | null, number>();

  for (const row of rows) {
    if (row.type === 'warmup' || !isMeasured(row)) {
      continue;
    }

    byExercise.set(row.exerciseId, (byExercise.get(row.exerciseId) ?? 0) + 1);
  }

  return tallyBodyLoad(
    [...byExercise.entries()].map(([exerciseId, sets]) => ({ exerciseId, sets })),
    areas,
  );
}
