/**
 * Le lecteur des images d'un exercice (`ExerciseFrames`), vérifié au rendu.
 *
 * Le fondu lui-même se voit sur un téléphone. Ce qui se vérifie ici, c'est ce
 * qu'il annonce et ce qu'on peut en faire sans le voir : l'étape affichée dite
 * à TalkBack, les pastilles qui y mènent, la pause, et l'absence de commandes
 * pour une image seule — il n'y a rien à jouer.
 */

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ExerciseFrames } from '@/components';

const IMAGES = [
  'https://kadens.test/media/exercise/1/a.jpg',
  'https://kadens.test/media/exercise/1/b.jpg',
];

afterEach(() => {
  jest.useRealTimers();
});

describe('ExerciseFrames', () => {
  it('une seule image : affichée, sans commande', async () => {
    await render(<ExerciseFrames images={IMAGES.slice(0, 1)} name="Squat" />);

    expect(screen.getByLabelText('Mouvement de Squat')).toBeTruthy();
    expect(screen.queryByLabelText('Étape 1')).toBeNull();
    expect(screen.queryByLabelText('Mettre en pause')).toBeNull();
  });

  it('enchaîne les étapes seul, et une pastille arrête sur la sienne', async () => {
    jest.useFakeTimers();
    await render(<ExerciseFrames images={IMAGES} name="Squat" />);

    expect(screen.getByLabelText('Mouvement de Squat, étape 1 sur 2')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1400);
    });
    expect(screen.getByLabelText('Mouvement de Squat, étape 2 sur 2')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Étape 1'));
    expect(screen.getByLabelText('Mouvement de Squat, étape 1 sur 2')).toBeTruthy();
    // Choisir une étape, c'est vouloir la regarder : la boucle s'arrête.
    expect(screen.getByLabelText('Lecture en boucle')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.getByLabelText('Mouvement de Squat, étape 1 sur 2')).toBeTruthy();
  });

  it('se met en pause et repart', async () => {
    jest.useFakeTimers();
    await render(<ExerciseFrames images={IMAGES} name="Squat" />);

    await fireEvent.press(screen.getByLabelText('Mettre en pause'));
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.getByLabelText('Mouvement de Squat, étape 1 sur 2')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Lecture en boucle'));
    await act(async () => {
      jest.advanceTimersByTime(1400);
    });
    expect(screen.getByLabelText('Mouvement de Squat, étape 2 sur 2')).toBeTruthy();
  });
});
