/** Konfigurace API. Tajemství jen z prostředí, nikdy z repa. */

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Chybí povinná proměnná prostředí ${name}.`);
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT ?? 3001),
  isProduction,

  databaseUrl: process.env.DATABASE_URL ?? '',
  schema: process.env.DATABASE_SCHEMA ?? 'games',
  redisUrl: process.env.REDIS_URL ?? '',

  authProvider: (process.env.AUTH_PROVIDER ?? 'local') as 'local' | 'vevit-sso',
  // V produkci se na výchozí hodnotu nespoléháme — chybějící tajemství
  // musí shodit start, ne tiše oslabit podpisy.
  sessionSecret: isProduction ? required('SESSION_SECRET') : (process.env.SESSION_SECRET ?? 'vyvojove-tajemstvi'),
  sessionCookie: process.env.SESSION_COOKIE ?? '__Host-vvfsession',
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 30),

  rtTicketSecret: isProduction ? required('RT_TICKET_SECRET') : (process.env.RT_TICKET_SECRET ?? 'vyvojovy-ticket'),
  rtTicketTtlSeconds: 60,
  rtAllowedOrigins: (process.env.RT_ALLOWED_ORIGINS ?? 'http://localhost:5173').split(','),

  /** Sdílené tajemství, když portál běží za cizím reverse proxy (D-002). */
  originKey: process.env.ORIGIN_KEY ?? '',

  timezone: 'Europe/Prague',
} as const;
