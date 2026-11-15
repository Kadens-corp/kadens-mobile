/**
 * Le décompte du repos hors de l'app : quand il part au volet, et quand il en
 * revient.
 *
 * Le module natif n'existe pas sous Jest ; c'est son enveloppe (`countdown.ts`)
 * qu'on remplace, pour vérifier ce que `rest.ts` lui demande. La règle gardée
 * ici : le décompte n'est montré **que** hors de l'app et **que** pendant un
 * repos qui court — jamais en même temps que la barre, jamais pour un repos
 * fini.
 */

import { AppState, type AppStateStatus } from 'react-native';

import { hideRestCountdown, showRestCountdown } from '../countdown';
import { setRestUpNext, startRest, stopRest } from '../rest';

jest.mock('../countdown', () => ({
  showRestCountdown: jest.fn(() => true),
  hideRestCountdown: jest.fn(),
}));

const show = jest.mocked(showRestCountdown);
const hide = jest.mocked(hideRestCountdown);

let listeners: ((next: AppStateStatus) => void)[] = [];

function moveTo(next: AppStateStatus): void {
  listeners.forEach((listener) => listener(next));
}

beforeEach(() => {
  jest.useFakeTimers();
  listeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener as (next: AppStateStatus) => void);

    return {
      remove: () => {
        listeners = listeners.filter((other) => other !== listener);
      },
    };
  });
});

afterEach(() => {
  stopRest();
  setRestUpNext(null);
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('le décompte hors de l’app', () => {
  it('part au volet quand l’app quitte l’écran pendant un repos', () => {
    jest.setSystemTime(new Date('2026-11-15T10:00:00Z'));
    setRestUpNext('Développé couché');
    startRest(90);

    moveTo('background');

    expect(show).toHaveBeenCalledWith({
      endsAt: new Date('2026-11-15T10:01:30Z').getTime(),
      title: 'Repos',
      body: 'À suivre : Développé couché',
      channelId: 'rest-countdown',
    });
  });

  it('dit qu’il n’y a plus rien à cocher quand la séance est au bout', () => {
    startRest(60);

    moveTo('background');

    expect(show).toHaveBeenCalledWith(expect.objectContaining({ body: 'Plus rien à cocher' }));
  });

  it('se retire au retour dans l’app, où la barre reprend la main', () => {
    startRest(60);
    moveTo('background');
    hide.mockClear();

    moveTo('active');

    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('ne montre rien pour un repos déjà fini', () => {
    startRest(30);
    jest.setSystemTime(Date.now() + 31_000);

    moveTo('background');

    expect(show).not.toHaveBeenCalled();
  });

  it('ne montre rien sans repos, et se retire quand on le passe', () => {
    startRest(60);
    stopRest();

    moveTo('background');

    expect(show).not.toHaveBeenCalled();
    expect(hide).toHaveBeenCalled();
  });
});
