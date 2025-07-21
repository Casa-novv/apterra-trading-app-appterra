import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { lightTheme } from './lightTheme';
import { darkTheme } from './darkTheme';
import { colorfulTheme } from './colorfulTheme';
import { professionalTheme } from './professionalTheme';
import { tradingTheme } from './tradingTheme';
import { neonTheme } from './neonTheme';

const themes = {
  light: lightTheme,
  dark: darkTheme,
  colorful: colorfulTheme,
  professional: professionalTheme,
  trading: tradingTheme,
  neon: neonTheme,
};

type ThemeName = keyof typeof themes;

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  availableThemes: { value: ThemeName; label: string; description: string }[];
}

const ThemeSwitcherContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
  availableThemes: [],
});

export const useThemeSwitcher = () => useContext(ThemeSwitcherContext);

export const ThemeSwitcherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Get theme from localStorage or default to light
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const savedTheme = localStorage.getItem('apterra-theme') as ThemeName;
    return savedTheme && themes[savedTheme] ? savedTheme : 'light';
  });

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
    localStorage.setItem('apterra-theme', newTheme);
    
    // Update document body class for global styling
    document.body.className = `theme-${newTheme}`;
  };

  // Available themes with descriptions
  const availableThemes = [
    { value: 'light' as ThemeName, label: 'Light', description: 'Clean and bright interface' },
    { value: 'dark' as ThemeName, label: 'Dark', description: 'Easy on the eyes' },
    { value: 'colorful' as ThemeName, label: 'Colorful', description: 'Vibrant and energetic' },
    { value: 'professional' as ThemeName, label: 'Professional', description: 'Corporate and clean' },
    { value: 'trading' as ThemeName, label: 'Trading', description: 'Optimized for trading' },
    { value: 'neon' as ThemeName, label: 'Neon', description: 'Cyberpunk aesthetic' },
  ];

  // Set initial body class
  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  return (
    <ThemeSwitcherContext.Provider value={{ theme, setTheme, availableThemes }}>
      <ThemeProvider theme={themes[theme]}>{children}</ThemeProvider>
    </ThemeSwitcherContext.Provider>
  );
};