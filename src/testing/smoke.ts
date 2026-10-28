import { router } from 'expo-router';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

export const visible = (text: string | RegExp) => waitFor(() => expect(screen.getAllByText(text).length).toBeGreaterThan(0), { timeout: 30_000 });

export async function go(path: string) {
  act(() => router.push(path as never));
  await waitFor(() => expect(screen).toHavePathname(path), { timeout: 15_000 });
}

export async function signInAs(button: 'Demo user' | 'Admin') {
  await visible('Demo accounts');
  fireEvent.press(screen.getByText(button));
  fireEvent.press(screen.getByTestId('sign-in'));
  await visible('Today’s habits');
}

/** Navigate to each path and wait for a piece of text that proves the screen rendered. */
export async function visitAll(screens: [string, string | RegExp][]) {
  for (const [path, text] of screens) {
    await go(path);
    await visible(text);
  }
}
