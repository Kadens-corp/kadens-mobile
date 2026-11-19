/**
 * La bande de jours de l'écran « Aujourd'hui », et ses deux règles : elle glisse
 * jusqu'au bord de ce que le téléphone sait, jamais plus loin, et jamais moins
 * que J-2 → J+2.
 *
 * Au-delà de la fenêtre synchronisée, une case vide affirmerait « rien de
 * prévu » sur un jour que le pull n'a pas couvert. C'est ce que ces tests
 * gardent.
 */

import { abbrDate, dayTitle, dayWindow, VISIBLE_DAYS } from '@/session';

const TODAY = '2026-11-15';

describe('dayWindow', () => {
  it('montre J-2 → J+2 tant qu’aucun pull n’a abouti', () => {
    const cells = dayWindow(TODAY);

    expect(cells.map((cell) => cell.date)).toEqual([
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
    ]);
    expect(cells).toHaveLength(VISIBLE_DAYS);
    expect(dayWindow(TODAY, { from: null, to: null })).toEqual(cells);
  });

  it('s’étend sur toute la fenêtre du dernier pull', () => {
    const cells = dayWindow(TODAY, { from: '2026-10-16', to: '2026-11-29' });

    expect(cells[0]).toMatchObject({ date: '2026-10-16', offset: -30 });
    expect(cells[cells.length - 1]).toMatchObject({ date: '2026-11-29', offset: 14 });
    expect(cells).toHaveLength(45);
  });

  it('garde J-2 → J+2 comme plancher quand la fenêtre a vieilli', () => {
    // Dernier pull il y a trois semaines : la fenêtre s'arrête au 8 novembre.
    const cells = dayWindow(TODAY, { from: '2026-09-25', to: '2026-11-08' });

    expect(cells[0].date).toBe('2026-09-25');
    expect(cells[cells.length - 1]).toMatchObject({ date: '2026-11-17', offset: 2 });
  });

  it('traverse les fins de mois et d’année sans trou ni doublon', () => {
    const cells = dayWindow('2026-12-30', { from: '2026-12-28', to: '2027-01-03' });

    expect(cells.map((cell) => cell.date)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    expect(cells.map((cell) => cell.dayOfMonth)).toEqual(['28', '29', '30', '31', '1', '2', '3']);
  });
});

describe('dayTitle', () => {
  it('dit hier, aujourd’hui et demain', () => {
    expect(dayTitle('2026-11-14', TODAY)).toBe('Hier');
    expect(dayTitle(TODAY, TODAY)).toBe("Aujourd'hui");
    expect(dayTitle('2026-11-16', TODAY)).toBe('Demain');
  });

  it('nomme le jour de la semaine tant qu’il n’est pas ambigu', () => {
    // Le 15 novembre 2026 est un dimanche.
    expect(dayTitle('2026-11-21', TODAY)).toBe('samedi');
    expect(dayTitle('2026-11-09', TODAY)).toBe('lundi');
  });

  it('passe à la date au-delà d’une semaine', () => {
    expect(dayTitle('2026-11-22', TODAY)).toBe('22 novembre');
    expect(dayTitle('2026-11-08', TODAY)).toBe('8 novembre');
  });
});

describe('abbrDate', () => {
  it('abbreviates the long months and keeps the short ones whole', () => {
    expect(abbrDate('2026-10-29')).toBe('29 oct.');
    expect(abbrDate('2026-11-04')).toBe('4 nov.');
    expect(abbrDate('2026-02-01')).toBe('1 févr.');
    expect(abbrDate('2026-05-12')).toBe('12 mai');
    expect(abbrDate('2026-08-15')).toBe('15 août');
  });
});
