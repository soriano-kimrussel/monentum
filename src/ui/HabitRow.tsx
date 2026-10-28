import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';

import type { StreakSummary } from '../domain/streaks';
import type { Habit } from '../domain/types';
import type { IconName } from './components';
import { colors, radius, space, type } from './theme';

export function HabitRow({ habit, stats, onToggle, onPress, busy }: { habit: Habit; stats: StreakSummary; onToggle?: () => void; onPress?: () => void; busy?: boolean }) {
  const done = stats.doneToday;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        padding: space.md,
        marginBottom: space.sm,
        opacity: pressed ? 0.85 : habit.archived ? 0.55 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={`${habit.name}, ${stats.current} day streak`}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: habit.color + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={habit.icon as IconName} size={22} color={habit.color} />
      </View>
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Text style={type.subtitle} numberOfLines={1}>
          {habit.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          <Ionicons name="flame" size={13} color={stats.current ? '#F08C00' : colors.faint} />
          <Text style={[type.small, { marginLeft: 3 }]}>
            {stats.current} day streak · {Math.round(stats.rate * 100)}% (30d)
          </Text>
        </View>
      </View>
      {onToggle && (
        <Pressable
          hitSlop={8}
          disabled={busy}
          onPress={() => {
            Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
            onToggle();
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done, busy }}
          accessibilityLabel={`Mark ${habit.name} ${done ? 'not done' : 'done'} today`}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            borderWidth: 2,
            borderColor: done ? habit.color : colors.border,
            backgroundColor: done ? habit.color : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy ? 0.5 : 1,
          }}>
          {done && <Ionicons name="checkmark" size={22} color="#fff" />}
        </Pressable>
      )}
    </Pressable>
  );
}
