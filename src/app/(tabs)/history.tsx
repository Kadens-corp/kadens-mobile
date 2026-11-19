import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Button, Card, Chip, EmptyState, hasMuscleLoad, Header, MuscleMap } from '@/components';
import {
  abbrDate,
  feelingLabel,
  longDate,
  targetAreaLabel,
  usePastWorkouts,
  usePreferences,
  useToday,
  useWeekGlance,
  workoutStateLabel,
  type DayWorkout,
  type WeekGlance,
} from '@/session';
import { space, text, themed, useStyles } from '@/theme';

/**
 * Écran « Historique » (KL-37) — la deuxième entrée de la barre basse.
 *
 * Il répond à la question que la bande de jours ne peut pas porter : **qu'est-ce
 * que j'ai fait ces dernières semaines ?** L'écran « Aujourd'hui » s'arrête à
 * J-2, parce qu'au-delà ce n'est plus « aujourd'hui » ; au-delà commence ici.
 *
 * ## Sa portée est celle de la base locale, et il le dit
 *
 * La fenêtre du serveur (J-30 → J+14) fait autorité et remplace en entier ce
 * qu'elle couvre : l'app n'a tout simplement pas de trente-et-unième jour à
 * montrer. Plutôt qu'un écran qui s'arrête sans prévenir, le sur-titre annonce
 * la portée et le pied renvoie au web, où l'historique est complet.
 *
 * ## Ce qu'il n'est pas
 *
 * Un tableau de bord. Aucune courbe, aucun cumul de tonnage : ces lectures-là
 * sont des pages web (KL-49, KL-50), elles supposent le serveur et une vue
 * d'ensemble qu'un téléphone en salle n'a pas à porter. Ici, une séance = une
 * ligne, et on l'ouvre pour relire ce qu'on y a fait.
 *
 * **Une exception, en tête (#131) : les sept derniers jours.** Le nombre de
 * séances de muscu faites et les muscles travaillés, série par muscle, comme à
 * la clôture d'une séance. C'est la seule question d'ensemble qu'on se pose
 * entre deux séances (« qu'est-ce que je n'ai pas travaillé cette semaine ? »),
 * elle tient dans la base locale (`week.ts`), et c'est le pendant de la carte
 * de l'accueil web.
 *
 * ## Une séance close s'ouvre, elle ne se reprend pas
 *
 * §2.3 point 5 : la clôture est terminale. Le bouton dit donc « Voir la séance »
 * et la navigation passe par un `push` direct, **sans `beginWorkout`** — celui
 * de l'écran « Aujourd'hui » n'est là que pour poser `started_at` sur une séance
 * qu'on commence, et il refuserait de toute façon celle-ci.
 */
export default function HistoryScreen() {
  const styles = useStyles(sheets);
  const workouts = usePastWorkouts();
  const today = useToday();
  const week = useWeekGlance(today);

  return (
    <View style={styles.screen}>
      <Header eyebrow="30 derniers jours" title="Historique" />

      <ScrollView contentContainerStyle={styles.page}>
        {workouts.length > 0 ? (
          <>
            <WeekCard glance={week} />
            {workouts.map((workout) => (
              <PastCard key={workout.uuid} workout={workout} />
            ))}
            {/* Le rappel vient après la liste, pas avant : il explique une
                absence qu'on ne constate qu'en arrivant au bout. */}
            <Text style={styles.reach}>
              Cet appareil garde les trente derniers jours. L’historique complet reste sur le site.
            </Text>
          </>
        ) : (
          <EmptyState
            title="Rien derrière toi"
            hint="Une séance apparaît ici une fois clôturée, ou une fois marquée faite depuis le site."
          />
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Les sept derniers jours (`week.ts`) : combien de séances de muscu, et les
 * muscles travaillés avec leurs séries — la carte de clôture, sur la semaine.
 *
 * Toujours rendue au-dessus d'un historique non vide, même à zéro : une semaine
 * sans séance est une réponse, pas une absence. Des séances faites sans une
 * série consignée (cochées sur le web) comptent et ne peignent rien, et la carte
 * le dit au lieu de montrer un corps gris sans explication.
 */
function WeekCard({ glance }: { glance: WeekGlance }) {
  const styles = useStyles(sheets);
  const { silhouette } = usePreferences();
  const { sessions, load } = glance;

  return (
    <Card
      title="7 derniers jours"
      // Le titre de section (19) et la plage de dates en toutes lettres ne
      // tenaient pas ensemble sur un téléphone : le titre se cassait mot par
      // mot. Il descend au pas d'un libellé d'action, qui garde la famille, et
      // les mois s'abrègent (« 29 oct. – 4 nov. »).
      titleStyle={styles.weekTitle}
      right={
        <Text style={styles.weekRange}>
          {abbrDate(glance.from)} – {abbrDate(glance.to)}
        </Text>
      }
    >
      <View style={styles.stack}>
        <View
          accessible
          accessibilityLabel={`${sessions} séance${sessions > 1 ? 's' : ''} de muscu faite${sessions > 1 ? 's' : ''}`}
          style={styles.count}
        >
          <Text style={styles.countValue}>{sessions}</Text>
          <Text style={styles.countLabel}>
            séance{sessions > 1 ? 's' : ''} de muscu faite{sessions > 1 ? 's' : ''}
          </Text>
        </View>

        {hasMuscleLoad(load) ? (
          <MuscleMap load={load} silhouette={silhouette} labelOf={targetAreaLabel} height={200} />
        ) : (
          <Text style={styles.caption}>
            {sessions > 0
              ? 'Aucune série consignée sur la période : les muscles se lisent sur le réalisé.'
              : 'Rien de fait ces sept derniers jours.'}
          </Text>
        )}
      </View>
    </Card>
  );
}

/**
 * Une séance passée.
 *
 * Aucun bouton primaire : relire n'est jamais urgent, et un écran de rouges qui
 * se répètent ne dirait plus rien (règle 2). C'est la même carte que celle de
 * l'écran « Aujourd'hui », à l'action près — d'où le titre en date : ici la date
 * est l'information qui distingue deux lignes, pas le plan.
 */
function PastCard({ workout }: { workout: DayWorkout }) {
  const styles = useStyles(sheets);
  const state = workoutStateLabel(workout);
  // La teinte se lit sur le **statut**, pas sur `state.done` : une séance que le
  // serveur donne pour faite mais qu'on vient de rouvrir ici s'annonce « En
  // cours », et le rouge de l'échec n'a rien à y faire (règle 2).
  const tone = state.done ? 'done' : workout.status === 'missed' ? 'missed' : 'planned';

  return (
    <Card title={longDate(workout.date)} right={<Chip label={state.label} tone={tone} dot />}>
      <View style={styles.stack}>
        {/* Un nom saisi : Barlow, casse normale (règle 4). */}
        <Text style={styles.name}>{workout.title ?? 'Séance libre'}</Text>

        <View style={styles.marks}>
          {workout.loggedSets > 0 ? (
            <Text style={styles.caption}>
              {workout.loggedSets} série{workout.loggedSets > 1 ? 's' : ''} consignée
              {workout.loggedSets > 1 ? 's' : ''}
            </Text>
          ) : (
            // Une sortie course ou vélo n'a pas de séries : le réalisé du cardio
            // se résume à son statut (§0.2). L'absence se dit, elle ne se laisse
            // pas lire comme un oubli.
            <Text style={styles.caption}>Aucune série consignée</Text>
          )}
          {/* Le ressenti, en marque de lecture : on parcourt l'historique pour
              savoir comment ça s'est passé, pas seulement si ça a eu lieu. */}
          {workout.feeling !== null ? <Chip label={feelingLabel(workout.feeling) ?? ''} /> : null}
          {workout.sessionRpe !== null ? (
            <Chip label={`Difficulté ${workout.sessionRpe}/10`} tone="accent" />
          ) : null}
          {workout.pendingSync ? <Chip label="À synchroniser" /> : null}
        </View>

        <Button
          label="Voir la séance"
          variant="ghost"
          onPress={() => router.push(`/session/${workout.uuid}`)}
        />
      </View>
    </Card>
  );
}

const sheets = themed((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  // Pas de dégagement pour la barre basse : `TabSlot` rend l'écran **au-dessus**
  // d'elle, elle ne le recouvre pas. C'est la différence avec le web, où la
  // barre est `fixed` et où `.kd-page` doit lui réserver sa hauteur.
  page: { padding: space[8], gap: space[8] },
  stack: { gap: space[6] },
  marks: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[3] },
  name: { ...text.name, color: c.text },
  caption: { ...text.caption, color: c.textSecondary },
  weekTitle: { ...text.action, flexShrink: 0 },
  weekRange: { ...text.caption, color: c.textSecondary, flexShrink: 1, textAlign: 'right' },
  count: { flexDirection: 'row', alignItems: 'baseline', gap: space[4] },
  countValue: { ...text.kpi, color: c.text },
  countLabel: { ...text.body, color: c.textSecondary, flexShrink: 1 },
  reach: { ...text.caption, color: c.textSecondary, textAlign: 'center' },
}));
