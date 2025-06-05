import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Person,
  Notifications,
  Security,
  TrendingUp,
  Save,
  Upload,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import debounce from 'lodash.debounce';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { useThemeSwitcher } from '../theme/ThemeContext';

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
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const themeOptions = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'colorful', label: 'Colorful' },
];

const Settings: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state: any) => state.auth);

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

  const { theme: themeMode, setTheme } = useThemeSwitcher();
  const [selectedTheme, setSelectedTheme] = useState(themeMode);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [exporting, setExporting] = useState(false);

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
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // When user changes the theme:
  const handleThemeChange = (e: any) => {
    setSelectedTheme(e.target.value);
    setTheme(e.target.value); // This will update the app theme everywhere
  };

  // Theme-aware colors
  const accent = theme.palette.primary.main;
  const paperBg = theme.palette.background.paper;
  const cardBg = theme.palette.mode === 'dark'
    ? 'rgba(255,255,255,0.05)'
    : theme.palette.background.default;
  const dividerColor = theme.palette.divider;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box mb={4}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Settings
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Customize your APTERRA experience
        </Typography>
      </Box>

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
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
                '&.Mui-selected': {
                  color: accent,
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: accent,
              },
            }}
          >
            <Tab icon={<Person />} label="Profile" />
            <Tab icon={<Notifications />} label="Notifications" />
            <Tab icon={<TrendingUp />} label="Trading" />
            <Tab icon={<Security />} label="Security" />
          </Tabs>
        </Box>

        {/* Profile Settings */}
        <TabPanel value={activeTab} index={0}>
          <Typography variant="h5" gutterBottom sx={{ color: accent }}>
            Profile Information
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Box display="flex" flexDirection="column" alignItems="center">
                <Avatar
                  src={profilePic || user?.avatar}
                  sx={{ width: 80, height: 80, mb: 2 }}
                  alt={profileSettings.name}
                />
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
                    hidden
                    onChange={handleProfilePicChange}
                  />
                </Button>
              </Box>
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
                  value={selectedTheme}
                  label="Theme"
                  onChange={handleThemeChange}
                >
                  {themeOptions.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Password Change */}
        <TabPanel value={activeTab} index={0}>
          <Divider sx={{ my: 3 }} />
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
          <Typography variant="h5" gutterBottom sx={{ color: accent }}>
            Notification Preferences
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Card sx={{ background: cardBg }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    General Notifications
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationSettings.emailNotifications}
                        onChange={(e) => setNotificationSettings(prev => ({
                          ...prev,
                          emailNotifications: e.target.checked
                        }))}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: accent,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: accent,
                          },
                        }}
                      />
                    }
                    label="Email Notifications"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationSettings.pushNotifications}
                        onChange={(e) => setNotificationSettings(prev => ({
                          ...prev,
                          pushNotifications: e.target.checked
                        }))}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: accent,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: accent,
                          },
                        }}
                      />
                    }
                    label="Push Notifications"
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Card sx={{ background: cardBg }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Trading Notifications
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationSettings.signalAlerts}
                        onChange={(e) => setNotificationSettings(prev => ({
                          ...prev,
                          signalAlerts: e.target.checked
                        }))}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: accent,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: accent,
                          },
                        }}
                      />
                    }
                    label="Signal Alerts"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationSettings.portfolioUpdates}
                        onChange={(e) => setNotificationSettings(prev => ({
                          ...prev,
                          portfolioUpdates: e.target.checked
                        }))}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: accent,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: accent,
                          },
                        }}
                      />
                    }
                    label="Portfolio Updates"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationSettings.marketNews}
                        onChange={(e) => setNotificationSettings(prev => ({
                          ...prev,
                          marketNews: e.target.checked
                        }))}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: accent,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: accent,
                          },
                        }}
                      />
                    }
                    label="Market News"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notificationSettings.weeklyReports}
                        onChange={(e) => setNotificationSettings(prev => ({
                          ...prev,
                          weeklyReports: e.target.checked
                        }))}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: accent,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: accent,
                          },
                        }}
                      />
                    }
                    label="Weekly Reports"
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle1" sx={{ color: accent }}>Notification Preview</Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            <strong>Signal Alert:</strong> BTCUSD BUY signal generated with 87% confidence.
          </Alert>
        </TabPanel>

        {/* Trading Settings */}
        <TabPanel value={activeTab} index={2}>
          <Typography variant="h5" gutterBottom sx={{ color: accent }}>
            Trading Preferences
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Risk Level</InputLabel>
                <Select
                  value={tradingSettings.riskLevel}
                  label="Risk Level"
                  onChange={(e) => setTradingSettings(prev => ({ ...prev, riskLevel: e.target.value }))}
                >
                  <MenuItem value="low">Conservative</MenuItem>
                  <MenuItem value="medium">Moderate</MenuItem>
                  <MenuItem value="high">Aggressive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Maximum Open Positions"
                type="number"
                value={tradingSettings.maxPositions}
                onChange={(e) => setTradingSettings(prev => ({
                  ...prev,
                  maxPositions: parseInt(e.target.value) || 0
                }))}
                inputProps={{ min: 1, max: 50 }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography gutterBottom>
                Default Stop Loss Percentage: {tradingSettings.stopLossPercentage}%
              </Typography>
              <Slider
                value={tradingSettings.stopLossPercentage}
                onChange={(e, value) => setTradingSettings(prev => ({
                  ...prev,
                  stopLossPercentage: value as number
                }))}
                min={1}
                max={20}
                step={0.5}
                marks
                valueLabelDisplay="auto"
                sx={{
                  color: accent,
                  '& .MuiSlider-thumb': {
                    backgroundColor: accent,
                  },
                  '& .MuiSlider-track': {
                    backgroundColor: accent,
                  },
                  '& .MuiSlider-rail': {
                    backgroundColor: theme.palette.action.disabledBackground,
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography gutterBottom>
                Default Take Profit Percentage: {tradingSettings.takeProfitPercentage}%
              </Typography>
              <Slider
                value={tradingSettings.takeProfitPercentage}
                onChange={(e, value) => setTradingSettings(prev => ({
                  ...prev,
                  takeProfitPercentage: value as number
                }))}
                min={5}
                max={50}
                step={1}
                marks
                valueLabelDisplay="auto"
                sx={{
                  color: accent,
                  '& .MuiSlider-thumb': {
                    backgroundColor: accent,
                  },
                  '& .MuiSlider-track': {
                    backgroundColor: accent,
                  },
                  '& .MuiSlider-rail': {
                    backgroundColor: theme.palette.action.disabledBackground,
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography gutterBottom>
                Signal Confidence Threshold: {tradingSettings.signalConfidenceThreshold}%
              </Typography>
              <Slider
                value={tradingSettings.signalConfidenceThreshold}
                onChange={(e, value) => setTradingSettings(prev => ({
                  ...prev,
                  signalConfidenceThreshold: value as number
                }))}
                min={50}
                max={95}
                step={5}
                marks
                valueLabelDisplay="auto"
                sx={{
                  color: accent,
                  '& .MuiSlider-thumb': {
                    backgroundColor: accent,
                  },
                  '& .MuiSlider-track': {
                    backgroundColor: accent,
                  },
                  '& .MuiSlider-rail': {
                    backgroundColor: theme.palette.action.disabledBackground,
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Card sx={{ background: cardBg }}>
                <CardContent>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={tradingSettings.autoTrading}
                        onChange={(e) => setTradingSettings(prev => ({
                          ...prev,
                          autoTrading: e.target.checked
                        }))}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: accent,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: accent,
                          },
                        }}
                      />
                    }
                    label="Enable Auto Trading"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Automatically execute trades based on AI signals that meet your criteria
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Security Settings */}
        <TabPanel value={activeTab} index={3}>
          <Typography variant="h5" gutterBottom sx={{ color: accent }}>
            Security & Privacy
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Card sx={{ background: cardBg }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Account Security
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={securitySettings.twoFactorAuth}
                        onChange={(e) => setSecuritySettings(prev => ({
                          ...prev,
                          twoFactorAuth: e.target.checked
                        }))}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: accent,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: accent,
                          },
                        }}
                      />
                    }
                    label="Two-Factor Authentication"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                    Add an extra layer of security to your account
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={securitySettings.loginNotifications}
                        onChange={(e) => setSecuritySettings(prev => ({
                          ...prev,
                          loginNotifications: e.target.checked
                        }))}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: accent,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: accent,
                          },
                        }}
                      />
                    }
                    label="Login Notifications"
                    sx={{ mt: 2 }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                    Get notified when someone logs into your account
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Session Timeout (minutes)</InputLabel>
                <Select
                  value={securitySettings.sessionTimeout}
                  label="Session Timeout (minutes)"
                  onChange={(e) => setSecuritySettings(prev => ({
                    ...prev,
                    sessionTimeout: e.target.value as number
                  }))}
                >
                  <MenuItem value={15}>15 minutes</MenuItem>
                  <MenuItem value={30}>30 minutes</MenuItem>
                  <MenuItem value={60}>1 hour</MenuItem>
                  <MenuItem value={120}>2 hours</MenuItem>
                  <MenuItem value={480}>8 hours</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom color="error">
                Danger Zone
              </Typography>
              <Card sx={{ background: theme.palette.error.light, border: `1px solid ${theme.palette.error.main}` }}>
                <CardContent>
                  <Typography variant="body1" gutterBottom>
                    Delete Account
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Once you delete your account, there is no going back. Please be certain.
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => {
                      // Handle account deletion
                      alert('Delete account requested');
                    }}
                  >
                    Delete Account
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Save Button */}
        <Box sx={{ p: 3, borderTop: `1px solid ${dividerColor}` }}>
          <Button
            variant="outlined"
            onClick={handleExport}
            disabled={exporting}
            sx={{ color: accent, borderColor: accent, mr: 2 }}
          >
            Export Account Data
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
            size="large"
            sx={{
              background: `linear-gradient(45deg, ${accent} 30%, ${theme.palette.secondary.main} 90%)`,
              '&:hover': {
                background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${accent} 90%)`,
              }
            }}
          >
            Save Settings
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default Settings;