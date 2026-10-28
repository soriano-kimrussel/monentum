import { router } from 'expo-router';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

export const visible = (text: string | RegExp) => waitFor(() => expect(screen.getAllByText(text).length).toBeGreaterThan(0), { timeout: 30_000 });

export async function go(path: string) {
  await act(() => router.push(path as never));
  await waitFor(() => expect(screen).toHavePathname(path), { timeout: 15_000 });
}

export async function signInAs(button: 'Demo user' | 'Admin') {
  await visible('Demo accounts');
  // fireEvent is async in RNTL 14: an un-awaited press leaves its act() scope open and
  // later updates (e.g. router.push) are never flushed.
  await fireEvent.press(screen.getByText(button));
  await fireEvent.press(screen.getByTestId('sign-in'));
  await visible('Today’s habits');
}

/** Navigate to each path and wait for a piece of text that proves the screen rendered. */
export async function visitAll(screens: [string, string | RegExp][]) {
  for (const [path, text] of screens) {
    await go(path);
    await visible(text);
  }
}
