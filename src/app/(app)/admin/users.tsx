import { useState } from 'react';
import { Text, View } from 'react-native';

import { PLANS } from '@/domain/subscription';
import { confirm, useAction, useQuery } from '@/hooks/useApi';
import { useSession } from '@/stores/session';
import { Button, Card, Loading, Pill, Screen, TextField } from '@/ui/components';
import { space, type } from '@/ui/theme';

export default function AdminUsers() {
  const me = useSession((s) => s.user);
  const { data, loading } = useQuery((b, t) => b.admin.users(t));
  const { run, busy } = useAction();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  if (loading || !data) return <Loading />;
  const rows = data.filter((u) => !q || u.email.includes(q.toLowerCase()) || u.displayName.toLowerCase().includes(q.toLowerCase()));

  return (
    <Screen>
      <TextField placeholder="Search by name or email" value={q} onChangeText={setQ} />
      {rows.map((u) => (
        <Card key={u.id} onPress={() => setOpen(open === u.id ? null : u.id)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={type.subtitle}>{u.displayName}</Text>
              <Text style={type.small}>{u.email}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {u.role === 'admin' && <Pill tone="warning" label="admin" />}
              {u.disabled && <Pill tone="danger" label="disabled" />}
              <Pill tone={u.premium ? 'primary' : 'neutral'} label={u.sub ? `${u.sub.status}${u.sub.plan ? ` · ${PLANS[u.sub.plan].label.replace('Premium ', '')}` : ''}` : 'none'} />
            </View>
          </View>
          {open === u.id && u.id !== me?.id && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
              <Button title="+30d Premium" small variant="secondary" loading={busy === `b${u.id}`} onPress={() => run(`b${u.id}`, (b, t) => b.billing.adminSetBonus(t, u.id, 30))} />
              {u.sub && (u.sub.status === 'active' || u.sub.status === 'trialing') && !u.sub.cancelAtPeriodEnd && (
                <Button title="Cancel sub" small variant="ghost" onPress={() => run(`c${u.id}`, (b, t) => b.billing.adminCancel(t, u.id))} />
              )}
              <Button title={u.role === 'admin' ? 'Make user' : 'Make admin'} small variant="ghost" onPress={async () => {
                if (await confirm('Change role?', `${u.email} will become ${u.role === 'admin' ? 'a regular user' : 'an admin'}.`)) await run(`r${u.id}`, (b, t) => b.admin.setRole(t, u.id, u.role === 'admin' ? 'user' : 'admin'));
              }} />
              <Button title={u.disabled ? 'Enable' : 'Disable'} small variant="danger" onPress={async () => {
                if (u.disabled || (await confirm('Disable account?', 'Signs the user out everywhere.', 'Disable', true))) await run(`d${u.id}`, (b, t) => b.admin.setDisabled(t, u.id, !u.disabled));
              }} />
            </View>
          )}
          {open === u.id && u.id === me?.id && <Text style={[type.small, { marginTop: space.sm }]}>That’s you. Admins can’t change their own role or disable themselves.</Text>}
        </Card>
      ))}
    </Screen>
  );
}
