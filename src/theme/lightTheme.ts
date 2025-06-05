import { createTheme } from '@mui/material/styles';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#FFD700', contrastText: '#222' }, // Gold
    secondary: { main: '#222', contrastText: '#FFD700' },
    background: {
      default: '#FAF9F6', // Slightly warmer off-white for luxury feel
      paper: '#fff',
      // Custom property for a subtle gold gradient background
      // elegant: 'linear-gradient(135deg, #FFFBEA 0%, #F5F5F5 60%, #FFF6D1 100%)', // moved below
    },
    text: { primary: '#222', secondary: '#555' },
    divider: '#e0e0e0',
  },
  typography: {
    fontFamily: '"Poppins", "Inter", "system-ui", sans-serif',
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    h1: { fontWeight: 600, textShadow: '0 1px 2px #FFD70022' },
    h2: { fontWeight: 500, textShadow: '0 1px 2px #FFD70022' },
    h3: { fontWeight: 500 },
    h4: { fontWeight: 500 },
    h5: { fontWeight: 400 },
    h6: { fontWeight: 400 },
  },
  shape: { borderRadius: 12 },
  // Add custom backgrounds or other custom theme properties here
  // To use custom backgrounds, either extend the theme via module augmentation or export separately:
  shadows: [
    "none",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "0 2px 8px 0 rgba(255,215,0,0.08)",
    "none",
    "none",
    "none",
    "none",
  ],
});

// Export custom backgrounds separately if needed
export const customBackgrounds = {
  elegant: 'linear-gradient(135deg, #FFFBEA 0%, #F5F5F5 60%, #FFF6D1 100%)',
};