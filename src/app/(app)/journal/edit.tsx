import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { confirm, useAction, useQuery } from '@/hooks/useApi';
import type { JournalEntry } from '@/domain/types';
import { Button, Card, Chip, Loading, Screen, TextField } from '@/ui/components';
import { MOOD_FACES, colors, space, type } from '@/ui/theme';

const PROMPTS = [
  'What went well today, and why?',
  'What got in the way of your habits?',
  'What is one thing you’re grateful for?',
  'What would make tomorrow 1% better?',
  'When did you feel most like yourself today?',
];

export default function JournalEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useQuery(async (b, t) => (id ? ((await b.content.journal(t)).find((j) => j.id === id) ?? null) : null), [id]);
  if (existing.loading) return <Loading />;
  return <JournalForm key={existing.data?.id ?? 'new'} id={id} initial={existing.data ?? null} />;
}

function JournalForm({ id, initial }: { id?: string; initial: JournalEntry | null }) {
  const { run, busy } = useAction();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [prompt, setPrompt] = useState<string | undefined>(initial?.prompt);
  const [mood, setMood] = useState<number | undefined>(initial?.mood);

  const save = async () => {
    const ok = await run('save', (b, t) => b.content.saveJournal(t, { title, body, prompt, mood }, id));
    if (ok) router.back();
  };

  return (
    <Screen>
      {!id && (
        <>
          <Text style={[type.small, { fontWeight: '600', color: colors.text, marginBottom: 6 }]}>Need a prompt?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm }}>
            {PROMPTS.map((p) => (
              <Chip key={p} label={p} selected={prompt === p} onPress={() => setPrompt(prompt === p ? undefined : p)} />
            ))}
          </View>
        </>
      )}
      {prompt && (
        <Card style={{ backgroundColor: colors.simSoft }}>
          <Text style={[type.body, { fontStyle: 'italic' }]}>{prompt}</Text>
        </Card>
      )}
      <TextField label="Title (optional)" value={title} onChangeText={setTitle} maxLength={120} />
      <TextField label="Entry" multiline value={body} onChangeText={setBody} placeholder="Write freely…" maxLength={20000} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: space.md }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Pressable key={s} onPress={() => setMood(mood === s ? undefined : s)} accessibilityLabel={`Mood ${s}`} accessibilityState={{ selected: mood === s }} style={{ opacity: !mood || mood === s ? 1 : 0.35 }}>
            <Text style={{ fontSize: 30 }}>{MOOD_FACES[s]}</Text>
          </Pressable>
        ))}
      </View>
      <Button title="Save entry" onPress={save} loading={busy === 'save'} disabled={!body.trim()} />
      {id && (
        <Button
          title="Delete entry"
          variant="danger"
          style={{ marginTop: space.sm }}
          onPress={async () => {
            if (!(await confirm('Delete entry?', 'This can’t be undone.', 'Delete', true))) return;
            if (await run('del', (b, t) => b.content.deleteJournal(t, id).then(() => true))) router.back();
          }}
        />
      )}
    </Screen>
  );
}
