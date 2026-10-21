import { useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import CssBaseline from '@mui/material/CssBaseline';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DashboardIcon from '@mui/icons-material/Dashboard';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import DownloadIcon from '@mui/icons-material/Download';
import theme from './theme';
import Dashboard from './components/Dashboard';
import TransactionEntry from './pages/TransactionEntry';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import ExportPage from './pages/ExportPage';

type PageId = 'dashboard' | 'entry' | 'history' | 'settings' | 'export';

const NAV_ITEMS: { id: PageId; label: string; icon: React.ReactElement }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <DashboardIcon /> },
  { id: 'entry', label: 'Nouvelle', icon: <AddCircleOutlineIcon /> },
  { id: 'history', label: 'Historique', icon: <HistoryIcon /> },
  { id: 'settings', label: 'Paramètres', icon: <SettingsIcon /> },
  { id: 'export', label: 'Exportation', icon: <DownloadIcon /> },
];

export default function App() {
  const [page, setPage] = useState<PageId>('entry');
  const [refreshKey, setRefreshKey] = useState(0);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  function handleEntrySuccess() {
    setRefreshKey(k => k + 1);
  }

  const drawerWidth = 250;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'primary.main', zIndex: (t) => t.zIndex.drawer + 1 }}>
          <Toolbar>
            <AccountBalanceWalletIcon sx={{ mr: 1.5, fontSize: 28 }} />
            <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
              Otrin.com
            </Typography>
            {!isMobile && (
              <Typography variant="body2" sx={{ opacity: 0.75 }} color="inherit">
                {NAV_ITEMS.find(n => n.id === page)?.label}
              </Typography>
            )}
          </Toolbar>
        </AppBar>

        <Box sx={{ display: 'flex', flexGrow: 1 }}>
          {/* Desktop sidebar */}
          {!isMobile && (
            <Drawer
              variant="permanent"
              open
              sx={{
                width: drawerWidth,
                flexShrink: 0,
                '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', pt: 8 },
              }}
            >
              <List sx={{ px: 1 }}>
                {NAV_ITEMS.map(item => (
                  <Box key={item.id}>
                    <ListItemButton
                      onClick={() => setPage(item.id)}
                      selected={page === item.id}
                      sx={{
                        borderRadius: 2,
                        mb: 0.5,
                        ...(item.id === 'entry' && {
                          bgcolor: page === 'entry' ? 'primary.dark' : 'primary.main',
                          color: '#fff',
                          '&:hover': { bgcolor: 'primary.dark' },
                          '& .MuiSvgIcon-root': { color: '#fff' },
                        }),
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600 }} />
                    </ListItemButton>
                    {item.id === 'entry' && <Divider sx={{ my: 1 }} />}
                  </Box>
                ))}
              </List>
            </Drawer>
          )}

          {/* Content */}
          <Box component="main" sx={{ flexGrow: 1, pb: { xs: 9, md: 4 } }}>
            <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3 } }}>
              {page === 'dashboard' && <Dashboard refreshKey={refreshKey} />}
              {page === 'entry' && <TransactionEntry onSuccess={handleEntrySuccess} />}
              {page === 'history' && <HistoryPage />}
              {page === 'settings' && <SettingsPage />}
              {page === 'export' && <ExportPage />}
            </Container>
          </Box>
        </Box>

        {/* Mobile bottom navigation */}
        {isMobile && (
          <Paper
            square
            elevation={8}
            sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (t) => t.zIndex.drawer + 1 }}
          >
            <BottomNavigation
              value={page}
              onChange={(_, v: PageId) => setPage(v)}
              sx={{ height: 68 }}
            >
              {NAV_ITEMS.map(item => (
                <BottomNavigationAction
                  key={item.id}
                  value={item.id}
                  label={item.label}
                  icon={item.icon}
                  sx={{
                    '&.Mui-selected': {
                      color: item.id === 'entry' ? 'primary.main' : undefined,
                      '& .MuiSvgIcon-root:not(.MuiBottomNavigationAction-label)': { color: item.id === 'entry' ? 'primary.main' : undefined },
                    },
                  }}
                />
              ))}
            </BottomNavigation>
          </Paper>
        )}
      </Box>
    </ThemeProvider>
  );
}