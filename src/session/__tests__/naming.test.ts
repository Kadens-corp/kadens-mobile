/**
 * Le libellé d'un exercice : les deux langues, les trois replis, et ce que la
 * recherche doit trouver.
 *
 * Ce fichier tient la parité avec le serveur (`tests/Service/ExerciseNamingTest.php`) :
 * mêmes règles, mêmes replis, mêmes conséquences. Une divergence ferait afficher
 * au téléphone un autre nom que le web pour la même donnée — et comme c'est le
 * même compte, elle se lirait comme un bug de synchronisation.
 */

import type { LoggedExerciseRow } from '@/db';
import {
  alternateName,
  buildProgram,
  exerciseLabel,
  exerciseNameBook,
  exerciseSearchText,
  searchExercises,
  stem,
  toOptions,
  type ExerciseRowForOption,
} from '@/session';
import { prescribedBlock, prescribedExercise } from '@/test/fixtures';

const CHIN_UP = { name: 'Traction en supination', nameEn: 'Chin-up' };
/** Le français EST déjà l'anglais : pas de second libellé, et c'est voulu. */
const DIPS = { name: 'Dips', nameEn: null };

function option(overrides: Partial<ExerciseRowForOption> = {}): ExerciseRowForOption {
  return {
    id: 1,
    name: 'Développé couché',
    nameEn: 'Bench press',
    global: true,
    activity: 'gym',
    targetAreas: ['chest'],
    ...overrides,
  };
}

function loggedRow(overrides: Partial<LoggedExerciseRow> = {}): LoggedExerciseRow {
  return {
    id: 1,
    scheduledUuid: 'uuid',
    exerciseId: 101,
    exerciseName: 'Traction en supination',
    sourcePrescribedId: 1,
    position: 0,
    skipped: false,
    notes: null,
    ...overrides,
  };
}

describe('le libellé', () => {
  it('suit la langue demandée', () => {
    expect(exerciseLabel(CHIN_UP, 'fr')).toBe('Traction en supination');
    expect(exerciseLabel(CHIN_UP, 'en')).toBe('Chin-up');
  });

  it('retombe sur le français quand il n’y a pas de nom anglais', () => {
    expect(exerciseLabel(DIPS, 'en')).toBe('Dips');
  });

  it('ne montre un second libellé que s’il en existe un autre', () => {
    expect(alternateName(CHIN_UP, 'fr')).toBe('Chin-up');
    expect(alternateName(CHIN_UP, 'en')).toBe('Traction en supination');
    expect(alternateName(DIPS, 'fr')).toBeNull();
  });

  it('cherche sur les deux noms, sans les répéter', () => {
    expect(exerciseSearchText(CHIN_UP)).toBe('Traction en supination Chin-up');
    expect(exerciseSearchText(DIPS)).toBe('Dips');
  });
});

describe('la bibliothèque affichée', () => {
  it('trouve un exercice tapé dans la langue qui n’est pas affichée', () => {
    const library = toOptions([option()], 'fr');

    expect(searchExercises(library, 'bench press').map((row) => row.name)).toEqual([
      'Développé couché',
    ]);
    expect(searchExercises(library, 'developpe')).toHaveLength(1);
  });

  it('classe sur le nom affiché, pas sur le français', () => {
    const rows = [
      option({ id: 1, name: 'Squat', nameEn: 'Zercher squat' }),
      option({ id: 2, name: 'Traction', nameEn: 'Ab wheel' }),
    ];

    expect(toOptions(rows, 'fr').map((row) => row.name)).toEqual(['Squat', 'Traction']);
    // Le même jeu, lu en anglais, se classe dans l'autre sens : trier sur le
    // français donnerait une liste dont l'ordre ne correspond à rien à l'écran.
    expect(toOptions(rows, 'en').map((row) => row.name)).toEqual(['Ab wheel', 'Zercher squat']);
  });
});

/**
 * La tolérance au pluriel et aux mots soudés (#14), en parité avec le web
 * (kadens#98, `assets/search.js`) : on tape naturellement « tractions », et une
 * liste vide fait croire l'exercice absent.
 */
describe('la recherche tolérante', () => {
  const library = toOptions(
    [
      option({ id: 1, name: 'Traction', nameEn: 'Pull-up' }),
      option({ id: 2, name: 'Traction en supination', nameEn: 'Chin-up' }),
      option({ id: 3, name: 'Tirage vertical', nameEn: 'Lat pulldown' }),
      option({ id: 4, name: 'Pompes', nameEn: 'Push-up' }),
      option({ id: 5, name: 'Pompes diamant', nameEn: 'Diamond push-up' }),
      option({ id: 6, name: 'Os du pied', nameEn: null }),
      option({ id: 7, name: 'Squat 4x', nameEn: null }),
      // Avant « Traction » dans l'alphabet : c'est lui qui sortirait en tête si
      // le palier « commence par » ne regardait que le terme brut.
      option({ id: 8, name: 'Assistance à la traction', nameEn: 'Assisted pull-up' }),
    ],
    'fr',
  );
  const names = (term: string) => searchExercises(library, term).map((row) => row.name);

  it('retire la marque du pluriel, avec les garde-fous du web', () => {
    expect(stem('tractions')).toBe('traction');
    expect(stem('pompes')).toBe('pompe');
    expect(stem('ups')).toBe('up');
    // Un mot qui n'est pas fait de lettres, ou qui tomberait sous deux lettres, reste tel quel.
    expect(stem('4x')).toBe('4x');
    expect(stem('os')).toBe('os');
  });

  it('trouve au pluriel ce qui est écrit au singulier, et le classe en tête', () => {
    // « Traction » commence par « traction », le singulier du terme : il passe
    // devant comme si on avait tapé « traction ».
    expect(names('tractions')).toEqual([
      'Traction',
      'Traction en supination',
      'Assistance à la traction',
    ]);
    expect(names('tractions')).toEqual(names('traction'));
  });

  it('trouve un mot soudé dans un nom à trait d’union', () => {
    expect(names('pullups')).toEqual(['Assistance à la traction', 'Traction']);
    expect(names('pushup')).toEqual(['Pompes', 'Pompes diamant']);
  });

  it('garde le singulier écrit au pluriel, et le pluriel tapé tel quel', () => {
    expect(names('pompe')).toEqual(['Pompes', 'Pompes diamant']);
    expect(names('pompes')).toEqual(['Pompes', 'Pompes diamant']);
  });

  it('ne réduit ni un chiffre ni un mot de deux lettres', () => {
    expect(names('4x')).toEqual(['Squat 4x']);
    expect(names('os')).toEqual(['Os du pied']);
  });
});

describe('le déroulé de séance', () => {
  const blocks = [prescribedBlock(1, [prescribedExercise(1, { exerciseId: 101 })])];
  const book = (language: 'fr' | 'en') => exerciseNameBook([{ id: 101, ...CHIN_UP }], language);

  it('écrit le nom vivant de la bibliothèque, pas celui que le programme transporte', () => {
    // Le programme descend « Exercice 101 » (le nom au moment du pull) ; la
    // bibliothèque, elle, dit comment il s'appelle aujourd'hui, dans ma langue.
    const program = buildProgram(blocks, [], [], book('en'));

    expect(program.blocks[0].groups[0].exercises[0].name).toBe('Chin-up');
  });

  it('préfère le nom vivant au snapshot du réalisé', () => {
    const program = buildProgram(blocks, [loggedRow()], [], book('en'));

    expect(program.blocks[0].groups[0].exercises[0].name).toBe('Chin-up');
  });

  it('retombe sur le nom transporté quand l’exercice a quitté la bibliothèque', () => {
    const program = buildProgram(blocks, [loggedRow()], [], exerciseNameBook([], 'en'));

    // Le snapshot est la seule chose qui reste : c'est sa raison d'être.
    expect(program.blocks[0].groups[0].exercises[0].name).toBe('Exercice 101');
  });

  it('lit un exercice hors programme sur la bibliothèque, lui aussi', () => {
    const program = buildProgram([], [loggedRow({ sourcePrescribedId: null })], [], book('en'));

    expect(program.extras[0].name).toBe('Chin-up');
  });
});
