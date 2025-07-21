import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import debounce from 'lodash/debounce';
import { useThemeSwitcher } from '../theme/ThemeContext';
import autoTradeService, { AutoTradeCriteria } from '../services/autoTradeService';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Divider,
  Alert,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Avatar,
  InputAdornment,
  alpha,
  useTheme,
  Chip,
} from '@mui/material';
import { PrivacyTip, TrendingDown } from '@mui/icons-material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';

import {
  Person,
  Notifications,
  Security,
  TrendingUp,
  Save,
  Upload,
  Delete as DeleteIcon,
  Brightness4,
  Brightness7,
  Language,
  Schedule,
  VolumeUp,
  Shield,
  Speed,
  Palette,
  CloudDownload,
  History,
  WarningAmber,
  Info,
  Email,
  RestartAlt,
  Assessment,
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`settings-tabpanel-${index}`}
    aria-labelledby={`settings-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 1 }}>{children}</Box>}
  </div>
);

const Settings: React.FC = () => {
  const theme = useTheme();
  const { user } = useSelector((state: any) => state.auth);
  const { theme: currentTheme, setTheme, availableThemes } = useThemeSwitcher();
  const [activeTab, setActiveTab] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Profile settings
  const [profileSettings, setProfileSettings] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    timezone: 'UTC',
    language: 'en',
  });
  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    signalAlerts: true,
    portfolioUpdates: true,
    marketNews: false,
    weeklyReports: true,
  });

  // Trading settings
  const [tradingSettings, setTradingSettings] = useState({
    riskLevel: 'medium',
    maxPositions: 10,
    stopLossPercentage: 5,
    takeProfitPercentage: 10,
    autoTrading: false,
    signalConfidenceThreshold: 75,
  });

  // Security settings
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    loginNotifications: true,
    sessionTimeout: 30,
  });

  const themeMode = theme.palette.mode;
  const [selectedTheme, setSelectedTheme] = useState(themeMode);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [exporting, setExporting] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');
  const [settingsChanged, setSettingsChanged] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [settingsHistory, setSettingsHistory] = useState([
    { action: 'Theme changed to Dark', time: new Date(Date.now() - 1000 * 60 * 30) },
    { action: 'Notifications enabled', time: new Date(Date.now() - 1000 * 60 * 60 * 2) },
    { action: 'Profile updated', time: new Date(Date.now() - 1000 * 60 * 60 * 24) },
  ]);
  const [quickSettings, setQuickSettings] = useState({
    darkMode: selectedTheme === 'dark',
    notifications: true,
    autoSave: true,
    soundEffects: true,
  });

  // Debounced auto-save
  const debouncedSave = debounce(() => {
    handleSave();
  }, 1000);

  // Auto-save on settings change
  useEffect(() => {
    debouncedSave();
    return debouncedSave.cancel;
    // eslint-disable-next-line
  }, [profileSettings, notificationSettings, tradingSettings, securitySettings, selectedTheme]);

  // Profile picture upload handler
  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => setProfilePic(ev.target?.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // Export account data
  const handleExport = () => {
    setExporting(true);
    const data = {
      profile: profileSettings,
      notifications: notificationSettings,
      trading: tradingSettings,
      security: securitySettings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'apterra-account-data.json';
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSave = () => {
    // Here you would dispatch actions to save the settings
    setSaveSuccess(true);
    setLastSaved(new Date());
    setSettingsChanged(false);
    
    // Add to history
    setSettingsHistory(prev => [
      { action: 'Settings saved successfully', time: new Date() },
      ...prev.slice(0, 9)
    ]);
    
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // When user changes the theme:
  const handleThemeChange = (e: any) => {
    setSelectedTheme(e.target.value);
  };

  // Theme-aware colors
  const accent = theme.palette.primary.main;
  const paperBg = theme.palette.background.paper;
  const cardBg = theme.palette.mode === 'dark'
    ? 'rgba(255,255,255,0.05)'
    : theme.palette.background.default;
  const dividerColor = theme.palette.divider;

  const handleQuickSettingChange = (setting: string, value: boolean) => {
    setQuickSettings(prev => ({ ...prev, [setting]: value }));
    setSettingsChanged(true);
    
    // Handle specific quick settings
    if (setting === 'darkMode') {
      setSelectedTheme(value ? 'dark' : 'light');
    }
    
    // Add to history
    const action = `${setting} ${value ? 'enabled' : 'disabled'}`;
    setSettingsHistory(prev => [
      { action, time: new Date() },
      ...prev.slice(0, 9) // Keep only last 10 items
    ]);
  };

  const getSettingsProgress = () => {
    const totalFields = 12; // Total settings fields
    let filledFields = 0;
    
    if (profileSettings.name) filledFields++;
    if (profileSettings.email) filledFields++;
    if (profileSettings.phone) filledFields++;
    if (profileSettings.timezone !== 'UTC') filledFields++;
    if (profileSettings.language !== 'en') filledFields++;
    if (selectedTheme !== 'light') filledFields++;
    if (notificationSettings.emailNotifications) filledFields++;
    if (tradingSettings.riskLevel !== 'medium') filledFields++;
    if (tradingSettings.maxPositions !== 10) filledFields++;
    if (securitySettings.twoFactorAuth) filledFields++;
    if (securitySettings.sessionTimeout !== 30) filledFields++;
    if (passwords.current || passwords.new) filledFields++;
    
    return Math.round((filledFields / totalFields) * 100);
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Enhanced Header with Progress */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Settings
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Customize your APTERRA experience
            </Typography>
          </Box>
    
          {/* Settings Progress Circle */}
          <Box textAlign="center">
            <Box
              sx={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: `conic-gradient(${accent} ${getSettingsProgress() * 3.6}deg, ${theme.palette.action.disabledBackground} 0deg)`,
                p: 0.5,
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: paperBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: accent }}>
                  {getSettingsProgress()}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Complete
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Quick Settings Bar */}
        <Paper
          sx={{
            p: 2,
            mb: 3,
            background: `linear-gradient(135deg, ${accent}10 0%, ${theme.palette.secondary.main}10 100%)`,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${dividerColor}`,
          }}
        >
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold', color: accent }}>
            Quick Settings
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center">
                  {quickSettings.darkMode ? <Brightness4 sx={{ mr: 1 }} /> : <Brightness7 sx={{ mr: 1 }} />}
                  <Typography variant="body2">Dark Mode</Typography>
                </Box>
                <Switch
                  checked={quickSettings.darkMode}
                  onChange={(e) => handleQuickSettingChange('darkMode', e.target.checked)}
                  size="small"
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center">
                  <Notifications sx={{ mr: 1 }} />
                  <Typography variant="body2">Notifications</Typography>
                </Box>
                <Switch
                  checked={quickSettings.notifications}
                  onChange={(e) => handleQuickSettingChange('notifications', e.target.checked)}
                  size="small"
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center">
                  <Save sx={{ mr: 1 }} />
                  <Typography variant="body2">Auto Save</Typography>
                </Box>
                <Switch
                  checked={quickSettings.autoSave}
                  onChange={(e) => handleQuickSettingChange('autoSave', e.target.checked)}
                  size="small"
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center">
                  <VolumeUp sx={{ mr: 1 }} />
                  <Typography variant="body2">Sound Effects</Typography>
                </Box>
                <Switch
                  checked={quickSettings.soundEffects}
                  onChange={(e) => handleQuickSettingChange('soundEffects', e.target.checked)}
                  size="small"
                />
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Status Bar */}
        <Box display="flex" alignItems="center" gap={3} mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: settingsChanged ? theme.palette.warning.main : theme.palette.success.main,
              }}
            />
            <Typography variant="body2" color="text.secondary">
              {settingsChanged ? 'Unsaved changes' : 'All changes saved'}
            </Typography>
          </Box>
          {lastSaved && (
            <Typography variant="body2" color="text.secondary">
              Last saved: {getTimeAgo(lastSaved)}
            </Typography>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<History />}
            onClick={() => setPreviewMode(!previewMode)}
            sx={{ ml: 'auto' }}
          >
            {previewMode ? 'Hide' : 'Show'} History
          </Button>
        </Box>
      </Box>

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 1 }}>
          Settings saved successfully!
        </Alert>
      )}

      <Paper
        sx={{
          background: paperBg,
          backdropFilter: 'blur(10px)',
          border: `1px solid ${dividerColor}`,
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: dividerColor }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                color: theme.palette.text.secondary,
                minHeight: 72,
                '&.Mui-selected': {
                  color: accent,
                },
              },
              '& &MuiTabs-indicator': {
                backgroundColor: accent,
                height: 3,
              },
            }}
          >
            <Tab 
              icon={<Person />} 
              label={
                <Box>
                  <Typography variant="body2">Profile</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Personal Information
                  </Typography>
                </Box>
              } 
            />
            <Tab 
              icon={<Notifications />} 
              label={
                <Box>
                  <Typography variant="body2">Notifications</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Alerts & Updates
                  </Typography>
                </Box>
              } 
            />
            <Tab 
              icon={<TrendingUp />} 
              label={
                <Box>
                  <Typography variant="body2">Trading</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Risk & Preferences
                  </Typography>
                </Box>
              } 
            />
            <Tab 
              icon={<Security />} 
              label={
                <Box>
                  <Typography variant="body2">Security</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Privacy & Safety
                  </Typography>
                </Box>
              } 
            />
          </Tabs>
        </Box>

        {/* Profile Settings */}
        <TabPanel value={activeTab} index={0}>
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <Person sx={{ color: accent, fontSize: 30 }} />
            <Box>
              <Typography variant="h5" sx={{ color: accent, fontWeight: 'bold' }}>
                Profile Information
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage your personal details and preferences
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={3}>
            {/* Profile Picture Section */}
            <Grid size={{ xs: 12 }}>
              <Card sx={{ background: cardBg, mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 24, height: 24 }} />
                    Profile Picture
                  </Typography>
                  <Box display="flex" alignItems="center" gap={3}>
                    <Avatar
                      src={profilePic || user?.avatar}
                      sx={{ width: 100, height: 100 }}
                      alt={profileSettings.name}
                    />
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Upload a profile picture to personalize your account
                      </Typography>
                      <Box display="flex" gap={2}>
                        <Button
                          component="label"
                          variant="outlined"
                          startIcon={<Upload />}
                          sx={{ color: accent, borderColor: accent }}
                        >
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePicChange}
                          />
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Full Name"
                value={profileSettings.name}
                onChange={(e) => setProfileSettings(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={profileSettings.email}
                onChange={(e) => setProfileSettings(prev => ({ ...prev, email: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Phone Number"
                value={profileSettings.phone}
                onChange={(e) => setProfileSettings(prev => ({ ...prev, phone: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Timezone</InputLabel>
                <Select
                  value={profileSettings.timezone}
                  label="Timezone"
                  onChange={(e) => setProfileSettings(prev => ({ ...prev, timezone: e.target.value }))}
                >
                  <MenuItem value="UTC">UTC</MenuItem>
                  <MenuItem value="EST">Eastern Time</MenuItem>
                  <MenuItem value="PST">Pacific Time</MenuItem>
                  <MenuItem value="GMT">Greenwich Mean Time</MenuItem>
                  <MenuItem value="CET">Central European Time</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Language</InputLabel>
                <Select
                  value={profileSettings.language}
                  label="Language"
                  onChange={(e) => setProfileSettings(prev => ({ ...prev, language: e.target.value }))}
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Spanish</MenuItem>
                  <MenuItem value="fr">French</MenuItem>
                  <MenuItem value="de">German</MenuItem>
                  <MenuItem value="zh">Chinese</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Theme</InputLabel>
                <Select
                  value={currentTheme}
                  label="Theme"
                  onChange={(e) => {
                    setTheme(e.target.value as any);
                    setSettingsChanged(true);
                  }}
                >
                  {availableThemes.map(theme => (
                    <MenuItem key={theme.value} value={theme.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography>{theme.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {theme.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Password Change */}
        <TabPanel value={activeTab} index={0}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="h6" sx={{ color: accent }}>Change Password</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Current Password"
                type="password"
                value={passwords.current}
                onChange={e => setPasswords(prev => ({ ...prev, current: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="New Password"
                type="password"
                value={passwords.new}
                onChange={e => setPasswords(prev => ({ ...prev, new: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Confirm New Password"
                type="password"
                value={passwords.confirm}
                onChange={e => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
              />
            </Grid>
          </Grid>
          <Button
            variant="outlined"
            sx={{ mt: 2, color: accent, borderColor: accent }}
            onClick={() => {
              // Implement password change logic here
              alert('Password change requested!');
            }}
          >
            Change Password
          </Button>
        </TabPanel>

        {/* Notification Settings */}
        <TabPanel value={activeTab} index={1}>
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <Notifications sx={{ color: accent, fontSize: 30 }} />
            <Box>
              <Typography variant="h5" sx={{ color: accent, fontWeight: 'bold' }}>
                Notification Preferences
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Control how and when you receive notifications
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={3}>
            {/* General Notifications */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ background: cardBg, height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Email sx={{ color: accent }} />
                    General Notifications
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" p={2} 
                         sx={{ background: alpha(accent, 0.1), borderRadius: 2 }}>
                      <Box>
                        <Typography variant="body1">Email Notifications</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Receive updates via email
                        </Typography>
                      </Box>
                      <Switch
                        checked={notificationSettings.emailNotifications}
                        onChange={(e) => {
                          setNotificationSettings(prev => ({
                            ...prev,
                            emailNotifications: e.target.checked
                          }));
                          setSettingsChanged(true);
                        }}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: accent },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: accent },
                        }}
                      />
                    </Box>
            
                    <Box display="flex" justifyContent="space-between" alignItems="center" p={2} 
                         sx={{ background: alpha(accent, 0.1), borderRadius: 2 }}>
                      <Box>
                        <Typography variant="body1">Push Notifications</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Instant notifications on your device
                        </Typography>
                      </Box>
                      <Switch
                        checked={notificationSettings.pushNotifications}
                        onChange={(e) => {
                          setNotificationSettings(prev => ({
                            ...prev,
                            pushNotifications: e.target.checked
                          }));
                          setSettingsChanged(true);
                        }}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: accent },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: accent },
                        }}
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Trading Notifications */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ background: cardBg, height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp sx={{ color: accent }} />
                    Trading Notifications
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    {[
                      { key: 'signalAlerts', label: 'Signal Alerts', desc: 'New trading signals' },
                      { key: 'portfolioUpdates', label: 'Portfolio Updates', desc: 'Position changes' },
                      { key: 'marketNews', label: 'Market News', desc: 'Important market events' },
                      { key: 'weeklyReports', label: 'Weekly Reports', desc: 'Performance summaries' },
                    ].map((item) => (
                      <Box key={item.key} display="flex" justifyContent="space-between" alignItems="center" p={2} 
                           sx={{ background: alpha(accent, 0.1), borderRadius: 2 }}>
                        <Box>
                          <Typography variant="body1">{item.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.desc}
                          </Typography>
                        </Box>
                        <Switch
                          checked={notificationSettings[item.key as keyof typeof notificationSettings]}
                          onChange={(e) => {
                            setNotificationSettings(prev => ({
                              ...prev,
                              [item.key]: e.target.checked
                            }));
                            setSettingsChanged(true);
                          }}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: accent },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: accent },
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Notification Preview */}
            <Grid size={{ xs: 12 }}>
              <Card sx={{ background: `linear-gradient(135deg, ${accent}10, ${theme.palette.secondary.main}10)` }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: accent, mb: 2 }}>
                    Notification Preview
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Alert severity="info" sx={{ '& .MuiAlert-icon': { color: accent } }}>
                      <strong>Signal Alert:</strong> BTCUSD BUY signal generated with 87% confidence.
                    </Alert>
                    <Alert severity="success">
                      <strong>Portfolio Update:</strong> Your EURUSD position gained +2.5% today.
                    </Alert>
                    <Alert severity="warning">
                      <strong>Market News:</strong> Federal Reserve announces interest rate decision.
                    </Alert>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Trading Settings */}
        <TabPanel value={activeTab} index={2}>
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <TrendingUp sx={{ color: accent, fontSize: 30 }} />
            <Box>
              <Typography variant="h5" sx={{ color: accent, fontWeight: 'bold' }}>
                Trading Preferences
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure your trading strategy and risk management
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={3}>
            {/* Risk Management */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ background: cardBg, height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Shield sx={{ color: accent }} />
                    Risk Management
                  </Typography>
                  
                  <Box mb={3}>
                    <FormControl fullWidth>
                      <InputLabel>Risk Level</InputLabel>
                      <Select
                        value={tradingSettings.riskLevel}
                        label="Risk Level"
                        onChange={(e) => {
                          setTradingSettings(prev => ({ ...prev, riskLevel: e.target.value }));
                          setSettingsChanged(true);
                        }}
                      >
                        <MenuItem value="low">
                          <Box display="flex" alignItems="center" gap={1}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: theme.palette.success.main }} />
                            Conservative - Lower risk, steady returns
                          </Box>
                        </MenuItem>
                        <MenuItem value="medium">
                          <Box display="flex" alignItems="center" gap={1}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: theme.palette.warning.main }} />
                            Moderate - Balanced risk and reward
                          </Box>
                        </MenuItem>
                        <MenuItem value="high">
                          <Box display="flex" alignItems="center" gap={1}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: theme.palette.error.main }} />
                            Aggressive - Higher risk, potential for higher returns
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  <Box mb={3}>
                    <TextField
                      fullWidth
                      label="Maximum Open Positions"
                      type="number"
                      value={tradingSettings.maxPositions}
                      onChange={(e) => {
                        setTradingSettings(prev => ({
                          ...prev,
                          maxPositions: parseInt(e.target.value) || 0
                        }));
                        setSettingsChanged(true);
                      }}
                      inputProps={{ min: 1, max: 50 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Assessment sx={{ color: accent }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Recommended: 5-15 positions for optimal diversification
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Auto Trading */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ background: cardBg, height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Speed sx={{ color: accent }} />
                    Automation Settings
                  </Typography>
                  
                  {/* Auto-Trade Status */}
                  <Box p={2} sx={{ background: alpha(accent, 0.1), borderRadius: 2, mb: 2 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body1">Enable Auto Trading</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Automatically execute trades based on AI signals
                        </Typography>
                      </Box>
                      <Switch
                        checked={autoTradeService.getCriteria().enabled}
                        onChange={(e) => {
                          autoTradeService.updateCriteria({ enabled: e.target.checked });
                          if (e.target.checked) {
                            autoTradeService.start();
                          } else {
                            autoTradeService.stop();
                          }
                          setSettingsChanged(true);
                        }}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: accent },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: accent },
                        }}
                      />
                    </Box>
                  </Box>

                  {/* Auto-Trade Stats */}
                  {autoTradeService.getCriteria().enabled && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Auto-Trade Statistics</Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6, md: 3 }}>
                          <Box textAlign="center" p={1} sx={{ background: alpha(theme.palette.success.main, 0.1), borderRadius: 1 }}>
                            <Typography variant="h6" color="success.main">
                              {autoTradeService.getStats().totalTrades}
                            </Typography>
                            <Typography variant="caption">Total Trades</Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                          <Box textAlign="center" p={1} sx={{ background: alpha(theme.palette.info.main, 0.1), borderRadius: 1 }}>
                            <Typography variant="h6" color="info.main">
                              {autoTradeService.getWinRate().toFixed(1)}%
                            </Typography>
                            <Typography variant="caption">Win Rate</Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                          <Box textAlign="center" p={1} sx={{ background: alpha(theme.palette.warning.main, 0.1), borderRadius: 1 }}>
                            <Typography variant="h6" color="warning.main">
                              {autoTradeService.getStats().tradesToday}
                            </Typography>
                            <Typography variant="caption">Today's Trades</Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                          <Box textAlign="center" p={1} sx={{ background: alpha(theme.palette.primary.main, 0.1), borderRadius: 1 }}>
                            <Typography variant="h6" color="primary.main">
                              ${autoTradeService.getStats().totalPnL.toFixed(2)}
                            </Typography>
                            <Typography variant="caption">Total P&L</Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* Auto-Trade Configuration */}
                  {autoTradeService.getCriteria().enabled && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Auto-Trade Configuration</Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            fullWidth
                            label="Min Confidence (%)"
                            type="number"
                            value={autoTradeService.getCriteria().minConfidence}
                            onChange={(e) => autoTradeService.updateCriteria({ 
                              minConfidence: parseInt(e.target.value) || 75 
                            })}
                            size="small"
                            InputProps={{ endAdornment: '%' }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            fullWidth
                            label="Position Size (%)"
                            type="number"
                            value={autoTradeService.getCriteria().positionSize}
                            onChange={(e) => autoTradeService.updateCriteria({ 
                              positionSize: parseFloat(e.target.value) || 5 
                            })}
                            size="small"
                            InputProps={{ endAdornment: '%' }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            fullWidth
                            label="Max Positions"
                            type="number"
                            value={autoTradeService.getCriteria().maxPositions}
                            onChange={(e) => autoTradeService.updateCriteria({ 
                              maxPositions: parseInt(e.target.value) || 5 
                            })}
                            size="small"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            fullWidth
                            label="Max Daily Trades"
                            type="number"
                            value={autoTradeService.getCriteria().maxDailyTrades}
                            onChange={(e) => autoTradeService.updateCriteria({ 
                              maxDailyTrades: parseInt(e.target.value) || 10 
                            })}
                            size="small"
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {autoTradeService.getCriteria().enabled && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <strong>Auto-Trade Active:</strong> System is monitoring signals and executing trades automatically.
                      <br />
                      <strong>Status:</strong> {autoTradeService.isRunning() ? '🟢 Running' : '🔴 Stopped'}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Stop Loss Settings */}
            <Grid size={{ xs: 12 }}>
              <Card sx={{ background: cardBg }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingDown sx={{ color: theme.palette.error.main }} />
                    Stop Loss & Take Profit
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography gutterBottom>
                            Default Stop Loss: {tradingSettings.stopLossPercentage}%
                          </Typography>
                          <Chip 
                            label={`-${tradingSettings.stopLossPercentage}%`} 
                            color="error" 
                            size="small" 
                          />
                        </Box>
                        <Slider
                          value={tradingSettings.stopLossPercentage}
                          onChange={(e, value) => {
                            setTradingSettings(prev => ({
                              ...prev,
                              stopLossPercentage: value as number
                            }));
                            setSettingsChanged(true);
                          }}
                          min={1}
                          max={20}
                          step={0.5}
                          marks={[
                            { value: 1, label: '1%' },
                            { value: 5, label: '5%' },
                            { value: 10, label: '10%' },
                            { value: 20, label: '20%' },
                          ]}
                          valueLabelDisplay="auto"
                          sx={{
                            color: theme.palette.error.main,
                            '& .MuiSlider-thumb': { backgroundColor: theme.palette.error.main },
                            '& .MuiSlider-track': { backgroundColor: theme.palette.error.main },
                            '& .MuiSlider-rail': { backgroundColor: theme.palette.action.disabledBackground },
                          }}
                        />
                      </Box>
                    </Grid>
            
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography gutterBottom>
                            Default Take Profit: {tradingSettings.takeProfitPercentage}%
                          </Typography>
                          <Chip 
                            label={`+${tradingSettings.takeProfitPercentage}%`} 
                            color="success" 
                            size="small" 
                          />
                        </Box>
                        <Slider
                          value={tradingSettings.takeProfitPercentage}
                          onChange={(e, value) => {
                            setTradingSettings(prev => ({
                              ...prev,
                              takeProfitPercentage: value as number
                            }));
                            setSettingsChanged(true);
                          }}
                          min={5}
                          max={50}
                          step={1}
                          marks={[
                            { value: 5, label: '5%' },
                            { value: 15, label: '15%' },
                            { value: 30, label: '30%' },
                            { value: 50, label: '50%' },
                          ]}
                          valueLabelDisplay="auto"
                          sx={{
                            color: theme.palette.success.main,
                            '& .MuiSlider-thumb': { backgroundColor: theme.palette.success.main },
                            '& .MuiSlider-track': { backgroundColor: theme.palette.success.main },
                            '& .MuiSlider-rail': { backgroundColor: theme.palette.action.disabledBackground },
                          }}
                        />
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Signal Confidence */}
            <Grid size={{ xs: 12 }}>
              <Card sx={{ background: cardBg }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Assessment sx={{ color: accent }} />
                    Signal Confidence Threshold
                  </Typography>
                  
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography>
                      Minimum Confidence: {tradingSettings.signalConfidenceThreshold}%
                    </Typography>
                    <Chip 
                      label={
                        tradingSettings.signalConfidenceThreshold >= 80 ? 'High Quality' :
                        tradingSettings.signalConfidenceThreshold >= 65 ? 'Good Quality' : 'All Signals'
                      }
                      color={
                        tradingSettings.signalConfidenceThreshold >= 80 ? 'success' :
                        tradingSettings.signalConfidenceThreshold >= 65 ? 'warning' : 'default'
                      }
                      size="small"
                    />
                  </Box>
                  
                  <Slider
                    value={tradingSettings.signalConfidenceThreshold}
                    onChange={(e, value) => {
                      setTradingSettings(prev => ({
                        ...prev,
                        signalConfidenceThreshold: value as number
                      }));
                      setSettingsChanged(true);
                    }}
                    min={50}
                    max={95}
                    step={5}
                    marks={[
                      { value: 50, label: '50%' },
                      { value: 65, label: '65%' },
                      { value: 80, label: '80%' },
                      { value: 95, label: '95%' },
                    ]}
                    valueLabelDisplay="auto"
                    sx={{
                      color: accent,
                      '& .MuiSlider-thumb': { backgroundColor: accent },
                      '& .MuiSlider-track': { backgroundColor: accent },
                      '& .MuiSlider-rail': { backgroundColor: theme.palette.action.disabledBackground },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Higher thresholds mean fewer but higher quality signals
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Enhanced Security Settings */}
        <TabPanel value={activeTab} index={3}>
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <Security sx={{ color: accent, fontSize: 30 }} />
            <Box>
              <Typography variant="h5" sx={{ color: accent, fontWeight: 'bold' }}>
                Security & Privacy
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Protect your account with advanced security features
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={3}>
            {/* Account Security */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ background: cardBg, height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Shield sx={{ color: accent }} />
                    Account Security
                  </Typography>
                  
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Box p={2} sx={{ background: alpha(accent, 0.1), borderRadius: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="body1">Two-Factor Authentication</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Add an extra layer of security to your account
                          </Typography>
                        </Box>
                        <Switch
                          checked={securitySettings.twoFactorAuth}
                          onChange={(e) => {
                            setSecuritySettings(prev => ({
                              ...prev,
                              twoFactorAuth: e.target.checked
                            }));
                            setSettingsChanged(true);
                          }}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: accent },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: accent },
                          }}
                        />
                      </Box>
                      {securitySettings.twoFactorAuth && (
                        <Alert severity="success" sx={{ mt: 2 }}>
                          <strong>2FA Enabled:</strong> Your account is protected with two-factor authentication.
                        </Alert>
                      )}
                    </Box>

                    <Box p={2} sx={{ background: alpha(accent, 0.1), borderRadius: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="body1">Login Notifications</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Get notified when someone logs into your account
                          </Typography>
                        </Box>
                        <Switch
                          checked={securitySettings.loginNotifications}
                          onChange={(e) => {
                            setSecuritySettings(prev => ({
                              ...prev,
                              loginNotifications: e.target.checked
                            }));
                            setSettingsChanged(true);
                          }}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: accent },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: accent },
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Session Management */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ background: cardBg, height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Schedule sx={{ color: accent }} />
                    Session Management
                  </Typography>
                  
                  <Box mb={3}>
                    <FormControl fullWidth>
                      <InputLabel>Session Timeout</InputLabel>
                      <Select
                        value={securitySettings.sessionTimeout}
                        label="Session Timeout"
                        onChange={(e) => {
                          setSecuritySettings(prev => ({
                            ...prev,
                            sessionTimeout: e.target.value as number
                          }));
                          setSettingsChanged(true);
                        }}
                      >
                        <MenuItem value="15">
                          <Box display="flex" alignItems="center" gap={1}>
                            <Schedule sx={{ color: theme.palette.warning.main }} />
                            15 minutes - High Security
                          </Box>
                        </MenuItem>
                        <MenuItem value="30">
                          <Box display="flex" alignItems="center" gap={1}>
                            <Schedule sx={{ color: theme.palette.info.main }} />
                            30 minutes - Recommended
                          </Box>
                        </MenuItem>
                        <MenuItem value="60">
                          <Box display="flex" alignItems="center" gap={1}>
                            <Schedule sx={{ color: theme.palette.success.main }} />
                            1 hour - Balanced
                          </Box>
                        </MenuItem>
                        <MenuItem value="120">
                          <Box display="flex" alignItems="center" gap={1}>
                            <Schedule sx={{ color: theme.palette.warning.main }} />
                            2 hours - Extended
                          </Box>
                        </MenuItem>
                        <MenuItem value="480">
                          <Box display="flex" alignItems="center" gap={1}>
                            <Schedule sx={{ color: theme.palette.error.main }} />
                            8 hours - Low Security
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Shorter timeouts provide better security but require more frequent logins
                    </Typography>
                  </Box>

                  <Box p={2} sx={{ background: alpha(theme.palette.info.main, 0.1), borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Info sx={{ color: theme.palette.info.main }} />
                      Current Session Info
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Last login: {new Date().toLocaleString()}
                    </Typography>
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      IP Address: 192.168.1.1
                    </Typography>
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      Device: Chrome on Windows
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Privacy Settings */}
            <Grid size={{ xs: 12 }}>
              <Card sx={{ background: cardBg }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PrivacyTip sx={{ color: accent }} />
                    Privacy & Data
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Box p={2} sx={{ background: alpha(accent, 0.1), borderRadius: 2 }}>
                        <Typography variant="body1" sx={{ mb: 1 }}>Data Collection</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                          Allow collection of usage data to improve your experience
                        </Typography>
                        <FormControlLabel
                          control={
                            <Switch
                              defaultChecked
                              sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': { color: accent },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: accent },
                              }}
                            />
                          }
                          label="Analytics & Performance"
                        />
                      </Box>
                    </Grid>
            
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Box p={2} sx={{ background: alpha(accent, 0.1), borderRadius: 2 }}>
                        <Typography variant="body1" sx={{ mb: 1 }}>Marketing Communications</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                          Receive updates about new features and trading opportunities
                        </Typography>
                        <FormControlLabel
                          control={
                            <Switch
                              defaultChecked
                              sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': { color: accent },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: accent },
                              }}
                            />
                          }
                          label="Marketing Emails"
                        />
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Danger Zone */}
            <Grid size={{ xs: 12 }}>
              <Card sx={{ 
                background: `linear-gradient(135deg, ${theme.palette.error.main}10, ${theme.palette.error.dark}20)`,
                border: `1px solid ${theme.palette.error.main}30`
              }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: theme.palette.error.main, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningAmber sx={{ color: theme.palette.error.main }} />
                    Danger Zone
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Box>
                        <Typography variant="body1" gutterBottom sx={{ color: theme.palette.error.main }}>
                          Reset All Settings
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          Reset all settings to their default values. This action cannot be undone.
                        </Typography>
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<RestartAlt />}
                          onClick={() => {
                            if (window.confirm('Are you sure you want to reset all settings?')) {
                              // Reset all settings to default
                              alert('Settings reset to default values');
                              setSettingsHistory(prev => [
                                { action: 'All settings reset to default', time: new Date() },
                                ...prev.slice(0, 9)
                              ]);
                            }
                          }}
                        >
                          Reset Settings
                        </Button>
                      </Box>
                    </Grid>
            
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Box>
                        <Typography variant="body1" gutterBottom sx={{ color: theme.palette.error.main }}>
                          Delete Account
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          Permanently delete your account and all associated data. This action cannot be undone.
                        </Typography>
                        <Button
                          variant="contained"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                              alert('Account deletion requested');
                            }
                          }}
                        >
                          Delete Account
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Enhanced Save Button Section */}
        <Box sx={{ 
          p: 3, 
          borderTop: `1px solid ${dividerColor}`,
          background: `linear-gradient(135deg, ${paperBg} 0%, ${alpha(accent, 0.05)} 100%)`
        }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Button
                variant="outlined"
                startIcon={<CloudDownload />}
                onClick={handleExport}
                disabled={exporting}
                sx={{ color: accent, borderColor: accent }}
              >
                {exporting ? 'Exporting...' : 'Export Data'}
              </Button>
              
              <Button
                variant="text"
                startIcon={<History />}
                onClick={() => {
                  // Clear settings history
                  setSettingsHistory([]);
                  alert('Settings history cleared');
                }}
                sx={{ color: theme.palette.text.secondary }}
              >
                Clear History
              </Button>
            </Box>

            <Box display="flex" alignItems="center" gap={2}>
              {settingsChanged && (
                <Typography variant="body2" color="warning.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningAmber sx={{ fontSize: 16 }} />
                  You have unsaved changes
                </Typography>
              )}
              
              <Button
                variant="outlined"
                onClick={() => {
                  // Reset to last saved state
                  window.location.reload();
                }}
                disabled={!settingsChanged}
                sx={{ color: theme.palette.text.secondary, borderColor: theme.palette.text.secondary }}
              >
                Discard Changes
              </Button>
              
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                size="large"
                disabled={!settingsChanged}
                sx={{
                  background: settingsChanged 
                    ? `linear-gradient(45deg, ${accent} 30%, ${theme.palette.secondary.main} 90%)`
                    : theme.palette.action.disabledBackground,
                  color: settingsChanged ? 'white' : theme.palette.text.disabled,
                  minWidth: 140,
                  '&:hover': settingsChanged ? {
                    background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${accent} 90%)`,
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[8],
                  } : {},
                  transition: 'all 0.3s ease',
                }}
              >
                Save Settings
              </Button>
            </Box>
          </Box>
          
          {/* Settings Summary */}
          <Box mt={2} p={2} sx={{ background: alpha(accent, 0.1), borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Settings Summary:</strong> Profile {getSettingsProgress()}% complete • 
              {Object.values(notificationSettings).filter(Boolean).length} notifications enabled • 
              Risk level: {tradingSettings.riskLevel} • 
              {securitySettings.twoFactorAuth ? '2FA enabled' : '2FA disabled'}
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};
export default Settings;