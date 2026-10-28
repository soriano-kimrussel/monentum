/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories are hoisted and must use require() */
// Shared mocks for UI smoke tests that render the real expo-router tree.
// Import this FIRST in a test file so the mocks are registered before expo-router loads.
// Native modules are mocked explicitly because jest-expo's auto-mock lookup resolves
// source-mapped relative paths against the project root and fails in this project.
// Storage uses the in-memory adapter.

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { name: 'Momentum', scheme: 'momentum', experiments: {} }, manifest: null, executionEnvironment: 'storeClient' },
  ExecutionEnvironment: { StoreClient: 'storeClient', Bare: 'bare', Standalone: 'standalone' },
}));
// The package's exports map hides this file, so mock it by path.
jest.mock('../../node_modules/expo-linking/build/ExpoLinking', () => ({
  __esModule: true,
  default: { getLinkingURL: () => null, clearInitialURL: () => undefined, addListener: () => ({ remove: () => undefined }) },
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`[${name}]`}</Text> };
});
jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(require('crypto').randomBytes(n)) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' } }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { WEEKLY: 'weekly', TIME_INTERVAL: 'timeInterval' },
}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-file-system', () => ({}));
jest.mock('@/services/openStore', () => {
  const { MemoryStore } = require('@/data/MemoryStore');
  return { openStore: async () => new MemoryStore(), wipeStore: async (s: { clear: () => Promise<void> }) => s.clear() };
});

// Generous: seeding hashes ten demo passwords with PBKDF2, which is slow under parallel test load.
jest.setTimeout(300_000);

export {};
