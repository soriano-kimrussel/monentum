// Calm, nature-inspired palette: sage greens on warm paper, with soft pastel tiles.
export const colors = {
  bg: '#F3F1EB',
  card: '#FFFFFF',
  text: '#1F2A24',
  muted: '#6B756F',
  faint: '#A7AFA9',
  border: '#E6E2D8',
  primary: '#3E5C4E',
  primaryDark: '#2F4A3E',
  primarySoft: '#E3ECE5',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#C9D8CE',
  success: '#5E8C6A',
  successSoft: '#E4EFE6',
  warning: '#B7791F',
  warningSoft: '#F6EDDB',
  danger: '#B4475A',
  dangerSoft: '#F7E4E7',
  sim: '#7568A8',
  simSoft: '#EEEBF6',
  // Pastel tiles (feature shortcuts, stat cards).
  tileSand: '#EFE9DC',
  tileMint: '#E2EEE5',
  tileLavender: '#ECE9F5',
  tileSky: '#E2EDF2',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;

export const type = {
  hero: { fontSize: 30, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.6 },
  title: { fontSize: 20, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.2 },
  subtitle: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  tiny: { fontSize: 11, color: colors.muted, fontWeight: '600' as const, letterSpacing: 0.4 },
};

/** Soft, low-contrast elevation used by cards and the tab bar. */
export const shadow = {
  shadowColor: '#2F4A3E',
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

export const HABIT_COLORS = ['#5E8C6A', '#5B8BA6', '#8B7BB8', '#C08A3E', '#B86B5E', '#4F9A94', '#3E5C4E', '#8AA05A'];

/** Habit icon keys → Ionicons names. */
export const HABIT_ICONS = ['walk', 'book', 'leaf', 'water', 'barbell', 'bed', 'musical-notes', 'code-slash', 'restaurant', 'sunny', 'heart', 'bicycle'] as const;

export const MOOD_FACES = ['', '😞', '😕', '😐', '🙂', '😄'] as const;
export const MOOD_COLORS = ['', '#B86B5E', '#C08A3E', '#C9B458', '#8AA05A', '#5E8C6A'] as const;
