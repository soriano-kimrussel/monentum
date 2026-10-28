import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import type { Backend } from '../backend';
import { api } from '../services/app';
import { useSession } from '../stores/session';

/**
 * Fetch data from the backend with the current session. Refetches automatically whenever
 * any mutation completes (the backend emits a change event) or `deps` change.
 */
export function useQuery<T>(fn: (b: Backend, token: string) => Promise<T>, deps: unknown[] = []) {
  const token = useSession((s) => s.token);
  const version = useSession((s) => s.version);
  const [state, setState] = useState<{ data: T | undefined; error: unknown; loading: boolean }>({ data: undefined, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });
  const depKey = JSON.stringify(deps);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    fnRef.current(api(), token).then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error) => alive && setState((s) => ({ ...s, error, loading: false })),
    );
    // Ignore results from superseded requests.
    return () => {
      alive = false;
    };
  }, [token, version, depKey, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    globalThis.alert?.(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export function confirm(title: string, message: string, confirmText = 'Continue', destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(!!globalThis.confirm?.(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

/** Wrap a backend mutation with busy state and user-facing error alerts. */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(async <T>(key: string, fn: (b: Backend, token: string) => Promise<T>): Promise<T | undefined> => {
    const token = useSession.getState().token;
    if (!token) return undefined;
    setBusy(key);
    try {
      return await fn(api(), token);
    } catch (e) {
      notify('Couldn’t complete that', e instanceof Error ? e.message : String(e));
      return undefined;
    } finally {
      setBusy(null);
    }
  }, []);
  return { run, busy };
}
