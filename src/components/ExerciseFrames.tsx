/**
 * Les images d'un exercice, jouées en fondu enchaîné pour montrer le mouvement
 * (typiquement le début, puis la fin). Le pendant du lecteur de la fiche web
 * (`exercise_frames_controller.js`), avec la même règle de superposition : chaque
 * image arrive **par-dessus** la précédente, qui reste opaque dessous le temps
 * du fondu. Un fondu croisé simple laisserait voir le fond à mi-chemin, l'image
 * clignoterait.
 *
 * Toutes les images restent montées, empilées, chacune avec son opacité :
 * passer de l'une à l'autre ne recharge rien, et seule l'opacité de celle qui
 * arrive bouge (pilote natif).
 *
 * ## Un mouvement de plus, hors de la liste de `motion.ts`
 *
 * Ce n'est pas un accusé de réception mais le contenu lui-même : on ouvre la
 * feuille pour voir bouger l'exercice. Il garde les deux règles qui comptent :
 * il ne touche que l'opacité, et **« Réduire les animations » l'arrête** — rien
 * ne démarre seul, le changement d'image est sec, et les pastilles font avancer
 * à la main. Lecture/pause reste offert : relancer est alors un choix.
 *
 * Les URL sont signées côté serveur, chargées sans jeton par `expo-image`, avec
 * le cache disque : préchargées à l'ouverture de la séance
 * (`prefetchExerciseImages`), elles se lisent ensuite sans réseau.
 */

import { Image } from 'expo-image';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { layout, space, themed, useColors, useReducedMotion, useStyles } from '@/theme';

import { Icon } from './Icon';

/** Le temps de pose d'une image, fondu compris. Le même que le web. */
const HOLD_MS = 1400;
const FADE_MS = 600;

export type ExerciseFramesProps = {
  images: string[];
  /** Le nom affiché de l'exercice, pour les libellés d'accessibilité. */
  name: string;
};

/**
 * Met en cache disque les images d'une séance tant qu'il y a du réseau : à la
 * salle, au sous-sol, la feuille les retrouve. Un échec n'est pas une erreur,
 * la feuille retentera en s'ouvrant.
 */
export function prefetchExerciseImages(urls: string[]): void {
  if (urls.length > 0) {
    Image.prefetch(urls, 'disk').catch(() => undefined);
  }
}

export function ExerciseFrames({ images, name }: ExerciseFramesProps) {
  // Une nouvelle liste (un pull a ajouté ou retiré une image) repart de zéro :
  // les opacités sont créées une fois par liste, à sa taille.
  return <Frames key={images.join('\n')} images={images} name={name} />;
}

function Frames({ images, name }: ExerciseFramesProps) {
  const styles = useStyles(sheet);
  const colors = useColors();
  const reduced = useReducedMotion();
  const animated = images.length > 1;

  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  // `null` tant que personne n'a choisi : la lecture suit alors le réglage
  // système, lu de façon asynchrone (voir `motion.ts`).
  const [choice, setChoice] = useState<boolean | null>(null);
  const playing = animated && (choice ?? !reduced);

  const current = useRef(0);
  // **Une opacité par image, chacune sur sa propre vue, montée une fois.** Une
  // seule valeur promenée d'une image à l'autre changerait de vue à chaque
  // étape, et le pilote natif la garderait accrochée à la vue démontée. Un
  // état et non une ref : elles se lisent au rendu.
  const [opacities] = useState(() => images.map((_, i) => new Animated.Value(i === 0 ? 1 : 0)));

  const go = useCallback((next: number) => {
    if (next === current.current) {
      return;
    }
    setPrevious(current.current);
    current.current = next;
    setIndex(next);
  }, []);

  // Avant la peinture : l'image qui arrive repart de transparent par-dessus la
  // précédente, qui reste opaque dessous ; les autres s'éteignent.
  useLayoutEffect(() => {
    if (previous === null) {
      return;
    }
    opacities.forEach((opacity, i) => {
      if (i !== index) {
        opacity.setValue(i === previous ? 1 : 0);
      }
    });
    opacities[index].setValue(reduced ? 1 : 0);
    if (!reduced) {
      Animated.timing(opacities[index], {
        toValue: 1,
        duration: FADE_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [index, previous, reduced, opacities]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = setInterval(() => go((current.current + 1) % images.length), HOLD_MS);

    return () => clearInterval(timer);
  }, [playing, images.length, go]);

  return (
    <View style={styles.frame}>
      <View
        style={styles.stage}
        accessible
        accessibilityRole="image"
        accessibilityLabel={
          animated
            ? `Mouvement de ${name}, étape ${index + 1} sur ${images.length}`
            : `Mouvement de ${name}`
        }
      >
        {images.map((uri, i) => (
          <Animated.View
            key={uri}
            style={[
              StyleSheet.absoluteFill,
              { opacity: opacities[i], zIndex: i === index ? 2 : i === previous ? 1 : 0 },
            ]}
          >
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="disk"
            />
          </Animated.View>
        ))}
      </View>

      {animated ? (
        <View style={styles.controls}>
          <Pressable
            onPress={() => setChoice(!playing)}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Mettre en pause' : 'Lecture en boucle'}
            style={styles.toggle}
            hitSlop={space[2]}
          >
            <Icon name={playing ? 'pause' : 'play'} size={18} color={colors.text} />
          </Pressable>
          {images.map((uri, i) => (
            <Pressable
              key={uri}
              onPress={() => {
                setChoice(false);
                go(i);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Étape ${i + 1}`}
              accessibilityState={{ selected: i === index }}
              style={styles.dotTarget}
            >
              <View style={[styles.dot, i === index && styles.dotOn]} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const sheet = themed((c) => ({
  frame: { gap: space[4] },
  stage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: c.fill,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  toggle: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  dotTarget: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderWidth: 1, borderColor: c.textSecondary },
  dotOn: { backgroundColor: c.text, borderColor: c.text },
}));
