// Các hàm đổi số thành chữ để hiển thị

const pad = (n: number) => String(n).padStart(2, '0')

// 125000 ms -> '02:05'
export function fmtClock(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000)
  return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`
}

// '2026-11-14' -> 'T7'
export function fmtWeekday(day: string) {
  const names = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  return names[new Date(`${day}T00:00:00Z`).getUTCDay()]
}

// epoch ms -> '14/11 21:30'
export function fmtDateTime(ms: number) {
  const d = new Date(ms)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
