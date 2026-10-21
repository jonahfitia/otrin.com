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
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { supabase } from '../supabase';
import type { Transaction } from '../supabase';

type FilterMode = 'month' | 'year' | 'range' | 'all';
type Granularity = 'day' | 'week' | 'month' | 'year';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
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
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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

    return () => { cancelled = true; };
  }, [filterMode, selectedMonth, selectedYear, rangeStart, rangeEnd, refreshKey]);

  const totalEntree = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0);
  const totalSortie = transactions.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0);
  const balance = totalEntree - totalSortie;

  const categoryFilterList = useMemo(() => selectedCategories.map(c => c.name), [selectedCategories]);

  // Apply category filter to transactions (for list + sommes)
  const filteredTransactions = useMemo(() => {
    if (categoryFilterList.length === 0) return transactions;
    return transactions.filter(t => {
      const catName = t.categories?.name ?? 'Autre';
      return categoryFilterList.includes(catName);
    });
  }, [transactions, categoryFilterList]);

  // Combined chart data: entrée + sortie per period
  const chartData = useMemo(
    () => groupByGranularity(filteredTransactions, granularity),
    [filteredTransactions, granularity]
  );

  const [zoomRange, setZoomRange] = useState<[number, number] | null>(null);

  const changeGranularity = (g: Granularity) => {
    setGranularity(g);
    setZoomRange(null);
  };

  const handleBrush = (range: { startIndex: number; endIndex: number }) => {
    const last = chartData.length - 1;
    const start = range.startIndex;
    const end = range.endIndex;
    setZoomRange(start === 0 && end === last ? null : [start, end]);
  };

  const resetZoom = () => setZoomRange(null);

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
                {chartData.length > 0 && (
                  <Grid size={{ xs: 12 }}>
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
                          <Typography variant="h6">Entrées & Dépenses</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            {zoomRange && (
                              <Button size="small" variant="text" onClick={resetZoom}>
                                Réinitialiser le zoom
                              </Button>
                            )}
                            <ButtonGroup size="small" variant="outlined">
                              <Button
                                variant={granularity === 'day' ? 'contained' : 'outlined'}
                                onClick={() => changeGranularity('day')}
                              >Jour</Button>
                              <Button
                                variant={granularity === 'week' ? 'contained' : 'outlined'}
                                onClick={() => changeGranularity('week')}
                              >Semaine</Button>
                              <Button
                                variant={granularity === 'month' ? 'contained' : 'outlined'}
                                onClick={() => changeGranularity('month')}
                              >Mois</Button>
                              <Button
                                variant={granularity === 'year' ? 'contained' : 'outlined'}
                                onClick={() => changeGranularity('year')}
                              >Année</Button>
                            </ButtonGroup>
                          </Box>
                        </Box>
                        <ResponsiveContainer width="100%" height={350}>
                          <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 20, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
                            <YAxis tickFormatter={v => new Intl.NumberFormat('fr-MG', { notation: 'compact' }).format(v as number)} />
                            <Tooltip formatter={(v) => formatAmount(Number(v))} contentStyle={{ fontSize: 13 }} />
                            <Legend wrapperStyle={{ paddingTop: 16 }} />
                            <Bar dataKey="entree" name="Entrées" fill="#2e7d32" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="sortie" name="Dépenses" stroke="#c62828" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                            <Brush
                              dataKey="label"
                              height={30}
                              stroke="#1976d2"
                              startIndex={zoomRange ? zoomRange[0] : 0}
                              endIndex={zoomRange ? zoomRange[1] : chartData.length - 1}
                              onChange={handleBrush}
                            />
                          </ComposedChart>
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