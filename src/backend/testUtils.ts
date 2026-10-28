import { MemoryStore } from '../data/MemoryStore';
import { createBackend } from './index';
import { createUser } from './modules/auth';

let n = 0;

export function makeBackend(random?: () => number) {
  const store = new MemoryStore();
  const backend = createBackend(store, undefined, random);
  return { store, backend };
}

export type TestBackend = ReturnType<typeof makeBackend>['backend'];

export async function signUp(backend: TestBackend, opts: { referralCode?: string; deviceId?: string; campaignCode?: string; email?: string } = {}) {
  const i = n++;
  const email = opts.email ?? `user${i}@example.com`;
  const res = await backend.auth.signUp(
    { displayName: `User ${i}`, email, password: 'Passw0rd!', referralCode: opts.referralCode },
    { deviceId: opts.deviceId ?? `device-${i}`, campaignCode: opts.campaignCode },
  );
  return { ...res, email };
}

export async function makeAdmin(backend: TestBackend) {
  const email = `admin${n++}@example.com`;
  await createUser(backend.core, { email, password: 'Adm1nPass!', displayName: 'Admin', role: 'admin' });
  return (await backend.auth.signIn({ email, password: 'Adm1nPass!' })).token;
}

export const HABIT = { name: 'Walk', icon: 'walk', color: '#2F9E77', days: [0, 1, 2, 3, 4, 5, 6] };

export const DAY = 86_400_000;
