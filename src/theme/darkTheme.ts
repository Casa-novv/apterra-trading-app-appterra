import { createTheme } from '@mui/material/styles';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00FF99', contrastText: '#121212' }, // Neon green
    secondary: { main: '#D4AF37', contrastText: '#121212' }, // Gold
    background: { default: '#121212', paper: '#1A1A2E' },
    text: { primary: '#fff', secondary: '#b0b0b0' },
    divider: '#222',
  },
  typography: {
    fontFamily: '"Montserrat", "Space Grotesk", "system-ui", sans-serif',
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 600,
    h1: { fontWeight: 700, textShadow: '0 0 8px #00FF9955' },
    h2: { fontWeight: 600, textShadow: '0 0 6px #00FF9955' },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 500 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 400 },
  },
  shape: { borderRadius: 8 },
  shadows: [
    "none",
    ...Array(24).fill('0 4px 24px 0 rgba(0,255,153,0.12)')
  ] as [
    "none", string, string, string, string,
    string, string, string, string, string,
    string, string, string, string, string,
    string, string, string, string, string,
    string, string, string, string, string
  ],
});