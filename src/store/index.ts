import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import signalsReducer from './slices/signalSlice';
import portfolioReducer from './slices/portfolioSlice';
import marketReducer from './slices/marketSlice';
import notificationsReducer from './slices/notificationsSlice';
import uiReducer from './slices/uiSlice'; // <-- Add this import

export const store = configureStore({
  reducer: {
    auth: authReducer,
    signals: signalsReducer,
    portfolio: portfolioReducer,
    market: marketReducer,
    notifications: notificationsReducer,
    ui: uiReducer, // <-- Add this line
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
