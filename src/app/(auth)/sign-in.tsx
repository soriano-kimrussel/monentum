import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { signInSchema } from '@/backend/schemas';
import { DEMO_ACCOUNTS } from '@/backend/seed';
import { api, persistToken } from '@/services/app';
import { useSession } from '@/stores/session';
import { Button, Card, ErrorText, Screen, TextField } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

export default function SignIn() {
  const [error, setError] = useState<unknown>(null);
  const { control, handleSubmit, setValue, formState } = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const { token, user } = await api().auth.signIn(values);
      await persistToken(token);
      useSession.getState().setSession(token, user);
    } catch (e) {
      setError(e);
    }
  });

  const fill = (acct: { email: string; password: string }) => {
    setValue('email', acct.email);
    setValue('password', acct.password);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']}>
        <View style={{ marginTop: space.xxl, marginBottom: space.xl }}>
          <Text style={[type.hero, { color: colors.primary }]}>Momentum</Text>
          <Text style={[type.body, { color: colors.muted, marginTop: 6 }]}>Small habits. Real progress.</Text>
        </View>

        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={formState.errors.email?.message} />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField label="Password" secureTextEntry autoComplete="password" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={formState.errors.password?.message} onSubmitEditing={() => submit()} />
          )}
        />
        <ErrorText error={error} />
        <Button title="Sign in" onPress={submit} loading={formState.isSubmitting} testID="sign-in" />

        <Link href="/sign-up" asChild>
          <Pressable style={{ marginTop: space.lg, alignItems: 'center' }}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>New here? Create an account</Text>
          </Pressable>
        </Link>

        <Card style={{ marginTop: space.xl, backgroundColor: colors.simSoft }}>
          <Text style={[type.subtitle, { marginBottom: 4 }]}>Demo accounts</Text>
          <Text style={[type.small, { marginBottom: space.md }]}>Local demo authentication only. Accounts live on this device. This is not production identity verification.</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Demo user" variant="secondary" small onPress={() => fill(DEMO_ACCOUNTS.user)} style={{ flex: 1 }} />
            <Button title="Admin" variant="secondary" small onPress={() => fill(DEMO_ACCOUNTS.admin)} style={{ flex: 1 }} />
          </View>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
