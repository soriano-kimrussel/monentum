import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import type { z } from 'zod';

import { habitInputSchema } from '../backend/schemas';
import { Button, Card, Chip, TextField, type IconName } from './components';
import { HABIT_COLORS, HABIT_ICONS, colors, space, type } from './theme';

export type HabitFormValues = z.input<typeof habitInputSchema>;
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function HabitForm({ initial, onSubmit, submitLabel }: { initial?: Partial<HabitFormValues>; onSubmit: (v: HabitFormValues) => Promise<unknown>; submitLabel: string }) {
  const { control, handleSubmit, formState } = useForm<HabitFormValues>({
    resolver: zodResolver(habitInputSchema),
    defaultValues: { name: '', icon: 'walk', color: HABIT_COLORS[0], days: [0, 1, 2, 3, 4, 5, 6], reminderTime: '', ...initial },
  });
  const color = useWatch({ control, name: 'color' });

  return (
    <View>
      <Controller
        control={control}
        name="name"
        render={({ field }) => <TextField label="Habit name" placeholder="e.g. Drink a glass of water" value={field.value} onChangeText={field.onChange} error={formState.errors.name?.message} autoFocus={!initial?.name} />}
      />

      <Text style={[type.small, { fontWeight: '600', color: colors.text, marginBottom: 6 }]}>Icon & color</Text>
      <Card>
        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {HABIT_ICONS.map((ic) => (
                <Pressable
                  key={ic}
                  onPress={() => field.onChange(ic)}
                  accessibilityRole="button"
                  accessibilityLabel={`Icon ${ic}`}
                  accessibilityState={{ selected: field.value === ic }}
                  style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: field.value === ic ? color + '33' : colors.bg }}>
                  <Ionicons name={ic as IconName} size={22} color={field.value === ic ? color : colors.muted} />
                </Pressable>
              ))}
            </View>
          )}
        />
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: space.md }}>
              {HABIT_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => field.onChange(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`Color ${c}`}
                  accessibilityState={{ selected: field.value === c }}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, borderWidth: 3, borderColor: field.value === c ? colors.text : 'transparent' }}
                />
              ))}
            </View>
          )}
        />
      </Card>

      <Text style={[type.small, { fontWeight: '600', color: colors.text, marginBottom: 6 }]}>Repeat on</Text>
      <Controller
        control={control}
        name="days"
        render={({ field }) => (
          <View style={{ marginBottom: space.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {DAY_LABELS.map((d, i) => {
                const on = field.value.includes(i);
                return (
                  <Pressable
                    key={i}
                    onPress={() => field.onChange(on ? field.value.filter((x) => x !== i) : [...field.value, i])}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color : colors.card, borderWidth: 1, borderColor: on ? color : colors.border }}>
                    <Text style={{ fontWeight: '700', color: on ? '#fff' : colors.muted }}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', marginTop: space.sm }}>
              <Chip label="Every day" onPress={() => field.onChange([0, 1, 2, 3, 4, 5, 6])} />
              <Chip label="Weekdays" onPress={() => field.onChange([1, 2, 3, 4, 5])} />
              <Chip label="Weekends" onPress={() => field.onChange([0, 6])} />
            </View>
            {formState.errors.days && <Text style={{ color: colors.danger, fontSize: 12.5 }}>{formState.errors.days.message}</Text>}
          </View>
        )}
      />

      <Controller
        control={control}
        name="reminderTime"
        render={({ field }) => (
          <TextField label="Reminder time (optional)" placeholder="HH:MM, e.g. 07:30" keyboardType="numbers-and-punctuation" maxLength={5} value={field.value ?? ''} onChangeText={field.onChange} error={formState.errors.reminderTime?.message} hint="Local notification on scheduled days (iOS/Android)." />
        )}
      />

      <Button title={submitLabel} onPress={handleSubmit(onSubmit)} loading={formState.isSubmitting} />
    </View>
  );
}
