import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import type { SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import FilterListIcon from '@mui/icons-material/FilterList';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../supabase';
import type { Transaction } from '../supabase';

type FilterMode = 'month' | 'year' | 'range' | 'all';
type Granularity = 'day' | 'week' | 'month' | 'year';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const CHART_COLORS = [
  '#1565c0', '#1976d2', '#42a5f5', '#0288d1', '#01579b',
  '#2e7d32', '#388e3c', '#4caf50', '#66bb6a', '#a5d6a7',
  '#c62828', '#e53935', '#ef5350', '#ff7043', '#ffb300',
  '#6a1b9a', '#8e24aa', '#ab47bc', '#795548', '#546e7a',
];

function formatAmount(n: number) {
  return new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function getISOWeek(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = date.getTime();
  date.setUTCMonth(0, 1);
  if (date.getUTCDay() !== 4) {
    date.setUTCMonth(0, 1 + ((4 - date.getUTCDay()) + 7) % 7);
  }
  return {
    year: date.getUTCFullYear(),
    week: 1 + Math.ceil((firstThursday - date.getTime()) / 604800000),
  };
}

interface PeriodPoint {
  key: string;
  label: string;
  [category: string]: string | number;
}

function groupByGranularity(transactions: Transaction[], granularity: Granularity): PeriodPoint[] {
  const map = new Map<string, PeriodPoint>();
  for (const t of transactions) {
    const d = new Date(t.transaction_date + 'T00:00:00');
    let key: string;
    let label: string;
    if (granularity === 'year') {
      key = `${d.getFullYear()}`;
      label = key;
    } else if (granularity === 'month') {
      key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
      label = `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
    } else if (granularity === 'week') {
      const iso = getISOWeek(d);
      key = `${iso.year}-W${pad2(iso.week)}`;
      label = `S${iso.week} ${iso.year}`;
    } else {
      key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    }
    const item = map.get(key) ?? { key, label };
    item[t.type] = Number(item[t.type] ?? 0) + t.amount;
    map.set(key, item);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function groupByGranularityByCategory(transactions: Transaction[], granularity: Granularity, categories: string[]): PeriodPoint[] {
  const map = new Map<string, PeriodPoint>();
  for (const t of transactions) {
    if (t.type !== 'sortie') continue;
    const catName = t.categories?.name ?? 'Autre';
    if (categories.length > 0 && !categories.includes(catName)) continue;

    const d = new Date(t.transaction_date + 'T00:00:00');
    let key: string;
    let label: string;
    if (granularity === 'year') {
      key = `${d.getFullYear()}`;
      label = key;
    } else if (granularity === 'month') {
      key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
      label = `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
    } else if (granularity === 'week') {
      const iso = getISOWeek(d);
      key = `${iso.year}-W${pad2(iso.week)}`;
      label = `S${iso.week} ${iso.year}`;
    } else {
      key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    }
    const item = map.get(key) ?? { key, label };
    item[catName] = Number(item[catName] ?? 0) + t.amount;
    map.set(key, item);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

interface CategoryOption {
  name: string;
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
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({ entree: 0, sortie: 0 });
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<CategoryOption[]>([]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
      } else if (filterMode === 'range') {
        query = query.gte('transaction_date', rangeStart).lte('transaction_date', rangeEnd);
      }

      const { data } = await query;
      if (cancelled) return;
      setTransactions((data as Transaction[]) ?? []);
      setLoading(false);
    })();

    (async () => {
      const { data } = await supabase.from('transactions').select('type, amount');
      if (cancelled) return;
      let entree = 0;
      let sortie = 0;
      for (const t of (data ?? [])) {
        if (t.type === 'entree') entree += t.amount;
        else sortie += t.amount;
      }
      setSummary({ entree, sortie });
      setSummaryLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [filterMode, selectedMonth, selectedYear, rangeStart, rangeEnd, refreshKey]);

  const totalEntree = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0);
  const totalSortie = transactions.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0);
  const balance = totalEntree - totalSortie;
  const soldeActuel = summary.entree - summary.sortie;

  const categoryFilterList = useMemo(() => selectedCategories.map(c => c.name), [selectedCategories]);

  // Apply category filter to transactions (for list + sommes)
  const filteredTransactions = useMemo(() => {
    if (categoryFilterList.length === 0) return transactions;
    return transactions.filter(t => {
      const catName = t.categories?.name ?? 'Autre';
      return categoryFilterList.includes(catName);
    });
  }, [transactions, categoryFilterList]);

  // Bar chart: evolution of entrees over time (green bars)
  const entreeData = groupByGranularity(filteredTransactions, granularity);

  // Line chart: sortie by category over time
  const sortieCategoryData = groupByGranularityByCategory(filteredTransactions, granularity, categoryFilterList);

  // List of categories present in the filtered sortie transactions
  const allSortieCategories = useMemo(() => {
    const names = new Set<string>();
    for (const t of filteredTransactions) {
      if (t.type === 'sortie') names.add(t.categories?.name ?? 'Autre');
    }
    return [...names];
  }, [filteredTransactions]);

  return (
    <Box>
      {/* Current balance banner */}
      <Card sx={{ mb: 3, borderLeft: 6, borderColor: soldeActuel >= 0 ? 'success.main' : 'error.main' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1.5, color: 'text.secondary' }}>
                Solde actuel
              </Typography>
              {summaryLoaded ? (
                <Typography variant="h4" fontWeight={800} color={soldeActuel >= 0 ? 'success.main' : 'error.main'}>
                  {formatAmount(soldeActuel)}
                </Typography>
              ) : (
                <CircularProgress size={32} sx={{ mt: 1 }} />
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 0.5 }}>
                <Typography variant="body2" color="success.main" fontWeight={600}>
                  + {formatAmount(summary.entree)}
                </Typography>
                <Typography variant="body2" color="text.secondary">cumulés</Typography>
                <Typography variant="body2" color="error.main" fontWeight={600}>
                  - {formatAmount(summary.sortie)}
                </Typography>
                <Typography variant="body2" color="text.secondary">sorties cumulées</Typography>
              </Stack>
            </Box>
            <AccountBalanceWalletIcon
              sx={{ fontSize: 56, color: soldeActuel >= 0 ? 'success.light' : 'error.light' }}
            />
          </Box>
        </CardContent>
      </Card>

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
              <Button
                variant={filterMode === 'all' ? 'contained' : 'outlined'}
                onClick={() => setFilterMode('all')}
              >Tout</Button>
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

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Autocomplete
                multiple
                size="small"
                value={selectedCategories}
                onChange={(_, value) => setSelectedCategories(value)}
                options={allSortieCategories.map(name => ({ name }))}
                getOptionLabel={(option) => option.name}
                renderInput={(params) => (
                  <TextField {...params} label="Catégories" placeholder="Toutes" />
                )}
                sx={{ minWidth: 220 }}
              />
            </FormControl>
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
                        {formatAmount(filteredTransactions.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0))}
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
                        {formatAmount(filteredTransactions.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0))}
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
                {entreeData.length > 0 && (
                  <Grid size={{ xs: 12, lg: 7 }}>
                    <Card>
                      <CardContent>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 1,
                            mb: 2,
                          }}
                        >
                          <Typography variant="h6">Évolution des entrées</Typography>
                          <ButtonGroup size="small" variant="outlined">
                            <Button
                              variant={granularity === 'day' ? 'contained' : 'outlined'}
                              onClick={() => setGranularity('day')}
                            >Jour</Button>
                            <Button
                              variant={granularity === 'week' ? 'contained' : 'outlined'}
                              onClick={() => setGranularity('week')}
                            >Semaine</Button>
                            <Button
                              variant={granularity === 'month' ? 'contained' : 'outlined'}
                              onClick={() => setGranularity('month')}
                            >Mois</Button>
                            <Button
                              variant={granularity === 'year' ? 'contained' : 'outlined'}
                              onClick={() => setGranularity('year')}
                            >Année</Button>
                          </ButtonGroup>
                        </Box>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={entreeData} margin={{ top: 5, right: 10, bottom: 20, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
                            <YAxis tickFormatter={v => new Intl.NumberFormat('fr-MG', { notation: 'compact' }).format(v as number)} />
                            <Tooltip formatter={(v) => formatAmount(Number(v))} contentStyle={{ fontSize: 13 }} />
                            <Bar dataKey="entree" name="Entrées" fill="#2e7d32" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {/* Line chart: sortie by category */}
                {sortieCategoryData.length > 0 && allSortieCategories.length > 0 && (
                  <Grid size={{ xs: 12, lg: 5 }}>
                    <Card>
                      <CardContent>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 1,
                            mb: 2,
                          }}
                        >
                          <Typography variant="h6">Dépenses par catégorie</Typography>
                        </Box>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={sortieCategoryData} margin={{ top: 5, right: 10, bottom: 20, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
                            <YAxis tickFormatter={v => new Intl.NumberFormat('fr-MG', { notation: 'compact' }).format(v as number)} />
                            <Tooltip formatter={(v) => formatAmount(Number(v))} contentStyle={{ fontSize: 13 }} />
                            <Legend wrapperStyle={{ paddingTop: 16 }} />
                            {allSortieCategories.map((cat, i) => (
                              <Line
                                key={cat}
                                type="monotone"
                                dataKey={cat}
                                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </>
          )}
        </>
      )}
    </Box>
  );
}