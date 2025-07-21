import { createTheme } from '@mui/material/styles';

export const tradingTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00d4aa',
      light: '#00ffb3',
      dark: '#00a085',
      contrastText: '#000000',
    },
    secondary: {
      main: '#ff6b6b',
      light: '#ff8e8e',
      dark: '#cc5555',
      contrastText: '#ffffff',
    },
    background: {
      default: '#0a0e1a',
      paper: '#1a1f2e',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b8c1',
    },
    success: {
      main: '#00d4aa',
      light: '#00ffb3',
      dark: '#00a085',
    },
    error: {
      main: '#ff6b6b',
      light: '#ff8e8e',
      dark: '#cc5555',
    },
    warning: {
      main: '#ffd93d',
      light: '#ffe066',
      dark: '#ccad31',
    },
    info: {
      main: '#4ecdc4',
      light: '#6ed7cf',
      dark: '#3ea49d',
    },
    divider: '#2a2f3e',
  },
  typography: {
    fontFamily: '"JetBrains Mono", "Roboto Mono", "Courier New", monospace',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 700,
      fontSize: '2rem',
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
    },
    body1: {
      fontSize: '0.9rem',
      lineHeight: 1.5,
      fontFamily: '"JetBrains Mono", "Roboto Mono", monospace',
    },
    body2: {
      fontSize: '0.8rem',
      lineHeight: 1.4,
      fontFamily: '"JetBrains Mono", "Roboto Mono", monospace',
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          border: '1px solid #2a2f3e',
          background: 'linear-gradient(135deg, #1a1f2e 0%, #2a2f3e 100%)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 4,
          '&.MuiButton-contained': {
            boxShadow: '0 2px 8px rgba(0,212,170,0.3)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(90deg, #0a0e1a 0%, #1a1f2e 100%)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #2a2f3e',
          padding: '12px 8px',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#1a1f2e',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(0,212,170,0.05)',
          },
        },
      },
    },
  },
}); 