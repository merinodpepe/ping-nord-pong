'use server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { redirect } from '@/i18n/navigation';
import { errorKey, type ActionResult } from '@/lib/errors';
import { SITE_URL, TERMS_VERSION } from '@/lib/env';
import { hashKey } from '@/lib/hash';
import { aliasSchema, createMatchSchema } from '@/lib/match-validation';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';
import { verifyTurnstile } from '@/lib/turnstile';

const fail = (message: string | undefined | null): ActionResult => ({ ok: false, error: errorKey(message) });
const uuid = z.string().uuid();

async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim();
}

// ---------- acceso ----------
export async function requestMagicLink(_: unknown, form: FormData): Promise<ActionResult> {
  const email = z.string().email().max(254).safeParse(String(form.get('email') ?? '').trim());
  if (!email.success) return { ok: false, error: 'email_invalid' };
  const ip = await clientIp();
  if (!(await verifyTurnstile(String(form.get('cf-turnstile-response') ?? ''), ip))) return { ok: false, error: 'turnstile' };
  const locale = await getLocale();

  // 5 por hora y email; límite más amplio por IP
  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin() : null;
  if (admin) {
    const a = await admin.rpc('throttle_hit', { p_key: hashKey('email', email.data), p_max: 5, p_window: '1 hour' });
    const b = await admin.rpc('throttle_hit', { p_key: hashKey('ip', ip), p_max: 20, p_window: '1 hour' });
    if (a.data === false || b.data === false) return { ok: false, error: 'rate_limited' };
  }

  const sb = await supabaseServer();
  const next = String(form.get('next') ?? '/');
  const { error } = await sb.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: true, emailRedirectTo: `${SITE_URL}/auth/confirm?next=${encodeURIComponent(next.startsWith('/') ? next : '/')}&locale=${locale}`, data: { locale } },
  });
  // Respuesta neutra: no se revela si la cuenta existe ni errores de envío concretos
  if (error && /rate/i.test(error.message)) return { ok: false, error: 'rate_limited' };
  return { ok: true };
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut({ scope: 'local' });
  redirect({ href: '/', locale: await getLocale() });
}

export async function signOutEverywhere() {
  const sb = await supabaseServer();
  await sb.auth.signOut({ scope: 'global' });
  redirect({ href: '/', locale: await getLocale() });
}

// ---------- perfil ----------
export async function completeOnboarding(_: unknown, form: FormData): Promise<ActionResult> {
  const alias = aliasSchema.safeParse(String(form.get('alias') ?? ''));
  if (!alias.success) return { ok: false, error: 'alias_format' };
  if (form.get('terms') !== 'on' || form.get('age') !== 'on') return { ok: false, error: 'terms_required' };
  const locale = await getLocale();
  const sb = await supabaseServer();
  const { error } = await sb.rpc('complete_onboarding', { p_alias: alias.data, p_locale: locale, p_terms_version: TERMS_VERSION });
  if (error) return fail(error.message);
  redirect({ href: String(form.get('next') ?? '/') || '/', locale });
  return { ok: true };
}

export async function updateProfile(_: unknown, form: FormData): Promise<ActionResult> {
  const alias = form.get('alias') ? aliasSchema.safeParse(String(form.get('alias'))) : null;
  if (alias && !alias.success) return { ok: false, error: 'alias_format' };
  const color = form.get('color') !== null ? z.coerce.number().int().min(0).max(6).safeParse(form.get('color')) : null;
  const locale = z.enum(['es', 'ca', 'en', 'zh', 'de']).safeParse(form.get('locale'));
  const sb = await supabaseServer();
  const { error } = await sb.rpc('update_profile', {
    p_alias: alias?.success ? alias.data : null,
    p_avatar_color: color?.success ? color.data : null,
    p_locale: locale.success ? locale.data : null,
  });
  if (error) return fail(error.message);
  revalidatePath('/', 'layout');
  if (locale.success) redirect({ href: '/ajustes', locale: locale.data });
  return { ok: true };
}

export async function acceptTerms() {
  const sb = await supabaseServer();
  await sb.rpc('accept_terms', { p_version: TERMS_VERSION });
  revalidatePath('/', 'layout');
}

export async function deleteAccount(_: unknown, form: FormData): Promise<ActionResult> {
  if (form.get('confirm') !== 'on') return { ok: false, error: 'confirm_required' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('delete_my_account');
  if (error) return fail(error.message);
  await sb.auth.signOut({ scope: 'local' });
  redirect({ href: '/?deleted=1', locale: await getLocale() });
  return { ok: true };
}

// ---------- partidos ----------
export async function createMatch(input: unknown): Promise<ActionResult<{ id: string }>> {
  const v = createMatchSchema.safeParse(input);
  if (!v.success) return { ok: false, error: 'invalid_score' };
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('create_match', {
    p_mode: v.data.mode, p_points_target: v.data.pointsTarget, p_best_of: v.data.bestOf, p_win_by_two: v.data.winByTwo,
    p_team_a: v.data.teamA, p_team_b: v.data.teamB, p_sets: v.data.sets,
    p_counter_of: v.data.counterOf ?? null, p_challenge: v.data.challengeId ?? null,
  });
  if (error) return fail(error.message);
  revalidatePath('/', 'layout');
  return { ok: true, data: { id: data as string } };
}

export async function confirmMatch(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'not_found' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('confirm_match', { p_id: id });
  if (error) return fail(error.message);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function rejectMatch(id: string, reason: 'wrong_result' | 'not_played' | 'other'): Promise<ActionResult> {
  if (!uuid.safeParse(id).success || !['wrong_result', 'not_played', 'other'].includes(reason)) return { ok: false, error: 'not_found' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('reject_match', { p_id: id, p_reason: reason });
  if (error) return fail(error.message);
  revalidatePath('/', 'layout');
  return { ok: true };
}

// ---------- retos y chat ----------
export async function createChallenge(_: unknown, form: FormData): Promise<ActionResult<{ id: string }>> {
  const to = String(form.get('to') ?? '');
  const sb = await supabaseServer();
  const { data: target } = await sb.from('public_profiles').select('id').ilike('alias', to.replace(/[%_\\]/g, '')).maybeSingle();
  if (!target) return { ok: false, error: 'not_found' };
  const when = String(form.get('when') ?? '');
  const mode = form.get('mode') === '2v2' ? '2v2' : '1v1';
  const place = String(form.get('place') ?? '').slice(0, 80);
  const { data, error } = await sb.rpc('create_challenge', {
    p_to: target.id, p_mode: mode, p_proposed_at: when ? new Date(when).toISOString() : null, p_place: place || null,
  });
  if (error) return fail(error.message);
  revalidatePath('/', 'layout');
  redirect({ href: `/retos/${data as string}`, locale: await getLocale() });
  return { ok: true, data: { id: data as string } };
}

export async function respondChallenge(id: string, accept: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'not_found' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('respond_challenge', { p_id: id, p_accept: accept });
  if (error) return fail(error.message);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function cancelChallenge(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'not_found' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('cancel_challenge', { p_id: id });
  if (error) return fail(error.message);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function sendMessage(challengeId: string, body: string): Promise<ActionResult> {
  if (!uuid.safeParse(challengeId).success) return { ok: false, error: 'not_found' };
  const text = z.string().trim().min(1).max(500).safeParse(body);
  if (!text.success) return { ok: false, error: 'bad_message' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('send_message', { p_challenge: challengeId, p_body: text.data });
  if (error) return fail(error.message);
  return { ok: true };
}

export async function blockUser(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'not_found' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('block_user', { p_target: id });
  if (error) return fail(error.message);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function unblockUser(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'not_found' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('unblock_user', { p_target: id });
  if (error) return fail(error.message);
  revalidatePath('/', 'layout');
  return { ok: true };
}

// ---------- reportes ----------
export async function createReport(_: unknown, form: FormData): Promise<ActionResult> {
  if (!(await verifyTurnstile(String(form.get('cf-turnstile-response') ?? ''), await clientIp()))) return { ok: false, error: 'turnstile' };
  const v = z.object({
    reason: z.enum(['fake_result', 'harassment', 'spam', 'impersonation', 'offensive_alias', 'other']),
    details: z.string().max(500).optional(),
    profile: uuid.optional(), match: uuid.optional(), message: z.coerce.number().int().positive().optional(),
  }).safeParse({
    reason: form.get('reason'), details: String(form.get('details') ?? '') || undefined,
    profile: form.get('profile') || undefined, match: form.get('match') || undefined, message: form.get('message') || undefined,
  });
  if (!v.success) return { ok: false, error: 'generic' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('create_report', {
    p_reason: v.data.reason, p_details: v.data.details ?? null, p_profile: v.data.profile ?? null,
    p_match: v.data.match ?? null, p_message: v.data.message ?? null,
  });
  if (error) return fail(error.message);
  return { ok: true };
}

export async function markAllRead() {
  const sb = await supabaseServer();
  await sb.rpc('mark_notifications_read', { p_ids: null });
  revalidatePath('/', 'layout');
}

// ---------- moderación ----------
const reason = z.string().trim().min(1).max(300);

export async function adminVoidMatch(id: string, why: string): Promise<ActionResult> {
  const r = reason.safeParse(why);
  if (!uuid.safeParse(id).success || !r.success) return { ok: false, error: 'reason_required' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('void_match', { p_id: id, p_reason: r.data.slice(0, 200) });
  if (error) return fail(error.message);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function adminSetStatus(profile: string, status: 'active' | 'limited' | 'banned', days: number, why: string): Promise<ActionResult> {
  const r = reason.safeParse(why);
  if (!uuid.safeParse(profile).success || !r.success) return { ok: false, error: 'reason_required' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('admin_set_status', { p_profile: profile, p_status: status, p_days: days, p_reason: r.data });
  if (error) return fail(error.message);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function adminForceAlias(profile: string, alias: string, why: string): Promise<ActionResult> {
  const r = reason.safeParse(why);
  const a = aliasSchema.safeParse(alias);
  if (!uuid.safeParse(profile).success || !r.success) return { ok: false, error: 'reason_required' };
  if (!a.success) return { ok: false, error: 'alias_format' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('admin_force_alias', { p_profile: profile, p_alias: a.data, p_reason: r.data });
  if (error) return fail(error.message);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function adminResolveReport(id: string, status: 'resolved' | 'dismissed', note: string): Promise<ActionResult> {
  const r = reason.safeParse(note);
  if (!uuid.safeParse(id).success || !r.success) return { ok: false, error: 'reason_required' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('admin_resolve_report', { p_id: id, p_status: status, p_note: r.data });
  if (error) return fail(error.message);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function adminReviewFlag(id: number, status: 'reviewed' | 'dismissed'): Promise<ActionResult> {
  const sb = await supabaseServer();
  const { error } = await sb.rpc('admin_review_flag', { p_id: id, p_status: status });
  if (error) return fail(error.message);
  revalidatePath('/', 'layout');
  return { ok: true };
}
