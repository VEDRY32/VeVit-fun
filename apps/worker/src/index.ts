/**
 * Worker — plánované úlohy portálu.
 *
 * Běží jako samostatný kontejner s TZ=Europe/Prague. Do databáze nesahá
 * přímo: všechno jde přes API, aby platila stejná pravidla jako pro hráče
 * a existoval jeden audit log.
 */

import { createScheduler } from './schedule.js';
import { allJobs } from './jobs.js';
import { ANSWERS } from './words.js';

const API_BASE = process.env.API_BASE ?? 'http://api:3001';
const ORIGIN_KEY = process.env.ORIGIN_KEY ?? '';

async function callApi(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      ...(ORIGIN_KEY ? { 'x-vevit-origin-key': ORIGIN_KEY } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`${path} vrátilo ${response.status}`);
  }
  return response.json().catch(() => null);
}

const scheduler = createScheduler(allJobs({ api: callApi, answers: ANSWERS }));
scheduler.start();
console.log('[worker] plánovač běží');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    scheduler.stop();
    process.exit(0);
  });
}
