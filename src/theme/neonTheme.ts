import { createTheme } from '@mui/material/styles';

export const neonTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00ffff',
      light: '#66ffff',
      dark: '#00cccc',
      contrastText: '#000000',
    },
    secondary: {
      main: '#ff00ff',
      light: '#ff66ff',
      dark: '#cc00cc',
      contrastText: '#ffffff',
    },
    background: {
      default: '#000000',
      paper: '#0a0a0a',
    },
    text: {
      primary: '#00ffff',
      secondary: '#ff00ff',
    },
    success: {
      main: '#00ff00',
      light: '#66ff66',
      dark: '#00cc00',
    },
    error: {
      main: '#ff0000',
      light: '#ff6666',
      dark: '#cc0000',
    },
    warning: {
      main: '#ffff00',
      light: '#ffff66',
      dark: '#cccc00',
    },
    info: {
      main: '#0080ff',
      light: '#66b3ff',
      dark: '#0066cc',
    },
    divider: '#333333',
  },
  typography: {
    fontFamily: '"Orbitron", "Arial", sans-serif',
    h1: {
      fontWeight: 900,
      fontSize: '2.5rem',
      textShadow: '0 0 10px #00ffff',
    },
    h2: {
      fontWeight: 800,
      fontSize: '2rem',
      textShadow: '0 0 8px #00ffff',
    },
    h3: {
      fontWeight: 700,
      fontSize: '1.75rem',
      textShadow: '0 0 6px #00ffff',
    },
    h4: {
      fontWeight: 700,
      fontSize: '1.5rem',
      textShadow: '0 0 5px #00ffff',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      textShadow: '0 0 4px #00ffff',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
      textShadow: '0 0 3px #00ffff',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      textShadow: '0 0 2px #00ffff',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      textShadow: '0 0 1px #00ffff',
    },
  },
  shape: {
    borderRadius: 0,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 0 20px rgba(0,255,255,0.3)',
          border: '1px solid #00ffff',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          '&:hover': {
            boxShadow: '0 0 30px rgba(0,255,255,0.5)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 0,
          border: '1px solid #00ffff',
          textShadow: '0 0 5px #00ffff',
          '&.MuiButton-contained': {
            background: 'linear-gradient(45deg, #00ffff 0%, #0080ff 100%)',
            boxShadow: '0 0 15px rgba(0,255,255,0.5)',
            '&:hover': {
              boxShadow: '0 0 25px rgba(0,255,255,0.7)',
            },
          },
          '&.MuiButton-outlined': {
            borderColor: '#ff00ff',
            color: '#ff00ff',
            textShadow: '0 0 5px #ff00ff',
            '&:hover': {
              borderColor: '#ff66ff',
              boxShadow: '0 0 15px rgba(255,0,255,0.5)',
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(90deg, #000000 0%, #0a0a0a 100%)',
          boxShadow: '0 0 20px rgba(0,255,255,0.3)',
          borderBottom: '1px solid #00ffff',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          '& .MuiSwitch-track': {
            backgroundColor: '#333333',
          },
          '& .MuiSwitch-thumb': {
            backgroundColor: '#00ffff',
            boxShadow: '0 0 10px rgba(0,255,255,0.5)',
          },
          '&.Mui-checked .MuiSwitch-track': {
            backgroundColor: 'rgba(0,255,255,0.3)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          border: '1px solid #00ffff',
          textShadow: '0 0 3px #00ffff',
          '&.MuiChip-colorSuccess': {
            borderColor: '#00ff00',
            textShadow: '0 0 3px #00ff00',
          },
          '&.MuiChip-colorError': {
            borderColor: '#ff0000',
            textShadow: '0 0 3px #ff0000',
          },
        },
      },
    },
  },
}); 