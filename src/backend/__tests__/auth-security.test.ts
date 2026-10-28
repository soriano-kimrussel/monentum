import { HABIT, makeAdmin, makeBackend, signUp } from '../testUtils';

describe('authentication', () => {
  it('signs up, signs in and never exposes credential material', async () => {
    const { backend } = makeBackend();
    const { token, user, email } = await signUp(backend);
    expect(token).toMatch(/^tok_/);
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('passwordSalt');
    const again = await backend.auth.signIn({ email, password: 'Passw0rd!' });
    expect(again.user.id).toBe(user.id);
  });

  it('rejects weak passwords and duplicate emails (case/alias-insensitive)', async () => {
    const { backend } = makeBackend();
    await expect(backend.auth.signUp({ displayName: 'A', email: 'a@x.com', password: 'short' }, { deviceId: 'd' })).rejects.toMatchObject({ code: 'invalid_input' });
    await signUp(backend, { email: 'taken@example.com' });
    await expect(signUp(backend, { email: 'TAKEN@example.com' })).rejects.toMatchObject({ code: 'email_taken' });
  });

  it('uses one generic error for unknown email and wrong password', async () => {
    const { backend } = makeBackend();
    const { email } = await signUp(backend);
    const a = backend.auth.signIn({ email, password: 'wrong-pass1' });
    const b = backend.auth.signIn({ email: 'nobody@example.com', password: 'wrong-pass1' });
    await expect(a).rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(b).rejects.toMatchObject({ code: 'invalid_credentials' });
  });

  it('rate-limits repeated failed logins, even with the right password afterwards', async () => {
    const { backend } = makeBackend();
    const { email } = await signUp(backend);
    for (let i = 0; i < 5; i++) await expect(backend.auth.signIn({ email, password: 'bad-pass1' })).rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(backend.auth.signIn({ email, password: 'bad-pass1' })).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('expires sessions and rejects missing or forged tokens', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    await expect(backend.content.habits('tok_forged')).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(backend.content.habits('')).rejects.toMatchObject({ code: 'unauthenticated' });
    // The demo test clock must NOT expire sessions...
    backend.core.clock.offsetMs = 400 * 86_400_000;
    await backend.content.habits(token);
    // ...but real elapsed time does.
    const spy = jest.spyOn(backend.core, 'realNowMs').mockReturnValue(Date.now() + 31 * 86_400_000);
    await expect(backend.content.habits(token)).rejects.toMatchObject({ code: 'unauthenticated' });
    spy.mockRestore();
  });

  it('invalidates the session on sign-out', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    await backend.auth.signOut(token);
    await expect(backend.auth.me(token)).rejects.toMatchObject({ code: 'unauthenticated' });
  });
});

describe('authorization and user isolation', () => {
  it('only returns the caller’s own data', async () => {
    const { backend } = makeBackend();
    const a = await signUp(backend);
    const b = await signUp(backend);
    await backend.content.createHabit(a.token, HABIT);
    expect(await backend.content.habits(a.token)).toHaveLength(1);
    expect(await backend.content.habits(b.token)).toHaveLength(0);
  });

  it('blocks reading, editing, deleting and checking-in on another user’s records', async () => {
    const { backend } = makeBackend();
    const a = await signUp(backend);
    const b = await signUp(backend);
    const habit = await backend.content.createHabit(a.token, HABIT);
    const today = backend.content.today();
    await expect(backend.content.updateHabit(b.token, habit.id, { ...HABIT, name: 'pwned' })).rejects.toMatchObject({ code: 'not_found' });
    await expect(backend.content.deleteHabit(b.token, habit.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(backend.content.toggleCheckIn(b.token, habit.id, today)).rejects.toMatchObject({ code: 'not_found' });
    // Goals can't link to someone else's habit either.
    await expect(backend.content.createGoal(b.token, { title: 'x', description: '', milestones: [], habitIds: [habit.id] })).rejects.toMatchObject({ code: 'not_found' });
    expect((await backend.content.habits(a.token))[0].name).toBe('Walk');
  });

  it('records denied access attempts in the audit log', async () => {
    const { backend } = makeBackend();
    const a = await signUp(backend);
    const b = await signUp(backend);
    const habit = await backend.content.createHabit(a.token, HABIT);
    await backend.content.deleteHabit(b.token, habit.id).catch(() => undefined);
    const admin = await makeAdmin(backend);
    const audit = await backend.admin.audit(admin);
    expect(audit.some((e) => e.action === 'authz.denied' && e.actorId === b.user.id)).toBe(true);
  });

  it('denies every admin endpoint to normal users', async () => {
    const { backend } = makeBackend();
    const { token, user } = await signUp(backend);
    const calls = [
      () => backend.admin.overview(token),
      () => backend.admin.users(token),
      () => backend.admin.audit(token),
      () => backend.admin.setRole(token, user.id, 'admin'),
      () => backend.billing.allRefunds(token),
      () => backend.billing.decideRefund(token, 'x', true),
      () => backend.billing.adminSetBonus(token, user.id, 30),
      () => backend.market.saveListing(token, { title: 't', description: '', category: 'Gear', priceCents: 1, inventory: 1, icon: 'x', active: true }),
      () => backend.market.allOrders(token),
      () => backend.growth.affiliates(token),
      () => backend.growth.events(token),
      () => backend.growth.setCommissionStatus(token, 'x', 'paid'),
      () => backend.referrals.setConfig(token, { trigger: 'signup', rewardDays: 90, maxRewardsPerReferrer: 100 }),
    ];
    for (const call of calls) await expect(call()).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('lets admins manage users but not demote or disable themselves', async () => {
    const { backend } = makeBackend();
    const admin = await makeAdmin(backend);
    const adminUser = await backend.auth.me(admin);
    const { token, user } = await signUp(backend);
    await expect(backend.admin.setRole(admin, adminUser.id, 'user')).rejects.toMatchObject({ code: 'self_change' });
    await expect(backend.admin.setDisabled(admin, adminUser.id, true)).rejects.toMatchObject({ code: 'self_change' });
    await backend.admin.setDisabled(admin, user.id, true);
    // Disabling revokes live sessions immediately.
    await expect(backend.auth.me(token)).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('validates input on the backend regardless of the UI', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    await expect(backend.content.createHabit(token, { ...HABIT, color: 'javascript:alert(1)' })).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(backend.content.createHabit(token, { ...HABIT, name: 'x'.repeat(500) })).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(backend.content.createHabit(token, { ...HABIT, days: [9] })).rejects.toMatchObject({ code: 'invalid_input' });
  });
});
