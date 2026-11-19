/**
 * Les sept derniers jours de l'historique (#131), vérifiés sur ce qui les fait
 * entrer : la fenêtre J-6 → J, les séances faites, et les muscles lus sur le
 * réalisé avec les règles de la clôture.
 *
 * La base est posée par un vrai pull (`seedBootstrap`), puis lue par les deux
 * requêtes de l'écran et le calcul pur qui les croise — exactement le chemin de
 * `useWeekGlance`, sans React.
 */

import type { LoggedSetPayload } from '@/api';
import type { SetType } from '@/db';
import {
  beginWorkout,
  buildWeekLoad,
  checkSet,
  closeWorkout,
  weekBounds,
  weekDoneCountQuery,
  weekSetsQuery,
  type ExerciseAreaBook,
} from '@/session';
import { resetDatabase } from '@/test/database';
import {
  dayFromNow,
  exercisePayload,
  loggedExercise,
  scheduledWorkout,
  seedBootstrap,
  today,
} from '@/test/fixtures';
import { exerciseAt, nextLine } from '@/test/program';

const TODAY = '01890000-0000-7000-8000-0000000004a1';
const EDGE = '01890000-0000-7000-8000-0000000004a2';
const OUTSIDE = '01890000-0000-7000-8000-0000000004a3';
const MISSED = '01890000-0000-7000-8000-0000000004a4';
const PLANNED = '01890000-0000-7000-8000-0000000004a5';
const WEB_DONE = '01890000-0000-7000-8000-0000000004a6';

let nextSet = 0;

function set(type: SetType, reps: number | null): LoggedSetPayload {
  nextSet += 1;

  return {
    uuid: `01890000-0000-7000-8000-${String(nextSet).padStart(12, '0')}`,
    position: nextSet,
    type,
    reps,
    weightKg: 60,
    durationSeconds: null,
    rpe: null,
    completedAt: '2026-08-04T08:00:00Z',
  };
}

const AREAS: ExerciseAreaBook = new Map([
  [101, ['chest', 'triceps']],
  [102, ['quadriceps']],
]);

beforeEach(() => {
  resetDatabase();
});

function glance() {
  const { from, to } = weekBounds(today());
  const rows = weekSetsQuery(from, to).all();

  return {
    sessions: weekDoneCountQuery(from, to).all()[0]?.total ?? 0,
    load: buildWeekLoad(rows, AREAS),
  };
}

describe('weekBounds', () => {
  it('couvre aujourd’hui et les six jours d’avant', () => {
    expect(weekBounds('2026-11-19')).toEqual({ from: '2026-11-13', to: '2026-11-19' });
    // Le changement de mois et d'année ne décale rien.
    expect(weekBounds('2027-01-03')).toEqual({ from: '2026-12-28', to: '2027-01-03' });
  });
});

describe('les sept derniers jours', () => {
  it('comptent les séances faites et peignent les séries de travail mesurées', () => {
    seedBootstrap({
      exercises: [
        exercisePayload(101, { targetAreas: ['chest', 'triceps'] }),
        exercisePayload(102, { targetAreas: ['quadriceps'] }),
      ],
      schedule: [
        // Aujourd'hui : un échauffement et une série à zéro répétition, qui
        // n'entrent ni l'un ni l'autre dans le dessin.
        scheduledWorkout(TODAY, {
          status: 'done',
          log: [
            loggedExercise({
              sets: [set('warmup', 10), set('normal', 8), set('normal', 8), set('normal', 0)],
            }),
          ],
        }),
        // J-6, le bord de la fenêtre : dedans.
        scheduledWorkout(EDGE, {
          date: dayFromNow(-6),
          status: 'done',
          log: [
            loggedExercise({
              exerciseId: 102,
              sets: [set('normal', 5), set('normal', 5), set('normal', 5)],
            }),
          ],
        }),
        // J-7 : dehors, séance comme séries.
        scheduledWorkout(OUTSIDE, {
          date: dayFromNow(-7),
          status: 'done',
          log: [loggedExercise({ exerciseId: 102, sets: [set('normal', 5)] })],
        }),
        scheduledWorkout(MISSED, { date: dayFromNow(-3), status: 'missed' }),
        scheduledWorkout(PLANNED, { date: dayFromNow(-2) }),
        // Cochée faite sur le web, sans une série : elle compte, et ne peint rien.
        scheduledWorkout(WEB_DONE, { date: dayFromNow(-1), status: 'done' }),
      ],
    });

    const { sessions, load } = glance();

    expect(sessions).toBe(3);
    expect(load.areas.map(({ area, sets }) => [area, sets])).toEqual([
      ['quadriceps', 3],
      ['chest', 2],
      ['triceps', 2],
    ]);
    // Le palier est relatif au plus chargé de la semaine, comme à la clôture.
    expect(load.areas.map(({ level }) => level)).toEqual([3, 2, 2]);
    expect(load.unmapped).toBe(0);
  });

  it('suivent une séance menée ici, série après série, puis sa clôture', () => {
    seedBootstrap({ schedule: [scheduledWorkout(TODAY)] });

    beginWorkout(TODAY);
    checkSet(TODAY, exerciseAt(TODAY), nextLine(exerciseAt(TODAY)));

    // Une série consignée est un fait, que la séance soit close ou pas encore :
    // le dessin la montre déjà, le compte de séances attend la clôture.
    expect(glance().load.areas.map(({ area, sets }) => [area, sets])).toEqual([
      ['chest', 1],
      ['triceps', 1],
    ]);
    expect(glance().sessions).toBe(0);

    closeWorkout(TODAY, '');

    expect(glance().sessions).toBe(1);
  });

  it('disent ce qu’aucune zone ne reçoit', () => {
    seedBootstrap({
      exercises: [exercisePayload(101), exercisePayload(103, { targetAreas: [] })],
      schedule: [
        scheduledWorkout(TODAY, {
          status: 'done',
          log: [
            // Un exercice sans zone déclarée, et un autre sorti de la bibliothèque.
            loggedExercise({ exerciseId: 103, sets: [set('normal', 8), set('normal', 8)] }),
            loggedExercise({ exerciseId: null, position: 1, sets: [set('normal', 8)] }),
          ],
        }),
      ],
    });

    const { from, to } = weekBounds(today());
    const load = buildWeekLoad(weekSetsQuery(from, to).all(), new Map([[103, []]]));

    expect(load.areas).toEqual([]);
    expect(load.unmapped).toBe(3);
  });
});
