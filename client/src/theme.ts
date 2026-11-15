import { createTheme } from '@mui/material/styles'

// Theme của MUI: khai báo màu, bo góc, font một lần, mọi component tự dùng theo
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#8b7cf6' },
    secondary: { main: '#f5a524' },
    background: { default: '#0f1220', paper: '#171b2e' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
})
