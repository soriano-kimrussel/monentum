import { useState } from 'react';
import { Text, View } from 'react-native';

import { REPLACE_CONFIRMATION } from '@/backend/modules/backup';
import type { RestoreMode } from '@/domain/backup';
import { notify, useAction, useQuery } from '@/hooks/useApi';
import { pickJsonText, saveAndShareJson } from '@/services/files';
import { Button, Card, ErrorText, Pill, Screen, Segmented, SectionTitle, TextField } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

type Preview = { counts: Record<string, number>; conflicts: number; exportedAt: string; fromOtherAccount: boolean };

export default function Backup() {
  const { run, busy } = useAction();
  const snapshot = useQuery((b, t) => b.backup.snapshotInfo(t));
  const [raw, setRaw] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [typed, setTyped] = useState('');

  const doExport = () =>
    run('export', async (b, t) => {
      const backup = await b.backup.export(t);
      const name = `momentum-backup-${backup.exportedAt.slice(0, 10)}.json`;
      await saveAndShareJson(name, JSON.stringify(backup, null, 2));
      const n = backup.data.habits.length + backup.data.checkIns.length + backup.data.goals.length + backup.data.moods.length + backup.data.journal.length;
      notify('Export ready', `${n} records saved to ${name}. Keep it somewhere safe; this is a local file, not a cloud backup.`);
    });

  /** Pick a new file (fresh) or re-preview the current one under a different mode. */
  const choose = async (m: RestoreMode, fresh: boolean) => {
    setError(null);
    setPreview(null);
    try {
      const text = fresh || !raw ? await pickJsonText() : raw;
      if (text === null) return;
      setRaw(text);
      const p = await run('preview', (b, t) => b.backup.preview(t, text, m));
      if (p) setPreview(p);
      else setRaw(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const restore = async () => {
    if (!raw) return;
    const counts = await run('restore', (b, t) => b.backup.restore(t, raw, mode, typed));
    if (counts) {
      notify('Restore complete', `A safety snapshot of your previous data was saved. Use “Undo last restore” if anything looks wrong.`);
      setRaw(null);
      setPreview(null);
      setTyped('');
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={type.subtitle}>Export your data</Text>
        <Text style={[type.small, { marginVertical: 6 }]}>Saves your habits, check-ins, goals, mood and journal as a JSON file on this device, then opens the share sheet. Nothing is uploaded automatically.</Text>
        <Button title="Export to JSON" icon="download-outline" onPress={doExport} loading={busy === 'export'} />
      </Card>

      <SectionTitle title="Restore from a file" />
      <Card>
        <Segmented<RestoreMode>
          options={[
            { value: 'merge', label: 'Merge (safe)' },
            { value: 'replace', label: 'Replace all' },
          ]}
          value={mode}
          onChange={(m) => {
            setMode(m);
            if (raw) choose(m, false);
          }}
        />
        <Text style={type.small}>
          {mode === 'merge' ? 'Adds records from the file. Existing records are never overwritten.' : 'Deletes your current data and replaces it with the file. Requires typed confirmation.'}
        </Text>
        <Button title={raw ? 'Choose a different file' : 'Choose backup file'} variant="secondary" icon="folder-open-outline" style={{ marginTop: space.md }} loading={busy === 'preview'} onPress={() => choose(mode, true)} />
        {error && <ErrorText error={error} />}
        {preview && (
          <View style={{ marginTop: space.md }}>
            <Text style={type.subtitle}>File looks valid ✓</Text>
            <Text style={type.small}>Exported {new Date(preview.exportedAt).toLocaleString()}</Text>
            {preview.fromOtherAccount && <View style={{ marginTop: 6 }}><Pill tone="warning" label="From another account: records will be copied with new ids" /></View>}
            <Text style={[type.body, { marginTop: space.sm }]}>
              {Object.entries(preview.counts).map(([k, v]) => `${v} ${k}`).join(' · ')}
            </Text>
            <Text style={[type.small, { color: preview.conflicts ? colors.warning : colors.muted, marginTop: 4 }]}>
              {mode === 'replace' ? `${preview.conflicts} current records will be removed.` : `${preview.conflicts} records already exist and will be kept as-is.`}
            </Text>
            {mode === 'replace' && <TextField label={`Type ${REPLACE_CONFIRMATION} to confirm`} autoCapitalize="characters" value={typed} onChangeText={setTyped} style={{ marginTop: space.sm }} />}
            <Button
              title={mode === 'replace' ? 'Replace my data' : 'Merge into my data'}
              variant={mode === 'replace' ? 'danger' : 'primary'}
              disabled={mode === 'replace' && typed !== REPLACE_CONFIRMATION}
              loading={busy === 'restore'}
              onPress={restore}
            />
          </View>
        )}
      </Card>

      <SectionTitle title="Recovery" />
      <Card>
        {snapshot.data ? (
          <>
            <Text style={type.body}>Safety snapshot from {new Date(snapshot.data.exportedAt).toLocaleString()}</Text>
            <Text style={type.small}>{snapshot.data.habits} habits · {snapshot.data.checkIns} check-ins</Text>
            <Button title="Undo last restore" variant="secondary" icon="arrow-undo" style={{ marginTop: space.md }} loading={busy === 'undo'} onPress={async () => {
              if (await run('undo', (b, t) => b.backup.undoRestore(t).then(() => true))) notify('Recovered', 'Your data is back to how it was before the last restore.');
            }} />
          </>
        ) : (
          <Text style={type.small}>A snapshot is created automatically before every restore so you can undo it.</Text>
        )}
      </Card>
    </Screen>
  );
}
