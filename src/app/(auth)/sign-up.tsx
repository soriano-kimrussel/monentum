import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { signUpSchema } from '@/backend/schemas';
import { api, persistToken } from '@/services/app';
import { useSession } from '@/stores/session';
import { Button, ErrorText, Pill, Screen, TextField } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

export default function SignUp() {
  const invite = useSession((s) => s.invite);
  const [error, setError] = useState<unknown>(null);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '', referralCode: invite.referralCode ?? '' },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const { deviceId, invite: inv } = useSession.getState();
      const { token, user } = await api().auth.signUp(values, { deviceId, campaignCode: inv.campaignCode });
      await persistToken(token);
      useSession.getState().setSession(token, user);
    } catch (e) {
      setError(e);
    }
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']}>
        <View style={{ marginTop: space.xl, marginBottom: space.lg }}>
          <Text style={type.hero}>Create your account</Text>
          <Text style={[type.small, { marginTop: 6 }]}>Stored locally on this device (demo authentication).</Text>
          {invite.campaignCode && (
            <View style={{ marginTop: space.sm }}>
              <Pill tone="sim" label={`Simulated campaign: ${invite.campaignCode}`} />
            </View>
          )}
        </View>
        {(['displayName', 'email', 'password', 'referralCode'] as const).map((name) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <TextField
                label={{ displayName: 'Name', email: 'Email', password: 'Password', referralCode: 'Referral code (optional)' }[name]}
                hint={name === 'password' ? '8+ characters with a letter and a number' : undefined}
                secureTextEntry={name === 'password'}
                autoCapitalize={name === 'displayName' ? 'words' : name === 'referralCode' ? 'characters' : 'none'}
                keyboardType={name === 'email' ? 'email-address' : 'default'}
                placeholder={name === 'referralCode' ? 'MOM-XXXXXX' : undefined}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={formState.errors[name]?.message}
              />
            )}
          />
        ))}
        <ErrorText error={error} />
        <Button title="Create account" onPress={submit} loading={formState.isSubmitting} />
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))} style={{ marginTop: space.lg, alignItems: 'center' }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>I already have an account</Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}
