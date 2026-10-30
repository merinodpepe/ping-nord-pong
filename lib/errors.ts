// Traduce el mensaje de error de una RPC a una clave del namespace "errors". Nunca se muestra el texto crudo de Postgres.
const MAP: [RegExp, string][] = [
  [/rate_limited: pending/i, 'rate_pending'],
  [/rate_limited: same_rival/i, 'rate_same_rival'],
  [/rate_limited: open_challenges/i, 'rate_open_challenges'],
  [/rate_limited/i, 'rate_limited'],
  [/invalid_score/i, 'invalid_score'],
  [/cannot_confirm_own/i, 'cannot_confirm_own'],
  [/not_participant|forbidden|42501/i, 'forbidden'],
  [/not_pending/i, 'not_pending'],
  [/expired/i, 'expired'],
  [/blocked/i, 'blocked'],
  [/limited/i, 'limited'],
  [/banned/i, 'banned'],
  [/alias_taken/i, 'alias_taken'],
  [/bad_alias: reserved/i, 'alias_reserved'],
  [/bad_alias: offensive/i, 'alias_offensive'],
  [/bad_alias/i, 'alias_format'],
  [/bad_terms_version/i, 'terms_version'],
  [/already_onboarded/i, 'already_onboarded'],
  [/chat_closed/i, 'chat_closed'],
  [/challenge_exists/i, 'challenge_exists'],
  [/counter_not_allowed/i, 'counter_not_allowed'],
  [/not_authenticated|no_profile|28000/i, 'not_authenticated'],
  [/not_found/i, 'not_found'],
  [/reason_required|days_required/i, 'reason_required'],
  [/bad_message/i, 'bad_message'],
  [/invalid_players/i, 'invalid_players'],
];

export function errorKey(message: string | undefined | null): string {
  const m = message ?? '';
  for (const [re, key] of MAP) if (re.test(m)) return key;
  return 'generic';
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
