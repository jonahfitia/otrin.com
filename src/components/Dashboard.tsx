import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import type { SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import FilterListIcon from '@mui/icons-material/FilterList';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { supabase } from '../supabase';
import type { Transaction } from '../supabase';
import TransactionList from './TransactionList';

type FilterMode = 'month' | 'year' | 'range';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const PIE_COLORS = [
  '#1565c0', '#1976d2', '#42a5f5', '#0288d1', '#01579b',
  '#2e7d32', '#388e3c', '#4caf50', '#66bb6a', '#a5d6a7',
  '#c62828', '#e53935', '#ef5350', '#ff7043', '#ffb300',
  '#6a1b9a', '#8e24aa', '#ab47bc', '#795548', '#546e7a',
];

function formatAmount(n: number) {
  return new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
}

interface DashboardProps {
  refreshKey: number;
}

export default function Dashboard({ refreshKey }: DashboardProps) {
  const now = new Date();
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [rangeStart, setRangeStart] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  );
  const [rangeEnd, setRangeEnd] = useState(now.toISOString().split('T')[0]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('transactions')
      .select('*, categories(id,type,name), designations(id,category_id,name)')
      .order('transaction_date', { ascending: false });

    if (filterMode === 'month') {
      const start = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
      const end = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];
      query = query.gte('transaction_date', start).lte('transaction_date', end);
    } else if (filterMode === 'year') {
      const start = `${selectedYear}-01-01`;
      const end = `${selectedYear}-12-31`;
      query = query.gte('transaction_date', start).lte('transaction_date', end);
    } else {
      query = query.gte('transaction_date', rangeStart).lte('transaction_date', rangeEnd);
    }

    const { data } = await query;
    setTransactions((data as Transaction[]) ?? []);
    setLoading(false);
  }, [filterMode, selectedMonth, selectedYear, rangeStart, rangeEnd]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const totalEntree = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0);
  const totalSortie = transactions.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0);
  const balance = totalEntree - totalSortie;

  // Bar chart: group by category
  const categoryData: Record<string, { name: string; entree: number; sortie: number }> = {};
  for (const t of transactions) {
    const catName = t.categories?.name ?? 'Autre';
    if (!categoryData[catName]) categoryData[catName] = { name: catName, entree: 0, sortie: 0 };
    categoryData[catName][t.type] += t.amount;
  }
  const barData = Object.values(categoryData).sort((a, b) => (b.entree + b.sortie) - (a.entree + a.sortie));

  // Pie: sortie by category
  const sortieByCategory: Record<string, number> = {};
  for (const t of transactions.filter(t => t.type === 'sortie')) {
    const catName = t.categories?.name ?? 'Autre';
    sortieByCategory[catName] = (sortieByCategory[catName] ?? 0) + t.amount;
  }
  const pieData = Object.entries(sortieByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <Box>
      {/* Filter controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <FilterListIcon color="primary" />
            <Typography variant="h6">Filtres</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start" flexWrap="wrap">
            <ButtonGroup variant="outlined" size="small">
              <Button
                variant={filterMode === 'month' ? 'contained' : 'outlined'}
                onClick={() => setFilterMode('month')}
              >Mois</Button>
              <Button
                variant={filterMode === 'year' ? 'contained' : 'outlined'}
                onClick={() => setFilterMode('year')}
              >Année</Button>
              <Button
                variant={filterMode === 'range' ? 'contained' : 'outlined'}
                onClick={() => setFilterMode('range')}
              >Période</Button>
            </ButtonGroup>

            {(filterMode === 'month' || filterMode === 'year') && (
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Année</InputLabel>
                <Select
                  value={selectedYear}
                  label="Année"
                  onChange={(e: SelectChangeEvent<number>) => setSelectedYear(Number(e.target.value))}
                >
                  {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            {filterMode === 'month' && (
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Mois</InputLabel>
                <Select
                  value={selectedMonth}
                  label="Mois"
                  onChange={(e: SelectChangeEvent<number>) => setSelectedMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m, i) => <MenuItem key={i} value={i}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            {filterMode === 'range' && (
              <>
                <TextField
                  label="Du"
                  type="date"
                  size="small"
                  value={rangeStart}
                  onChange={e => setRangeStart(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="Au"
                  type="date"
                  size="small"
                  value={rangeEnd}
                  onChange={e => setRangeEnd(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Summary cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card sx={{ borderLeft: 4, borderColor: 'success.main' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Total Entrées</Typography>
                      <Typography variant="h5" color="success.main" fontWeight={700}>
                        {formatAmount(totalEntree)}
                      </Typography>
                    </Box>
                    <TrendingUpIcon sx={{ fontSize: 40, color: 'success.light' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card sx={{ borderLeft: 4, borderColor: 'error.main' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Total Sorties</Typography>
                      <Typography variant="h5" color="error.main" fontWeight={700}>
                        {formatAmount(totalSortie)}
                      </Typography>
                    </Box>
                    <TrendingDownIcon sx={{ fontSize: 40, color: 'error.light' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card sx={{ borderLeft: 4, borderColor: balance >= 0 ? 'primary.main' : 'warning.main' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Solde</Typography>
                      <Typography
                        variant="h5"
                        color={balance >= 0 ? 'primary.main' : 'warning.dark'}
                        fontWeight={700}
                      >
                        {formatAmount(balance)}
                      </Typography>
                    </Box>
                    <AccountBalanceWalletIcon sx={{ fontSize: 40, color: balance >= 0 ? 'primary.light' : 'warning.light' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {transactions.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Typography color="text.secondary">Aucune transaction pour cette période.</Typography>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Charts */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                {barData.length > 0 && (
                  <Grid size={{ xs: 12, lg: 7 }}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>Entrées / Sorties par catégorie</Typography>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={barData} margin={{ top: 5, right: 10, bottom: 60, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-40} textAnchor="end" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={v => new Intl.NumberFormat('fr-MG', { notation: 'compact' }).format(v as number)} />
                            <Tooltip formatter={(v) => formatAmount(Number(v))} />
                            <Legend wrapperStyle={{ paddingTop: 16 }} />
                            <Bar dataKey="entree" name="Entrées" fill="#2e7d32" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="sortie" name="Sorties" fill="#c62828" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
                {pieData.length > 0 && (
                  <Grid size={{ xs: 12, lg: 5 }}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>Répartition des sorties</Typography>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="45%"
                              outerRadius={100}
                              dataKey="value"
                              labelLine={false}
                            >
                              {pieData.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => formatAmount(Number(v))} />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>

              {/* Transaction list */}
              <Card>
                <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
                  <Typography variant="h6" sx={{ px: 1, pb: 2 }}>
                    Liste des transactions
                    <Chip label={transactions.length} size="small" sx={{ ml: 1 }} />
                  </Typography>
                  <Divider sx={{ mb: 1 }} />
                  <TransactionList transactions={transactions} onDelete={load} />
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </Box>
  );
}
