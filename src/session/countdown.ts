/**
 * Le décompte du repos hors de l'app : la face JS de `modules/rest-countdown`.
 *
 * Le module natif est **facultatif** (`requireOptionalNativeModule`) : il
 * n'existe ni sous Jest, ni dans le rendu web, ni dans un dev client compilé
 * avant son arrivée. Dans les trois cas, le repos doit tourner exactement comme
 * avant, sans décompte dans le volet. Le confort se perd, la fonction non.
 *
 * Ce fichier ne décide rien : `rest.ts` choisit quand montrer et quoi écrire.
 */

import { requireOptionalNativeModule } from 'expo';

interface RestCountdownModule {
  show(endsAt: number, title: string, body: string, channelId: string): boolean;
  hide(): void;
}

const native = requireOptionalNativeModule<RestCountdownModule>('RestCountdown');

export interface RestCountdown {
  /** L'échéance, en millisecondes epoch : le système en tire le décompte. */
  endsAt: number;
  title: string;
  body: string;
  channelId: string;
}

/** Affiche le décompte. Rend `false` s'il ne s'affiche pas, quelle qu'en soit la raison. */
export function showRestCountdown({ endsAt, title, body, channelId }: RestCountdown): boolean {
  try {
    return native?.show(endsAt, title, body, channelId) ?? false;
  } catch {
    return false;
  }
}

/** Retire le décompte, s'il y en a un. Sans effet sinon. */
export function hideRestCountdown(): void {
  try {
    native?.hide();
  } catch {
    // Rien à retirer, ou le contexte natif est parti : il n'y a rien à faire.
  }
}
