import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import type { SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import BalanceIcon from '@mui/icons-material/AccountBalanceWallet';
import { supabase } from '../supabase';
import type { Transaction } from '../supabase';
import TransactionList from '../components/TransactionList';

type HistoryMode = 'month' | 'year' | 'all';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function formatAmount(n: number) {
  return new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
}

export default function HistoryPage() {
  const now = new Date();
  const [mode, setMode] = useState<HistoryMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({ entree: 0, sortie: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reloadFlag, setReloadFlag] = useState(0);

  function refreshRequest() {
    setReloadFlag(f => f + 1);
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let query = supabase
        .from('transactions')
        .select('*, categories(id,type,name), designations(id,category_id,name)')
        .order('transaction_date', { ascending: false });

      if (mode === 'month') {
        const start = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
        const end = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];
        query = query.gte('transaction_date', start).lte('transaction_date', end);
      } else if (mode === 'year') {
        query = query.gte('transaction_date', `${selectedYear}-01-01`).lte('transaction_date', `${selectedYear}-12-31`);
      }

      const { data } = await query;
      if (cancelled) return;
      const list = (data as Transaction[]) ?? [];
      setTransactions(list);
      setSummary({
        entree: list.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0),
        sortie: list.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0),
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [mode, selectedMonth, selectedYear, reloadFlag]);

  // Running balance computed over the filtered period only
  const periodBalance = summary.entree - summary.sortie;
  const balanceMap = useMemo(() => {
    const map: Record<string, number> = {};
    const ordered = [...transactions].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
    let running = periodBalance;
    for (const t of ordered) {
      map[t.id] = running;
      running -= t.type === 'entree' ? t.amount : -t.amount;
    }
    return map;
  }, [transactions, periodBalance]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(t =>
      (t.categories?.name ?? '').toLowerCase().includes(q) ||
      (t.designations?.name ?? t.designation_custom ?? '').toLowerCase().includes(q) ||
      (t.note ?? '').toLowerCase().includes(q)
    );
  }, [transactions, search]);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Historique des transactions</Typography>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start" flexWrap="wrap">
            <ButtonGroup variant="outlined" size="small">
              <Button variant={mode === 'month' ? 'contained' : 'outlined'} onClick={() => setMode('month')}>Mois</Button>
              <Button variant={mode === 'year' ? 'contained' : 'outlined'} onClick={() => setMode('year')}>Année</Button>
              <Button variant={mode === 'all' ? 'contained' : 'outlined'} onClick={() => setMode('all')}>Tout</Button>
            </ButtonGroup>

            {(mode === 'month' || mode === 'year') && (
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Année</InputLabel>
                <Select value={selectedYear} label="Année" onChange={(e: SelectChangeEvent<number>) => setSelectedYear(Number(e.target.value))}>
                  {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            {mode === 'month' && (
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Mois</InputLabel>
                <Select value={selectedMonth} label="Mois" onChange={(e: SelectChangeEvent<number>) => setSelectedMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <MenuItem key={i} value={i}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            <TextField
              label="Rechercher"
              size="small"
              value={search}
              sx={{ minWidth: 200 }}
              onChange={e => setSearch(e.target.value)}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Summary */}
      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Chip icon={<TrendingUpIcon />} label={`Entrées : ${formatAmount(summary.entree)}`} color="success" variant="outlined" />
        <Chip icon={<TrendingDownIcon />} label={`Sorties : ${formatAmount(summary.sortie)}`} color="error" variant="outlined" />
        <Chip icon={<BalanceIcon />} label={`Solde : ${formatAmount(summary.entree - summary.sortie)}`} color="primary" variant="outlined" />
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card>
          <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
            <Typography variant="h6" sx={{ px: 1, pb: 2 }}>
              Liste des transactions
              <Chip label={filtered.length} size="small" sx={{ ml: 1 }} />
            </Typography>
            <TransactionList transactions={filtered} onDelete={() => void refreshRequest()} balanceMap={balanceMap} />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}