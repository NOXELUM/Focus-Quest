import { useQuery } from '@tanstack/react-query'

// queryFn: hàm đi lấy dữ liệu. Phải trả về Promise.
async function fetchHealth(): Promise<{ ok: boolean }> {
  const res = await fetch('/api/health')
  if (!res.ok) throw new Error(`Lỗi ${res.status}`)
  return res.json()
}

function App() {
  // queryKey là "tên" của dữ liệu trong cache
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth })

  if (health.isPending) return <p>Đang tải…</p>
  if (health.isError) return <p>Lỗi: {health.error.message}</p>

  return <p>Server trả về: {JSON.stringify(health.data)}</p>
}

export default App
