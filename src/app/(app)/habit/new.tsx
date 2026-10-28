import { router } from 'expo-router';

import { notify } from '@/hooks/useApi';
import { api } from '@/services/app';
import { syncReminders } from '@/services/notifications';
import { useSession } from '@/stores/session';
import { Screen } from '@/ui/components';
import { HabitForm } from '@/ui/HabitForm';

export default function NewHabit() {
  return (
    <Screen>
      <HabitForm
        submitLabel="Create habit"
        onSubmit={async (values) => {
          const token = useSession.getState().token!;
          try {
            await api().content.createHabit(token, values);
            if (values.reminderTime) await syncReminders(await api().content.habits(token)).catch(() => undefined);
            router.back();
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if ((e as { code?: string }).code === 'limit_reached') {
              notify('Free plan limit', msg);
              router.replace('/premium');
            } else notify('Couldn’t create habit', msg);
          }
        }}
      />
    </Screen>
  );
}
