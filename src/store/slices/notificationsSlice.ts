import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  persistent?: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
  data?: any;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  settings: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
    email: boolean;
    push: boolean;
  };
}

const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  settings: {
    enabled: true,
    sound: true,
    desktop: true,
    email: false,
    push: false,
  },
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    add: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp' | 'read'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        read: false,
      };
      
      state.notifications.unshift(notification);
      state.unreadCount++;
      
      // Keep only last 100 notifications
      if (state.notifications.length > 100) {
        state.notifications = state.notifications.slice(0, 100);
      }
    },
    
    markAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    
    markAllAsRead: (state) => {
      state.notifications.forEach(n => n.read = true);
      state.unreadCount = 0;
    },
    
    remove: (state, action: PayloadAction<string>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload);
      if (index !== -1) {
        const notification = state.notifications[index];
        if (!notification.read) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.notifications.splice(index, 1);
      }
    },
    
    clear: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    
    updateSettings: (state, action: PayloadAction<Partial<NotificationsState['settings']>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
  },
});

export const {
  add,
  markAsRead,
  markAllAsRead,
  remove,
  clear,
  updateSettings,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;

// Selectors
export const selectNotifications = (state: { notifications: NotificationsState }) => 
  state.notifications.notifications;

export const selectUnreadCount = (state: { notifications: NotificationsState }) => 
  state.notifications.unreadCount;

export const selectNotificationSettings = (state: { notifications: NotificationsState }) => 
  state.notifications.settings;
export {};