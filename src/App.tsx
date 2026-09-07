import { useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import BarChartIcon from '@mui/icons-material/BarChart';
import useMediaQuery from '@mui/material/useMediaQuery';
import theme from './theme';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';

export default function App() {
  const [tab, setTab] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  function handleSuccess() {
    setRefreshKey(k => k + 1);
    if (isMobile) setTab(1);
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* App Bar */}
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'primary.main' }}>
          <Toolbar>
            <AccountBalanceWalletIcon sx={{ mr: 1.5, fontSize: 28 }} />
            <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
              Mon Budget
            </Typography>
          </Toolbar>
          <Box sx={{ bgcolor: 'primary.dark' }}>
            <Container maxWidth="xl">
              <Tabs
                value={tab}
                onChange={(_, v: number) => setTab(v)}
                textColor="inherit"
                indicatorColor="secondary"
                sx={{
                  '& .MuiTab-root': { color: 'rgba(255,255,255,0.7)', fontWeight: 600 },
                  '& .Mui-selected': { color: '#fff' },
                }}
              >
                <Tab icon={<AddCircleIcon />} iconPosition="start" label="Saisie" />
                <Tab icon={<BarChartIcon />} iconPosition="start" label="Tableau de bord" />
              </Tabs>
            </Container>
          </Box>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3 } }}>
          {/* Desktop: side-by-side. Mobile: tabs */}
          {!isMobile ? (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4, lg: 3 }}>
                <Box sx={{ position: 'sticky', top: 100 }}>
                  <TransactionForm onSuccess={handleSuccess} />
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 8, lg: 9 }}>
                <Dashboard refreshKey={refreshKey} />
              </Grid>
            </Grid>
          ) : (
            <>
              {tab === 0 && <TransactionForm onSuccess={handleSuccess} />}
              {tab === 1 && <Dashboard refreshKey={refreshKey} />}
            </>
          )}
        </Container>
      </Box>
    </ThemeProvider>
  );
}
