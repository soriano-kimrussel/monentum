export const colors = {
  bg: '#F5F4FA',
  card: '#FFFFFF',
  text: '#1B1830',
  muted: '#6B6785',
  faint: '#A6A3BA',
  border: '#E6E4F0',
  primary: '#5B4BDB',
  primarySoft: '#ECE9FD',
  success: '#2F9E77',
  successSoft: '#E3F5EE',
  warning: '#C77700',
  warningSoft: '#FFF3DC',
  danger: '#D6336C',
  dangerSoft: '#FDE7EF',
  sim: '#7A5AF8',
  simSoft: '#F1ECFF',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const type = {
  hero: { fontSize: 28, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.5 },
  title: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  subtitle: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  tiny: { fontSize: 11, color: colors.muted, fontWeight: '600' as const, letterSpacing: 0.4 },
};

export const HABIT_COLORS = ['#2F9E77', '#4C6EF5', '#AE3EC9', '#F08C00', '#E03131', '#1098AD', '#5B4BDB', '#66A80F'];

/** Habit icon keys → Ionicons names. */
export const HABIT_ICONS = ['walk', 'book', 'leaf', 'water', 'barbell', 'bed', 'musical-notes', 'code-slash', 'restaurant', 'sunny', 'heart', 'bicycle'] as const;

export const MOOD_FACES = ['', '😞', '😕', '😐', '🙂', '😄'] as const;
export const MOOD_COLORS = ['', '#E03131', '#F08C00', '#FAB005', '#82C91E', '#2F9E77'] as const;
