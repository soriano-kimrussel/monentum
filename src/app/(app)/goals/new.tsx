import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Text, View } from 'react-native';
import type { z } from 'zod';

import { goalInputSchema } from '@/backend/schemas';
import { notify, useQuery } from '@/hooks/useApi';
import { api } from '@/services/app';
import { useSession } from '@/stores/session';
import { Button, Chip, Screen, TextField } from '@/ui/components';
import { colors, type } from '@/ui/theme';

type Values = z.input<typeof goalInputSchema>;

export default function NewGoal() {
  const habits = useQuery((b, t) => b.content.habits(t));
  const [milestone, setMilestone] = useState('');
  const { control, handleSubmit, formState, setValue } = useForm<Values>({
    resolver: zodResolver(goalInputSchema),
    defaultValues: { title: '', description: '', targetDate: '', milestones: [], habitIds: [] },
  });
  const milestones = useWatch({ control, name: 'milestones' });
  const habitIds = useWatch({ control, name: 'habitIds' });

  const submit = handleSubmit(async (values) => {
    try {
      await api().content.createGoal(useSession.getState().token!, values);
      router.back();
    } catch (e) {
      notify('Couldn’t create goal', e instanceof Error ? e.message : String(e));
      if ((e as { code?: string }).code === 'limit_reached') router.replace('/premium');
    }
  });

  return (
    <Screen>
      <Controller control={control} name="title" render={({ field }) => <TextField label="Goal" placeholder="e.g. Run a 10K" value={field.value} onChangeText={field.onChange} error={formState.errors.title?.message} />} />
      <Controller control={control} name="description" render={({ field }) => <TextField label="Why it matters (optional)" multiline value={field.value} onChangeText={field.onChange} />} />
      <Controller
        control={control}
        name="targetDate"
        render={({ field }) => <TextField label="Target date (optional)" placeholder="YYYY-MM-DD" value={field.value ?? ''} onChangeText={field.onChange} error={formState.errors.targetDate?.message} />}
      />
      <TextField
        label="Milestones"
        placeholder="Add a milestone and press return"
        value={milestone}
        onChangeText={setMilestone}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (milestone.trim()) setValue('milestones', [...milestones, milestone.trim()]);
          setMilestone('');
        }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {milestones.map((m, i) => (
          <Chip key={`${m}-${i}`} label={`${i + 1}. ${m}  ✕`} onPress={() => setValue('milestones', milestones.filter((_, j) => j !== i))} />
        ))}
      </View>
      {!!habits.data?.length && (
        <>
          <Text style={[type.small, { fontWeight: '600', color: colors.text, marginVertical: 6 }]}>Supporting habits</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
            {habits.data
              .filter((h) => !h.archived)
              .map((h) => (
                <Chip key={h.id} label={h.name} color={h.color} selected={habitIds.includes(h.id)} onPress={() => setValue('habitIds', habitIds.includes(h.id) ? habitIds.filter((x) => x !== h.id) : [...habitIds, h.id])} />
              ))}
          </View>
        </>
      )}
      <Button title="Create goal" onPress={submit} loading={formState.isSubmitting} />
    </Screen>
  );
}
