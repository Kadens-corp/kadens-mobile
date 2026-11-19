import { useMemo } from 'react';
import { Text, View } from 'react-native';

import type { BodySilhouette, TargetArea } from '@/db';
import { layout, space, text, themed, useStyles } from '@/theme';

import { BODY_FILLS, BodyMap, type BodyLevel } from './BodyMap';

/**
 * La silhouette et sa légende chiffrée : ce que la clôture d'une séance et le
 * haut de l'historique (sept derniers jours) peignent de la même façon.
 *
 * Le composant ne compte rien. Il reçoit une charge déjà calculée par
 * `@/session` (`buildBodyLoad`, `buildWeekLoad`) et les libellés de zone par
 * `labelOf`, pour la même raison que `BodyMap` : décider de ce qui est fait est
 * du domaine, le peindre est du rendu.
 *
 * ## Le dessin est une aide, la légende est la source
 *
 * Trois nuances de rouge ne se comptent pas à l'œil et ne survivent pas à un
 * daltonisme : **chaque zone est écrite, chiffrée et ordonnée** sous la carte,
 * du plus chargé au moins chargé. Ce qui sort du dessin (« corps entier », une
 * zone inconnue) se dit en pied, jamais ne s'escamote.
 */

/** La forme de charge que la carte sait peindre. `BodyLoad` (`@/session`) la remplit. */
export interface MuscleMapLoad {
  areas: readonly { area: TargetArea; sets: number; percent: number; level: BodyLevel }[];
  fullBody: number;
  unmapped: number;
}

export interface MuscleMapProps {
  load: MuscleMapLoad;
  silhouette: BodySilhouette;
  labelOf: (area: TargetArea) => string;
  /** Hauteur d'une planche. Défaut de `BodyMap`. */
  height?: number;
}

/** Vrai quand la charge a quelque chose à dire, dans le dessin ou en pied. */
export function hasMuscleLoad(load: MuscleMapLoad): boolean {
  return load.areas.length > 0 || load.fullBody > 0 || load.unmapped > 0;
}

export function MuscleMap({ load, silhouette, labelOf, height }: MuscleMapProps) {
  const styles = useStyles(sheets);
  // Les teintes du dessin, pas des pastilles à part : une légende dont les
  // couleurs ne seraient pas exactement celles de la carte ne serait pas une
  // légende. L'échelle s'inverse de nuit, les deux suivent ensemble.
  const fills = useStyles(BODY_FILLS);
  const levels = useMemo(
    () => new Map<TargetArea, BodyLevel>(load.areas.map((area) => [area.area, area.level])),
    [load],
  );

  const aside = [
    load.fullBody > 0 ? `${sets(load.fullBody)} corps entier` : null,
    load.unmapped > 0 ? `${sets(load.unmapped)} sans zone déclarée` : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');

  return (
    <View style={styles.stack}>
      <BodyMap levels={levels} silhouette={silhouette} height={height} />

      {load.areas.map((area) => (
        <View
          key={area.area}
          accessible
          accessibilityLabel={`${labelOf(area.area)} : ${sets(area.sets)}, ${area.percent} %`}
          style={styles.areaRow}
        >
          <View style={[styles.areaDot, { backgroundColor: fills[area.level] }]} />
          <Text style={styles.name} numberOfLines={1}>
            {labelOf(area.area)}
          </Text>
          <View style={styles.spacer} />
          <Text style={styles.areaValue}>{area.sets}</Text>
          <Text style={styles.areaShare}>{Math.round(area.percent)} %</Text>
        </View>
      ))}

      {aside.length > 0 ? <Text style={styles.caption}>+ {aside}</Text> : null}
    </View>
  );
}

/** « 1 série », « 4 séries ». Le pluriel se pose une fois. */
function sets(count: number): string {
  return `${count} série${count > 1 ? 's' : ''}`;
}

const sheets = themed((c) => ({
  stack: { gap: space[4] },
  spacer: { flex: 1 },
  name: { ...text.name, color: c.text, flexShrink: 1 },
  caption: { ...text.caption, color: c.textSecondary },

  // Une ligne de légende. La pastille reprend la teinte du dessin ; elle est
  // bordée, sinon le palier le plus clair s'effacerait sur le papier — et elle ne
  // porte aucune information que la ligne n'écrive déjà.
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  areaDot: {
    width: space[5],
    height: space[5],
    borderWidth: layout.hairline,
    borderColor: c.borderStrong,
  },
  areaValue: { ...text.numeric, color: c.text },
  // Une part se lit en second : c'est le rang qui compte, pas le pourcent exact.
  areaShare: { ...text.numeric, color: c.textSecondary, minWidth: 44, textAlign: 'right' },
}));
