import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import ButtonGroup from '@mui/material/ButtonGroup';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { supabase } from '../supabase';
import type { Transaction } from '../supabase';

type HistoryMode = 'month' | 'year' | 'all';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

type CsvColumn = 'date' | 'type' | 'categorie' | 'designation' | 'montant' | 'note' | 'cree_le';

const COLUMNS: Record<CsvColumn, string> = {
  date: 'Date',
  type: 'Type',
  categorie: 'Catégorie',
  designation: 'Désignation',
  montant: 'Montant (Ar)',
  note: 'Note',
  cree_le: 'Créé le',
};

const DEFAULT_COLUMNS: CsvColumn[] = ['date', 'type', 'categorie', 'designation', 'montant', 'note', 'cree_le'];

function formatAmount(n: number) {
  return new Intl.NumberFormat('fr-MG').format(n);
}

function formatDateFr(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function escapeCsv(value: string | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function ExportPage() {
  const now = new Date();
  const [mode, setMode] = useState<HistoryMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColumns, setSelectedColumns] = useState<CsvColumn[]>([...DEFAULT_COLUMNS]);
  const [notice, setNotice] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*, categories(id,type,name), designations(id,category_id,name)')
        .order('transaction_date', { ascending: false });
      if (cancelled) return;
      setTransactions((data as Transaction[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = transactions;
    if (mode === 'month') {
      const start = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
      const end = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];
      list = list.filter(t => t.transaction_date >= start && t.transaction_date <= end);
    } else if (mode === 'year') {
      list = list.filter(t => t.transaction_date >= `${selectedYear}-01-01` && t.transaction_date <= `${selectedYear}-12-31`);
    }
    return list.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  }, [transactions, mode, selectedMonth, selectedYear]);

  const allColumnsChecked = selectedColumns.length === DEFAULT_COLUMNS.length;

  const handleToggleAll = (checked: boolean) => {
    setSelectedColumns(checked ? [...DEFAULT_COLUMNS] : []);
  };

  const handleToggleColumn = (col: CsvColumn) => {
    setSelectedColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleExport = useCallback(() => {
    if (selectedColumns.length === 0) {
      setNotice('Sélectionnez au moins une colonne.');
      setSnackbarOpen(true);
      return;
    }

    const lines: string[] = [];

    const header = selectedColumns.map(col => COLUMNS[col]).join(';');
    lines.push(header);

    for (const t of filtered) {
      const rowValues: string[] = [];
      for (const col of selectedColumns) {
        let value: string | null | undefined = '';
        switch (col) {
          case 'date':
            value = formatDateFr(t.transaction_date);
            break;
          case 'type':
            value = t.type === 'entree' ? 'Entrée' : 'Sortie';
            break;
          case 'categorie':
            value = t.categories?.name ?? '';
            break;
          case 'designation':
            value = t.designations?.name ?? t.designation_custom ?? '';
            break;
          case 'montant':
            value = `${t.type === 'sortie' ? '-' : '+'}${formatAmount(t.amount)}`;
            break;
          case 'note':
            value = t.note ?? '';
            break;
          case 'cree_le':
            value = formatDateFr(t.created_at);
            break;
        }
        rowValues.push(escapeCsv(value));
      }
      lines.push(rowValues.join(';'));
    }

    const csvContent = lines.join('\r\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historique-otrin-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setNotice(`${filtered.length} transaction(s) exportée(s).`);
    setSnackbarOpen(true);
  }, [filtered, selectedColumns, setNotice, setSnackbarOpen]);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Exportation de l'historique</Typography>

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
                <Select value={selectedYear} label="Année" onChange={(e) => setSelectedYear(Number(e.target.value))}>
                  {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            {mode === 'month' && (
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Mois</InputLabel>
                <Select value={selectedMonth} label="Mois" onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <MenuItem key={i} value={i}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" startIcon={<TrendingUpIcon />} onClick={() => setMode('all')}>Tout exporter</Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Colonnes à inclure</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Checkbox
                checked={allColumnsChecked}
                onChange={(e) => handleToggleAll(e.target.checked ?? false)}
                size="small"
                sx={{ p: 0 }}
              />
              <Typography variant="body2" fontWeight={600}>Tout sélectionner</Typography>
            </Box>
            {DEFAULT_COLUMNS.map(col => (
              <Box key={col} sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 2 }}>
                <Checkbox
                  checked={selectedColumns.includes(col)}
                  onChange={() => handleToggleColumn(col)}
                  size="small"
                  sx={{ p: 0 }}
                />
                <Typography variant="body2">{COLUMNS[col]}</Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<TrendingDownIcon />}
          disabled={loading || filtered.length === 0 || selectedColumns.length === 0}
          onClick={handleExport}
        >
          Exporter en CSV
        </Button>
        <Typography variant="body2" color="text.secondary">
          {filtered.length} transaction(s) dans la sélection
        </Typography>
      </Box>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="success" variant="filled" sx={{ width: '100%' }}>
          {notice}
        </Alert>
      </Snackbar>
    </Box>
  );
}
