import { useQuery } from '@tanstack/react-query'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Box, Chip, Container, Stack, Tab, Tabs, Typography } from '@mui/material'
import { api } from './api'

const NAV = [
  { to: '/', label: 'Tổng quan' },
  { to: '/focus', label: 'Focus' },
  { to: '/quests', label: 'Quest' },
  { to: '/rewards', label: 'Thưởng' },
] as const

// Layout chung: thanh trên + thanh điều hướng. <Outlet /> là chỗ trang con hiện ra.
export function Layout() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h6">⚔️ Focus Quest</Typography>
        {me.data && (
          <Stack direction="row" spacing={1}>
            <Chip size="small" label={`Lv ${me.data.level}`} color="primary" />
            <Chip size="small" label={`🔥 ${me.data.streak}`} />
            <Chip size="small" label={`⚡ ${me.data.spendableXp}`} />
          </Stack>
        )}
      </Stack>

      <Tabs
        value={NAV.some((n) => n.to === pathname) ? pathname : false}
        onChange={(_e, to: (typeof NAV)[number]['to']) => navigate({ to })}
        variant="fullWidth"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {NAV.map((n) => (
          <Tab key={n.to} value={n.to} label={n.label} />
        ))}
      </Tabs>

      <Box component="main">
        <Outlet />
      </Box>
    </Container>
  )
}
