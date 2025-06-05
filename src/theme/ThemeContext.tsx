import React, { createContext, useContext, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { lightTheme } from './lightTheme';
import { darkTheme } from './darkTheme';
import { colorfulTheme } from './colorfulTheme';

const themes = {
  light: lightTheme,
  dark: darkTheme,
  colorful: colorfulTheme,
};

type ThemeName = keyof typeof themes;

const ThemeSwitcherContext = createContext({
  theme: 'light' as ThemeName,
  setTheme: (theme: ThemeName) => {},
});

export const useThemeSwitcher = () => useContext(ThemeSwitcherContext);

export const ThemeSwitcherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeName>('light');
  return (
    <ThemeSwitcherContext.Provider value={{ theme, setTheme }}>
      <ThemeProvider theme={themes[theme]}>{children}</ThemeProvider>
    </ThemeSwitcherContext.Provider>
  );
};