import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material'
import { api, type Redemption, type Reward } from '../api'
import { fmtDateTime } from '../format'

export function RewardsPage() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const rewards = useQuery({ queryKey: ['rewards'], queryFn: api.rewards })

  // TODO(bạn) Bài 3: lấy lịch sử đổi thưởng từ server (làm Bài 1 ở server trước).
  // Thay dòng `const history` bên dưới bằng một useQuery:
  //   - queryKey: ['redemptions']
  //   - queryFn: api.redemptions   (đã viết sẵn trong api.ts)
  // rồi truyền `data ?? []` của query đó vào <RedemptionHistory />.
  // Bắt chước hai dòng useQuery ngay phía trên.
  const history: Redemption[] = []

  if (me.isPending || rewards.isPending) return <Typography color="text.secondary">Đang tải…</Typography>
  if (me.isError) return <Alert severity="error">{me.error.message}</Alert>
  if (rewards.isError) return <Alert severity="error">{rewards.error.message}</Alert>

  const spendableXp = me.data.spendableXp

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            XP tiêu được
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            ⚡ {spendableXp}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Đổi thưởng chỉ trừ XP tiêu được, không làm tụt level.
          </Typography>
        </CardContent>
      </Card>

      <Typography variant="h6">Cửa hàng</Typography>
      {rewards.data.length === 0 && <Typography color="text.secondary">Chưa có phần thưởng nào.</Typography>}
      {rewards.data.map((r) => (
        <RewardCard key={r.id} reward={r} spendableXp={spendableXp} />
      ))}

      <AddRewardForm />
      <RedemptionHistory items={history} />
    </Stack>
  )
}

function RewardCard({ reward, spendableXp }: { reward: Reward; spendableXp: number }) {
  const queryClient = useQueryClient()
  const missing = reward.cost_xp - spendableXp

  const redeem = useMutation({
    mutationFn: () => api.redeem(reward.id),
    onSuccess: () => queryClient.invalidateQueries(),
  })

  // TODO(bạn) Bài 4: nút "Xoá" phần thưởng (làm Bài 2 ở server trước).
  // 1. Tạo một useMutation tên `remove`:
  //      mutationFn gọi api.deleteReward(reward.id)
  //      onSuccess báo query ['rewards'] tải lại (queryClient.invalidateQueries({ queryKey: [...] }))
  // 2. Trong handleDelete: hỏi window.confirm('Xoá phần thưởng này?'), đồng ý thì gọi remove.mutate()
  // Bắt chước nút "Xoá" của QuestCard trong Quests.tsx.
  const handleDelete = () => {
    window.alert('Chưa làm: xem TODO Bài 4 trong client/src/pages/Rewards.tsx')
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={1}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Stack>
              <Typography sx={{ fontWeight: 600 }}>🎁 {reward.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {reward.cost_xp} XP{missing > 0 ? ` · còn thiếu ${missing} XP` : ''}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled={missing > 0 || redeem.isPending} onClick={() => redeem.mutate()}>
                Đổi
              </Button>
              <Button color="inherit" onClick={handleDelete}>
                Xoá
              </Button>
            </Stack>
          </Stack>
          {redeem.isError && <Alert severity="error">{redeem.error.message}</Alert>}
          {redeem.isSuccess && <Alert severity="success">Đã đổi. Tận hưởng đi, mày xứng đáng.</Alert>}
        </Stack>
      </CardContent>
    </Card>
  )
}

function AddRewardForm() {
  const queryClient = useQueryClient()
  const add = useMutation({
    mutationFn: api.addReward,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rewards'] }),
  })

  const form = useForm({
    defaultValues: { title: '', cost_xp: 50 },
    onSubmit: async ({ value, formApi }) => {
      await add.mutateAsync({ title: value.title.trim(), cost_xp: value.cost_xp })
      formApi.reset()
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
          <Typography variant="h6">Thêm phần thưởng</Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <form.Field
              name="title"
              validators={{ onChange: ({ value }) => (value.trim() ? undefined : 'Cần có tên phần thưởng') }}
            >
              {(field) => {
                const showError = field.state.meta.isTouched && field.state.meta.errors.length > 0
                return (
                  <TextField
                    label="Tên phần thưởng"
                    placeholder="vd: 1 tập phim"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={showError}
                    helperText={showError ? field.state.meta.errors.map(String).join(', ') : ''}
                    slotProps={{ htmlInput: { maxLength: 120 } }}
                    sx={{ flex: 1 }}
                  />
                )
              }}
            </form.Field>

            <form.Field
              name="cost_xp"
              validators={{
                onChange: ({ value }) =>
                  !Number.isInteger(value) || value < 1 || value > 100_000 ? 'Giá từ 1 đến 100000' : undefined,
              }}
            >
              {(field) => (
                <TextField
                  type="number"
                  label="Giá (XP)"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors.length > 0}
                  helperText={field.state.meta.errors.map(String).join(', ')}
                  sx={{ width: { sm: 160 } }}
                />
              )}
            </form.Field>
          </Stack>

          {add.isError && <Alert severity="error">{add.error.message}</Alert>}

          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => (
              <Button type="submit" variant="contained" disabled={!canSubmit || isSubmitting}>
                Thêm phần thưởng
              </Button>
            )}
          </form.Subscribe>
        </Stack>
      </CardContent>
    </Card>
  )
}

// Chỉ nhận props rồi vẽ. Dữ liệu do RewardsPage lấy về (Bài 3).
function RedemptionHistory({ items }: { items: Redemption[] }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Lịch sử đổi thưởng
        </Typography>
        {items.length === 0 ? (
          <Typography color="text.secondary">Chưa đổi phần thưởng nào.</Typography>
        ) : (
          <Stack spacing={1}>
            {items.map((x) => (
              <Stack key={x.id} direction="row" sx={{ justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Typography>🎁 {x.title}</Typography>
                <Typography color="text.secondary">
                  −{x.cost_xp} XP · {fmtDateTime(x.redeemed_at)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}
