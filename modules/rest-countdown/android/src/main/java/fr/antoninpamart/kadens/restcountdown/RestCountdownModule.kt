package fr.antoninpamart.kadens.restcountdown

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Le décompte du repos, affiché par le système quand l'app n'est plus à l'écran.
 *
 * ## Pourquoi un module, et pas expo-notifications
 *
 * expo-notifications sait poster une notification, pas la faire vivre : son
 * contenu est figé au moment où on la poste. Or la boucle JS ne tourne plus en
 * arrière-plan, donc rien ne peut la réécrire chaque seconde. La seule façon
 * d'avoir un décompte qui bouge téléphone verrouillé, c'est de le confier au
 * système : un `Chronometer` dans la notification, réglé une fois sur
 * l'échéance, que le système fait défiler tout seul.
 *
 * ## Ce que le module ne décide pas
 *
 * Quand montrer, quand retirer, quel texte : tout ça vit côté JS
 * (`src/session/rest.ts`). Ce fichier ne fait que dessiner ce qu'on lui donne.
 * Le canal, de même, est créé par expo-notifications avec les autres, pour que
 * la liste des canaux de l'app se lise à un seul endroit.
 */
class RestCountdownModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("RestCountdown")

    Function("show") { endsAt: Double, title: String, body: String, channelId: String ->
      show(endsAt.toLong(), title, body, channelId)
    }

    Function("hide") {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_TAG, NOTIFICATION_ID)
    }
  }

  /**
   * Poste la notification de décompte. Rend `false` quand il n'y a rien à
   * montrer (échéance passée) ou pas le droit de le faire : un refus de
   * notifier ne doit jamais casser un repos.
   */
  private fun show(endsAt: Long, title: String, body: String, channelId: String): Boolean {
    val remaining = endsAt - System.currentTimeMillis()
    val manager = NotificationManagerCompat.from(context)

    if (remaining <= 0 || !manager.areNotificationsEnabled()) {
      return false
    }

    // `Chronometer` compte sur l'horloge de démarrage, pas sur l'heure murale :
    // c'est elle qu'on règle, pour qu'un changement d'heure n'y touche pas.
    val content = RemoteViews(context.packageName, R.layout.rest_countdown).apply {
      setTextViewText(R.id.rest_countdown_title, title)
      setTextViewText(R.id.rest_countdown_body, body)
      setChronometer(R.id.rest_countdown_clock, SystemClock.elapsedRealtime() + remaining, null, true)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        setChronometerCountDown(R.id.rest_countdown_clock, true)
      }
    }

    val builder = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(smallIcon())
      // Titre et texte doublent la vue : c'est ce que lisent TalkBack, une
      // montre connectée, ou une surface qui n'affiche pas les vues maison.
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .setCustomContentView(content)
      // L'heure de l'en-tête serait celle du passage en arrière-plan : une
      // seconde horloge, qui ne dit rien, à côté de celle qui compte.
      .setShowWhen(false)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      // Elle s'efface d'elle-même à l'échéance, quand l'avertissement
      // « Repos terminé » prend le relais. Sans ça, une app tuée laisserait un
      // décompte passer sous zéro dans le volet.
      .setTimeoutAfter(remaining)
      .setContentIntent(openApp())

    accentColor()?.let { builder.setColor(it) }

    return try {
      manager.notify(NOTIFICATION_TAG, NOTIFICATION_ID, builder.build())
      true
    } catch (_: SecurityException) {
      // Permission retirée entre la vérification et l'envoi.
      false
    }
  }

  /**
   * Rouvre l'app là où on l'a laissée, comme le lanceur : la séance est
   * toujours au-dessus de la pile, il n'y a pas d'écran à viser.
   */
  private fun openApp(): PendingIntent? {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: return null

    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)

    return PendingIntent.getActivity(
      context,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  /**
   * L'icône de notification que le plugin expo-notifications a générée
   * (`app.json`), lue par son nom : elle appartient à l'app, pas à ce module.
   */
  private fun smallIcon(): Int {
    val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)

    return if (id != 0) id else context.applicationInfo.icon
  }

  private fun accentColor(): Int? {
    val id = context.resources.getIdentifier("notification_icon_color", "color", context.packageName)

    return if (id != 0) ContextCompat.getColor(context, id) else null
  }

  companion object {
    private const val NOTIFICATION_TAG = "kadens-rest-countdown"
    private const val NOTIFICATION_ID = 1
  }
}
