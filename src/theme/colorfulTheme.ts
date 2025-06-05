import { createTheme } from '@mui/material/styles';

export const colorfulTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0066FF', contrastText: '#fff' }, // Royal blue
    secondary: { main: '#00D4AA', contrastText: '#fff' }, // Emerald
    info: { main: '#8A2BE2', contrastText: '#fff' }, // Purple
    background: {
      // Use a fallback color for MUI, but apply the gradient in your layout/container
      default: '#e3e6ff', // fallback for places that require a solid color
      paper: '#fff',
      // Use a fallback color for MUI, but apply the gradient in your layout/container
    },
    text: { primary: '#222', secondary: '#555' },
    divider: '#e0e0e0',
  },
  typography: {
    fontFamily: '"Poppins", "Montserrat", "system-ui", sans-serif',
    fontWeightLight: 300,
    fontWeightMedium: 600,
    h1: { fontWeight: 700, letterSpacing: '0.04em', color: '#0066FF' },
    h2: { fontWeight: 600, color: '#00D4AA' },
    h3: { fontWeight: 600, color: '#8A2BE2' },
    h4: { fontWeight: 500 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 400 },
  },
  shape: { borderRadius: 16 },
  shadows: [
    "none",
    ...Array(24).fill('0 4px 24px 0 rgba(0,102,255,0.10)')
  ] as [
    "none", string, string, string, string, string, string, string, string, string,
    string, string, string, string, string, string, string, string, string, string,
    string, string, string, string, string
  ],
});