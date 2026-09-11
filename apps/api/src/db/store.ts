/**
 * Úložiště.
 *
 * Rozhraní je záměrně úzké: API nesmí skládat SQL ad hoc po celém kódu.
 * `MemoryStore` slouží pro vývoj a testy; produkční implementace nad
 * Postgresem se připojí, jakmile budou přístupové údaje (viz PLAN.md §6).
 */

export interface UserRecord {
  id: string;
  nickname: string;
  role: 'player' | 'moderator' | 'admin';
}

export interface RunRecord {
  id: string;
  userId: string | null;
  gameSlug: string;
  mode: string;
  seed: string;
  score: number;
  durationMs: number;
  status: 'pending' | 'validated' | 'rejected' | 'flagged';
  rejectReason?: string;
  createdAt: number;
}

export interface LeaderboardRow {
  rank: number;
  nickname: string;
  score: number;
  userId: string;
}

export type Period = 'dnes' | 'tyden' | 'navzdy';

export interface Store {
  getUserBySession(tokenHash: string): Promise<UserRecord | null>;
  createRun(run: Omit<RunRecord, 'createdAt'>): Promise<void>;
  getRun(id: string): Promise<RunRecord | null>;
  finishRun(id: string, patch: Pick<RunRecord, 'score' | 'durationMs' | 'status' | 'rejectReason'>): Promise<void>;
  /** Počet čekajících běhů hráče v dané hře — brání hromadění seedů. */
  countPendingRuns(userId: string, gameSlug: string, mode: string): Promise<number>;
  leaderboard(gameSlug: string, mode: string, period: Period, limit: number): Promise<LeaderboardRow[]>;
  recordLeaderboardEntry(gameSlug: string, mode: string, userId: string, nickname: string, score: number, scoring: 'high' | 'low'): Promise<void>;
  /** Odpověď denní slovní hry. Nikdy se neposílá klientovi. */
  dailyAnswer(gameSlug: string, date: string): Promise<string | null>;
  setDailyAnswer(gameSlug: string, date: string, answer: string): Promise<void>;
}

interface BoardEntry {
  userId: string;
  nickname: string;
  score: number;
  at: number;
}

export function createMemoryStore(): Store {
  const sessions = new Map<string, UserRecord>();
  const runs = new Map<string, RunRecord>();
  const boards = new Map<string, BoardEntry[]>();
  const answers = new Map<string, string>();

  const boardKey = (slug: string, mode: string): string => `${slug}:${mode}`;

  const withinPeriod = (at: number, period: Period): boolean => {
    if (period === 'navzdy') return true;
    const day = 86_400_000;
    const age = Date.now() - at;
    return period === 'dnes' ? age < day : age < 7 * day;
  };

  return {
    async getUserBySession(tokenHash) {
      return sessions.get(tokenHash) ?? null;
    },

    async createRun(run) {
      runs.set(run.id, { ...run, createdAt: Date.now() });
    },

    async getRun(id) {
      return runs.get(id) ?? null;
    },

    async finishRun(id, patch) {
      const run = runs.get(id);
      if (run) Object.assign(run, patch);
    },

    async countPendingRuns(userId, gameSlug, mode) {
      let count = 0;
      for (const run of runs.values()) {
        if (run.userId === userId && run.gameSlug === gameSlug && run.mode === mode && run.status === 'pending') {
          count++;
        }
      }
      return count;
    },

    async leaderboard(gameSlug, mode, period, limit) {
      const entries = (boards.get(boardKey(gameSlug, mode)) ?? [])
        .filter((entry) => withinPeriod(entry.at, period));

      // Jeden zápis na hráče — v žebříčku se neopakuje.
      const best = new Map<string, BoardEntry>();
      for (const entry of entries) {
        const current = best.get(entry.userId);
        if (!current || entry.score > current.score) best.set(entry.userId, entry);
      }

      return [...best.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry, index) => ({
          rank: index + 1,
          nickname: entry.nickname,
          score: entry.score,
          userId: entry.userId,
        }));
    },

    async recordLeaderboardEntry(gameSlug, mode, userId, nickname, score) {
      const key = boardKey(gameSlug, mode);
      const list = boards.get(key) ?? [];
      list.push({ userId, nickname, score, at: Date.now() });
      boards.set(key, list);
    },

    async dailyAnswer(gameSlug, date) {
      return answers.get(`${gameSlug}:${date}`) ?? null;
    },

    async setDailyAnswer(gameSlug, date, answer) {
      answers.set(`${gameSlug}:${date}`, answer);
    },
  };
}
