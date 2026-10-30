import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, radius, shadow, space, type } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  edges = ['bottom'],
  refreshing,
  onRefresh,
  scroll = true,
}: {
  children: ReactNode;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }, style]} accessibilityRole="button">
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  small,
  style,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    secondary: { bg: colors.primarySoft, fg: colors.primary },
    ghost: { bg: 'transparent', fg: colors.primary, border: colors.border },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  };
  const p = palette[variant];
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: p.bg, borderColor: p.border ?? p.bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={small ? 15 : 18} color={p.fg} style={{ marginRight: 6 }} />}
          <Text style={[styles.buttonText, small && { fontSize: 13 }, { color: p.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function TextField({ label, error, hint, style, ...rest }: TextInputProps & { label?: string; error?: string; hint?: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.faint}
        accessibilityLabel={label}
        style={[styles.input, !!error && { borderColor: colors.danger }, rest.multiline && { minHeight: 110, textAlignVertical: 'top' }, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, color = colors.primary }: { label: string; selected?: boolean; onPress?: () => void; color?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, selected ? { backgroundColor: color, borderColor: color } : null]}>
      <Text style={[styles.chipText, selected && { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary' | 'sim' }) {
  const map = {
    neutral: [colors.border, colors.muted],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
    primary: [colors.primarySoft, colors.primary],
    sim: [colors.simSoft, colors.sim],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={[styles.row, { justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.sm }]}>
      <Text style={type.subtitle}>{title}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={{ color: colors.primary, fontWeight: '600' }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyState({ icon, title, body, action, onAction }: { icon: IconName; title: string; body?: string; action?: string; onAction?: () => void }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: space.xxl }}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={[type.subtitle, { marginTop: space.md }]}>{title}</Text>
      {body && <Text style={[type.small, { textAlign: 'center', marginTop: 4 }]}>{body}</Text>}
      {action && <Button title={action} onPress={onAction} style={{ marginTop: space.lg }} small />}
    </Card>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  tint = colors.primary,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  tint?: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.7 }]}>
      {icon && (
        <View style={[styles.rowIcon, { backgroundColor: tint + '1A' }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={type.body} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={type.small} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null)}
    </Pressable>
  );
}

export function Stat({ label, value, sub, tone = colors.text }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 90 }}>
      <Text style={type.tiny}>{label.toUpperCase()}</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: tone, marginTop: 2 }}>{value}</Text>
      {sub && <Text style={type.small}>{sub}</Text>}
    </View>
  );
}

/** Banner that marks every simulated money / growth feature. */
export function SimBanner({ text = 'Demo mode: purchases are simulated. No real payment is taken and no card details are collected.' }: { text?: string }) {
  return (
    <View style={styles.sim} accessibilityRole="text">
      <Ionicons name="flask" size={16} color={colors.sim} />
      <Text style={{ color: colors.sim, fontSize: 12.5, flex: 1, marginLeft: 8, lineHeight: 17 }}>{text}</Text>
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segmentItem, value === o.value && styles.segmentActive]} accessibilityRole="tab" accessibilityState={{ selected: value === o.value }}>
          <Text style={[styles.segmentText, value === o.value && { color: colors.text }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: space.xxl, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return <Text style={[styles.error, { marginVertical: space.sm }]}>{error instanceof Error ? error.message : String(error)}</Text>;
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: space.sm }} />;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl * 3 },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow,
  },
  button: { minHeight: 50, borderRadius: radius.pill, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  buttonSmall: { minHeight: 36, paddingHorizontal: space.md },
  buttonText: { fontSize: 15.5, fontWeight: '600', letterSpacing: 0.1 },
  label: { ...type.small, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 15.5,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 12.5, marginTop: 4 },
  hint: { color: colors.muted, fontSize: 12.5, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginRight: 8, marginBottom: 8 },
  chipText: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 11.5, fontWeight: '700' },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sim: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.simSoft, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  segment: { flexDirection: 'row', backgroundColor: colors.primarySoft, borderRadius: radius.pill, padding: 3, marginBottom: space.md },
  segmentItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.card },
  segmentText: { fontWeight: '600', color: colors.muted, fontSize: 13.5 },
});
