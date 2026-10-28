// Local habit reminders via expo-notifications. Local notifications work in Expo Go and
// development builds on Android/iOS; remote push is NOT used (it would need paid/hosted services).
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { Habit } from '../domain/types';

let configured = false;

function configure() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

export const remindersSupported = Platform.OS === 'ios' || Platform.OS === 'android';

export async function ensurePermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  configure();
  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync('reminders', { name: 'Habit reminders', importance: AndroidImportance.DEFAULT });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === 'granted';
}

/** Replace all scheduled reminders with one weekly trigger per scheduled day of each habit. */
export async function syncReminders(habits: Habit[]): Promise<number> {
  if (!remindersSupported) return 0;
  const wanted = habits.filter((h) => !h.archived && h.reminderTime);
  if (wanted.length && !(await ensurePermission())) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  let count = 0;
  for (const h of wanted) {
    const [hour, minute] = h.reminderTime!.split(':').map(Number);
    for (const day of h.days) {
      await Notifications.scheduleNotificationAsync({
        content: { title: `Time for: ${h.name}`, body: 'Keep your streak going 💪', data: { habitId: h.id } },
        // expo-notifications weekdays are 1–7 with 1 = Sunday; ours are 0–6 with 0 = Sunday.
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: day + 1, hour, minute, channelId: 'reminders' },
      });
      count++;
    }
  }
  return count;
}

export async function sendTestNotification(): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Momentum reminder (test)', body: 'Local notifications are working.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
  });
  return true;
}
