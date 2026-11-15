import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { Layout } from './Layout'
import { DashboardPage } from './pages/Dashboard'
import { FocusPage } from './pages/Focus'
import { QuestsPage } from './pages/Quests'
import { RewardsPage } from './pages/Rewards'

// Cây route (code-based): một route gốc chứa layout, bốn route con là bốn trang
const rootRoute = createRootRoute({ component: Layout })

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: DashboardPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/focus', component: FocusPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/quests', component: QuestsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/rewards', component: RewardsPage }),
])

export const router = createRouter({ routeTree })

// Đăng ký kiểu của router: nhờ đó navigate({ to: '/focuss' }) sẽ bị TypeScript báo lỗi
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
