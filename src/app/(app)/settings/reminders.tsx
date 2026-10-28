import { router } from 'expo-router';
import { Text } from 'react-native';

import { notify, useAction, useQuery } from '@/hooks/useApi';
import { remindersSupported, sendTestNotification, syncReminders } from '@/services/notifications';
import { Button, Card, ListRow, Screen, SectionTitle } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

export default function Reminders() {
  const { data } = useQuery((b, t) => b.content.habits(t));
  const { run, busy } = useAction();
  const withReminders = (data ?? []).filter((h) => !h.archived && h.reminderTime);

  return (
    <Screen>
      <Card>
        <Text style={type.subtitle}>Local notifications</Text>
        <Text style={[type.small, { marginTop: 4 }]}>
          {remindersSupported
            ? 'Reminders are scheduled on this device. They work in Expo Go and dev builds; no push server is used.'
            : 'Reminders need the iOS or Android app. The web preview can’t schedule notifications.'}
        </Text>
        {remindersSupported && (
          <>
            <Button
              title="Send a test notification"
              variant="secondary"
              icon="notifications-outline"
              style={{ marginTop: space.md }}
              onPress={async () => notify((await sendTestNotification()) ? 'Arriving in 3 seconds' : 'Permission denied', 'You can change this in system settings.')}
            />
            <Button
              title="Re-schedule all reminders"
              variant="ghost"
              style={{ marginTop: space.sm }}
              loading={busy === 'sync'}
              onPress={async () => {
                const n = await run('sync', (b, t) => b.content.habits(t).then(syncReminders));
                if (n !== undefined) notify('Reminders scheduled', `${n} weekly reminder slots set.`);
              }}
            />
          </>
        )}
      </Card>
      <SectionTitle title="Habits with reminders" />
      <Card>
        {withReminders.length === 0 && <Text style={type.small}>Set a reminder time when editing a habit.</Text>}
        {withReminders.map((h) => (
          <ListRow key={h.id} icon="alarm" tint={colors.warning} title={h.name} subtitle={`${h.reminderTime} on ${h.days.length === 7 ? 'every day' : `${h.days.length} days/week`}`} onPress={() => router.push(`/habit/${h.id}`)} />
        ))}
      </Card>
    </Screen>
  );
}
