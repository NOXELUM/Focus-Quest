import { useEffect, useRef, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, CardContent, Chip, LinearProgress, Stack, TextField, Typography } from '@mui/material'
import { api, type Session } from '../api'
import { fmtClock } from '../format'

// Rời tab/cửa sổ lâu hơn ngưỡng này thì phiên bị huỷ
const ABANDON_AFTER_S = 15
// Rời ngắn hơn ngưỡng này thì bỏ qua (lỡ tay)
const IGNORE_BELOW_S = 2
const PRESETS = [15, 25, 45, 60]

type Outcome = { kind: 'done'; xp: number; distractions: number } | { kind: 'abandoned'; reason: string }

// Lấy phiên đang chạy, tính luôn độ lệch đồng hồ giữa server và máy mình (skew)
async function fetchActive() {
  const r = await api.activeSession()
  return { session: r.session, skew: r.serverNow - Date.now() }
}

export function FocusPage() {
  const active = useQuery({
    queryKey: ['activeSession'],
    queryFn: fetchActive,
    // Quay lại tab không cần gọi lại: việc rời tab đã do Timer tự xử lý
    refetchOnWindowFocus: false,
  })
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  if (active.isPending) return <Typography color="text.secondary">Đang tải…</Typography>
  if (active.isError) return <Alert severity="error">{active.error.message}</Alert>

  const { session, skew } = active.data

  // key={session.id}: sang phiên khác thì React tạo Timer mới hoàn toàn, không dùng lại state cũ
  if (session) return <Timer key={session.id} session={session} skew={skew} onEnd={setOutcome} />

  return (
    <Stack spacing={2}>
      {outcome && <OutcomeCard outcome={outcome} onClose={() => setOutcome(null)} />}
      <StartForm onStarted={() => setOutcome(null)} />
    </Stack>
  )
}

function OutcomeCard({ outcome, onClose }: { outcome: Outcome; onClose: () => void }) {
  if (outcome.kind === 'done') {
    return (
      <Alert severity="success" onClose={onClose}>
        <strong>🎉 Xong phiên! +{outcome.xp} XP.</strong>{' '}
        {outcome.distractions === 0
          ? 'Không bị phân tâm lần nào, giữ phong độ này.'
          : `Bị phân tâm ${outcome.distractions} lần nên XP bị trừ.`}
      </Alert>
    )
  }
  return (
    <Alert severity="error" onClose={onClose}>
      <strong>💀 Phiên bị huỷ.</strong> {outcome.reason}
    </Alert>
  )
}

function StartForm({ onStarted }: { onStarted: () => void }) {
  const queryClient = useQueryClient()

  // useMutation: dùng cho thao tác GHI. Thành công thì báo các query tải lại.
  const start = useMutation({
    mutationFn: api.startSession,
    onSuccess: () => {
      onStarted()
      queryClient.invalidateQueries()
    },
  })

  const form = useForm({
    defaultValues: { topic: '', minutes: 25 },
    onSubmit: async ({ value }) => {
      await start.mutateAsync({ topic: value.topic.trim(), minutes: value.minutes })
    },
  })

  return (
    <Card
      component="form"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Phiên focus mới</Typography>

          <form.Field name="topic">
            {(field) => (
              <TextField
                label="Học/làm gì trong phiên này?"
                placeholder="vd: đọc hiểu useQuery, viết route Express…"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                slotProps={{ htmlInput: { maxLength: 120 } }}
              />
            )}
          </form.Field>

          {/*
            TODO(bạn) Bài 5: thêm kiểm tra cho ô số phút.
            Thêm prop `validators` vào <form.Field name="minutes"> bên dưới:
              validators={{ onChange: ({ value }) => (điều kiện sai ? 'thông báo lỗi' : undefined) }}
            Luật: phải là số nguyên từ 1 đến 180 (gợi ý: Number.isInteger).
            Phần hiện lỗi (error, helperText) và khoá nút "Bắt đầu" đã nối sẵn, viết xong là thấy ngay.
            Hiện tại nhập 999 vẫn bấm được, và chỉ server mới từ chối.
          */}
          <form.Field name="minutes">
            {(field) => (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  Thời lượng (phút)
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                  {PRESETS.map((m) => (
                    <Chip
                      key={m}
                      label={m}
                      clickable
                      color={field.state.value === m ? 'primary' : 'default'}
                      onClick={() => field.handleChange(m)}
                    />
                  ))}
                  <TextField
                    type="number"
                    size="small"
                    slotProps={{ htmlInput: { 'aria-label': 'Số phút' } }}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors.length > 0}
                    helperText={field.state.meta.errors.map(String).join(', ')}
                    sx={{ width: 110 }}
                  />
                </Stack>
              </Stack>
            )}
          </form.Field>

          <Typography variant="body2" color="text.secondary">
            1 XP mỗi phút, phiên từ 45 phút được +5 XP. Rời tab/cửa sổ quá {ABANDON_AFTER_S} giây là phiên bị huỷ và mất
            hết XP. Rời ngắn hơn thì trừ 10% XP mỗi lần.
          </Typography>

          {start.isError && <Alert severity="error">{start.error.message}</Alert>}

          {/* form.Subscribe: chỉ vẽ lại nút này khi canSubmit / isSubmitting đổi */}
          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => (
              <Button type="submit" variant="contained" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? 'Đang bắt đầu…' : 'Bắt đầu'}
              </Button>
            )}
          </form.Subscribe>
        </Stack>
      </CardContent>
    </Card>
  )
}

function Timer({ session, skew, onEnd }: { session: Session; skew: number; onEnd: (o: Outcome) => void }) {
  const queryClient = useQueryClient()
  const totalMs = session.planned_minutes * 60_000
  const endAt = session.started_at + totalMs

  // Không tự đếm từng giây: mỗi 250ms lấy lại giờ thật rồi tính thời gian còn lại.
  // Nhờ vậy đồng hồ vẫn đúng kể cả khi trình duyệt làm chậm tab.
  const [now, setNow] = useState(() => Date.now() + skew)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + skew), 250)
    return () => clearInterval(timer)
  }, [skew])

  const remaining = Math.max(0, endAt - now)
  const finished = remaining === 0
  const [warning, setWarning] = useState<string | null>(null)

  const complete = useMutation({
    mutationFn: () => api.completeSession(session.id),
    onSuccess: (r) => {
      onEnd({ kind: 'done', xp: r.xpEarned, distractions: r.distractions })
      queryClient.invalidateQueries()
    },
  })

  const abandon = useMutation({
    mutationFn: async (reason: string) => {
      await api.abandonSession(session.id)
      return reason
    },
    onSuccess: (reason) => {
      onEnd({ kind: 'abandoned', reason })
      queryClient.invalidateQueries()
    },
  })

  const distraction = useMutation({
    mutationFn: () => api.distraction(session.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activeSession'] }),
  })

  // Hàm mutate không đổi giữa các lần render nên đưa vào dependency của useEffect được
  const { mutate: completeNow } = complete
  const { mutate: abandonNow } = abandon
  const { mutate: countDistraction } = distraction

  // Hết giờ thì tự gọi hoàn thành, đúng một lần
  const fired = useRef(false)
  useEffect(() => {
    if (finished && !fired.current) {
      fired.current = true
      completeNow()
    }
  }, [finished, completeNow])

  // Phát hiện rời tab / mất focus cửa sổ
  const awaySince = useRef<number | null>(null)
  useEffect(() => {
    if (finished) return

    const check = () => {
      const away = document.visibilityState === 'hidden' || !document.hasFocus()
      if (away && awaySince.current === null) {
        awaySince.current = Date.now() // bắt đầu rời đi
      } else if (!away && awaySince.current !== null) {
        const seconds = (Date.now() - awaySince.current) / 1000 // vừa quay lại
        awaySince.current = null
        if (seconds > ABANDON_AFTER_S) {
          abandonNow(`Rời tab ${Math.round(seconds)} giây (giới hạn ${ABANDON_AFTER_S} giây).`)
        } else if (seconds >= IGNORE_BELOW_S) {
          countDistraction()
          setWarning(`Vừa rời tab ${Math.round(seconds)} giây: bị trừ 10% XP.`)
        }
      }
    }

    document.addEventListener('visibilitychange', check)
    window.addEventListener('blur', check)
    window.addEventListener('focus', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('blur', check)
      window.removeEventListener('focus', check)
    }
  }, [finished, abandonNow, countDistraction])

  // Hỏi lại khi định đóng/reload tab giữa chừng
  useEffect(() => {
    if (finished) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [finished])

  // Hiện thời gian còn lại trên tiêu đề tab
  useEffect(() => {
    document.title = `${fmtClock(remaining)} · Focus Quest`
    return () => {
      document.title = 'Focus Quest'
    }
  }, [remaining])

  const error = complete.error ?? abandon.error

  return (
    <Card>
      <CardContent>
        <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Typography color="text.secondary">{session.topic || 'Đang focus'}</Typography>
          <Typography sx={{ fontSize: { xs: 64, sm: 88 }, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {fmtClock(remaining)}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, ((totalMs - remaining) / totalMs) * 100)}
            sx={{ width: '100%', height: 8, borderRadius: 4 }}
          />
          <Stack direction="row" sx={{ width: '100%', justifyContent: 'space-between' }}>
            <Typography color="text.secondary">Phân tâm: {session.distractions}</Typography>
            <Typography color="text.secondary">{session.planned_minutes} phút</Typography>
          </Stack>

          {warning && (
            <Alert severity="warning" sx={{ width: '100%' }}>
              {warning}
            </Alert>
          )}
          {error && (
            <Alert
              severity="error"
              sx={{ width: '100%' }}
              action={
                finished && (
                  <Button color="inherit" size="small" onClick={() => completeNow()}>
                    Thử lại
                  </Button>
                )
              }
            >
              {error.message}
            </Alert>
          )}

          {!finished && (
            <Button
              color="error"
              variant="outlined"
              disabled={abandon.isPending}
              onClick={() => {
                if (window.confirm('Bỏ phiên này? Sẽ không nhận được XP.')) abandonNow('Tự bỏ giữa chừng.')
              }}
            >
              Bỏ phiên
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
