import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Alert, Box, Button, Card, CardContent, LinearProgress, Stack, Typography } from '@mui/material'
import { api, type Session, type Stats } from '../api'
import { fmtDateTime, fmtWeekday } from '../format'

export function DashboardPage() {
  // Cùng queryKey ['me'] với thanh trên cùng, nên hai nơi dùng chung một lần gọi API
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: api.sessions })

  if (me.isPending) return <Typography color="text.secondary">Đang tải…</Typography>
  if (me.isError) return <Alert severity="error">{me.error.message}</Alert>

  return (
    <Stack spacing={2}>
      <LevelCard stats={me.data} />
      <StatRow stats={me.data} />
      <WeekChart days={me.data.last7} />
      <RecentSessions sessions={sessions.data ?? []} />
    </Stack>
  )
}

// ----- Các component bên dưới chỉ nhận props rồi vẽ, không tự gọi API -----

function LevelCard({ stats }: { stats: Stats }) {
  const navigate = useNavigate()
  const percent = Math.min(100, Math.round((stats.xpIntoLevel / stats.xpForNext) * 100))

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 76,
              height: 76,
              flexShrink: 0,
              borderRadius: '50%',
              border: 3,
              borderColor: 'secondary.main',
              display: 'grid',
              placeContent: 'center',
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
              LEVEL
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              {stats.level}
            </Typography>
          </Box>

          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Typography>
                {stats.xpIntoLevel} / {stats.xpForNext} XP
              </Typography>
              <Typography color="text.secondary">
                còn {stats.xpForNext - stats.xpIntoLevel} XP nữa lên level {stats.level + 1}
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={percent} sx={{ height: 8, borderRadius: 4 }} />
            <Button variant="contained" onClick={() => navigate({ to: '/focus' })}>
              Bắt đầu phiên focus
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

function StatRow({ stats }: { stats: Stats }) {
  const items = [
    { label: 'Streak', value: `🔥 ${stats.streak} ngày` },
    { label: 'Hôm nay', value: `${stats.todayMinutes} phút` },
    { label: 'Phiên đã xong', value: String(stats.sessionsCompleted) },
    { label: 'Tổng XP', value: String(stats.totalXp) },
  ]

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' } }}>
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              {item.label}
            </Typography>
            <Typography variant="h6">{item.value}</Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  )
}

function WeekChart({ days }: { days: Stats['last7'] }) {
  // Sàn 60 phút: một ngày chỉ focus 10 phút sẽ không bị vẽ thành cột cao kịch trần
  const max = Math.max(60, ...days.map((d) => d.minutes))
  const empty = days.every((d) => d.minutes === 0)

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          7 ngày gần nhất
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          role="img"
          aria-label="Số phút focus theo ngày"
          sx={{ height: 140, alignItems: 'flex-end' }}
        >
          {days.map((d) => (
            <Stack key={d.day} spacing={0.5} sx={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }}>
              <Typography variant="caption">{d.minutes > 0 ? d.minutes : ''}</Typography>
              <Box
                sx={{
                  width: '100%',
                  maxWidth: 48,
                  height: `${(d.minutes / max) * 100}%`,
                  minHeight: 3,
                  borderRadius: 1,
                  bgcolor: d.minutes > 0 ? 'primary.main' : 'action.disabledBackground',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {fmtWeekday(d.day)}
              </Typography>
            </Stack>
          ))}
        </Stack>
        {empty && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Chưa có phút focus nào trong 7 ngày qua. Số trên mỗi cột là số phút của ngày đó.
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

function RecentSessions({ sessions }: { sessions: Session[] }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Phiên gần đây
        </Typography>
        {sessions.length === 0 ? (
          <Typography color="text.secondary">Chưa có phiên nào. Bắt đầu phiên đầu tiên đi.</Typography>
        ) : (
          <Stack spacing={1}>
            {sessions.slice(0, 8).map((s) => (
              <Stack key={s.id} direction="row" sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography>
                  {s.status === 'completed' ? '✅' : '💀'} {s.topic || 'Không đặt chủ đề'}
                  <Typography component="span" color="text.secondary">
                    {' '}
                    · {s.planned_minutes} phút
                  </Typography>
                </Typography>
                <Typography color="text.secondary">
                  {s.status === 'completed' ? `+${s.xp_earned} XP` : 'bỏ dở'}
                  {s.ended_at ? ` · ${fmtDateTime(s.ended_at)}` : ''}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}
