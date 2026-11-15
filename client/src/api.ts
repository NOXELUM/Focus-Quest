// Mọi lời gọi tới server đi qua file này. Type ở đây phải khớp với JSON mà server trả về.

export type Stats = {
  totalXp: number
  spentXp: number
  spendableXp: number
  level: number
  xpIntoLevel: number
  xpForNext: number
  streak: number
  todayMinutes: number
  sessionsCompleted: number
  questsDone: number
  last7: { day: string; minutes: number }[]
}

export type Session = {
  id: number
  topic: string
  planned_minutes: number
  started_at: number
  ended_at: number | null
  status: 'active' | 'completed' | 'abandoned'
  distractions: number
  xp_earned: number
}

export type Quest = {
  id: number
  title: string
  description: string
  xp: number
  kind: 'daily' | 'learn'
  status: 'open' | 'done'
  note: string
  created_at: number
  done_at: number | null
}

export type Reward = { id: number; title: string; cost_xp: number; created_at: number }

export type Redemption = {
  id: number
  reward_id: number | null
  title: string
  cost_xp: number
  redeemed_at: number
}

// fetch + parse JSON + biến lỗi HTTP thành Error (để TanStack Query bắt được)
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Lỗi ${res.status}`)
  return data as T
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

const del = <T>(path: string) => request<T>(path, { method: 'DELETE' })

export const api = {
  me: () => request<Stats>('/me'),

  activeSession: () => request<{ session: Session | null; serverNow: number }>('/sessions/active'),
  sessions: () => request<Session[]>('/sessions'),
  startSession: (body: { minutes: number; topic: string }) =>
    post<{ session: Session; serverNow: number }>('/sessions', body),
  completeSession: (id: number) =>
    post<{ xpEarned: number; distractions: number; stats: Stats }>(`/sessions/${id}/complete`),
  abandonSession: (id: number) => post<{ ok: true }>(`/sessions/${id}/abandon`),
  distraction: (id: number) => post<{ distractions: number }>(`/sessions/${id}/distraction`),

  quests: () => request<Quest[]>('/quests'),
  addQuest: (body: { title: string; description: string; xp: number; kind: Quest['kind'] }) =>
    post<Quest>('/quests', body),
  completeQuest: (id: number, note: string) =>
    post<{ xpEarned: number; stats: Stats }>(`/quests/${id}/complete`, { note }),
  deleteQuest: (id: number) => del<{ ok: true }>(`/quests/${id}`),

  rewards: () => request<Reward[]>('/rewards'),
  addReward: (body: { title: string; cost_xp: number }) => post<Reward>('/rewards', body),
  deleteReward: (id: number) => del<{ ok: true }>(`/rewards/${id}`),
  redeem: (id: number) => post<{ ok: true; stats: Stats }>(`/rewards/${id}/redeem`),
  redemptions: () => request<Redemption[]>('/redemptions'),
}
