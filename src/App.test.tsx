import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './store';
import App from './App';
import { ThemeSwitcherProvider } from './theme/ThemeContext';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <Provider store={store}>
      <ThemeSwitcherProvider>
        {component}
      </ThemeSwitcherProvider>
    </Provider>
  );
};

test('renders APTERRA app', () => {
  renderWithProviders(<App />);
  expect(screen.getByText(/APTERRA/i)).toBeInTheDocument();
});
