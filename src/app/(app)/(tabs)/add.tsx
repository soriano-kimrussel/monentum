import { Redirect } from 'expo-router';

// Placeholder for the tab bar's center "+" button, which opens the new-habit sheet directly.
// Only reached by typing /add, so forward to the real screen.
export default function Add() {
  return <Redirect href="/habit/new" />;
}
