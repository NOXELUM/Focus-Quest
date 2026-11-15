import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { api, type Quest } from '../api'

// Phải khớp với NOTE_MIN_LENGTH ở server. Client khoá nút cho tiện, server mới là nơi quyết định.
const NOTE_MIN_LENGTH = 30

export function QuestsPage() {
  const quests = useQuery({ queryKey: ['quests'], queryFn: api.quests })

  if (quests.isPending) return <Typography color="text.secondary">Đang tải…</Typography>
  if (quests.isError) return <Alert severity="error">{quests.error.message}</Alert>

  const open = quests.data.filter((q) => q.status === 'open')
  const done = quests.data.filter((q) => q.status === 'done')

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Quest đang mở</Typography>
      {open.length === 0 && <Typography color="text.secondary">Hết quest. Thêm quest mới bên dưới.</Typography>}
      {open.map((q) => (
        <QuestCard key={q.id} quest={q} />
      ))}

      <AddQuestForm />

      {done.length > 0 && (
        <>
          <Typography variant="h6">Đã xong ({done.length})</Typography>
          {done.map((q) => (
            <Card key={q.id} sx={{ opacity: 0.75 }}>
              <CardContent>
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>✅ {q.title}</Typography>
                  <Typography color="text.secondary" sx={{ flexShrink: 0 }}>
                    +{q.xp} XP
                  </Typography>
                </Stack>
                {q.note && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                    {q.note}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </Stack>
  )
}

function QuestCard({ quest }: { quest: Quest }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const needsNote = quest.kind === 'learn'
  const noteLength = note.trim().length

  // Hoàn thành quest làm đổi XP, level, streak: báo mọi query tải lại cho chắc
  const complete = useMutation({
    mutationFn: () => api.completeQuest(quest.id, note),
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteQuest(quest.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quests'] }),
  })
  const error = complete.error ?? remove.error

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>
              {needsNote ? '🧠' : '📅'} {quest.title}
            </Typography>
            <Chip size="small" color="secondary" label={`+${quest.xp} XP`} />
          </Stack>
          {quest.description && <Typography color="text.secondary">{quest.description}</Typography>}

          {needsNote && (
            <TextField
              multiline
              minRows={3}
              label="Giải thích lại bằng lời của mình"
              placeholder="Hàm này làm gì, tại sao viết vậy, nếu bỏ dòng X thì sao…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              helperText={`${noteLength} / tối thiểu ${NOTE_MIN_LENGTH} ký tự`}
            />
          )}

          {error && <Alert severity="error">{error.message}</Alert>}

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              disabled={complete.isPending || (needsNote && noteLength < NOTE_MIN_LENGTH)}
              onClick={() => complete.mutate()}
            >
              Hoàn thành
            </Button>
            <Button
              color="inherit"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm('Xoá quest này?')) remove.mutate()
              }}
            >
              Xoá
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

function AddQuestForm() {
  const queryClient = useQueryClient()
  const add = useMutation({
    mutationFn: api.addQuest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quests'] }),
  })

  const form = useForm({
    defaultValues: { title: '', description: '', xp: 30, kind: 'learn' as Quest['kind'] },
    onSubmit: async ({ value, formApi }) => {
      await add.mutateAsync({ ...value, title: value.title.trim(), description: value.description.trim() })
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
          <Typography variant="h6">Thêm quest</Typography>

          <form.Field
            name="title"
            validators={{ onChange: ({ value }) => (value.trim() ? undefined : 'Cần có tiêu đề') }}
          >
            {(field) => {
              // Chỉ hiện lỗi sau khi người dùng đã chạm vào ô, tránh đỏ ngay từ đầu
              const showError = field.state.meta.isTouched && field.state.meta.errors.length > 0
              return (
                <TextField
                  label="Tiêu đề"
                  placeholder="vd: Đọc hiểu middleware xử lý lỗi"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  error={showError}
                  helperText={showError ? field.state.meta.errors.map(String).join(', ') : ''}
                  slotProps={{ htmlInput: { maxLength: 120 } }}
                />
              )
            }}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <TextField
                multiline
                minRows={2}
                label="Mô tả (tuỳ chọn)"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
            )}
          </form.Field>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <form.Field
              name="xp"
              validators={{
                onChange: ({ value }) =>
                  !Number.isInteger(value) || value < 1 || value > 500 ? 'XP từ 1 đến 500' : undefined,
              }}
            >
              {(field) => (
                <TextField
                  type="number"
                  label="XP"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors.length > 0}
                  helperText={field.state.meta.errors.map(String).join(', ')}
                  sx={{ width: { sm: 140 } }}
                />
              )}
            </form.Field>

            <form.Field name="kind">
              {(field) => (
                <TextField
                  select
                  label="Loại"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value as Quest['kind'])}
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="learn">🧠 Học (bắt buộc ghi chú)</MenuItem>
                  <MenuItem value="daily">📅 Việc hằng ngày</MenuItem>
                </TextField>
              )}
            </form.Field>
          </Stack>

          {add.isError && <Alert severity="error">{add.error.message}</Alert>}

          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => (
              <Button type="submit" variant="contained" disabled={!canSubmit || isSubmitting}>
                Thêm quest
              </Button>
            )}
          </form.Subscribe>
        </Stack>
      </CardContent>
    </Card>
  )
}
