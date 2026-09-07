import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import type { SelectChangeEvent } from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { supabase } from '../supabase';
import type { Category, Designation, TransactionType } from '../supabase';

interface TransactionFormProps {
  onSuccess: () => void;
}

export default function TransactionForm({ onSuccess }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>('entree');
  const [categories, setCategories] = useState<Category[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [designationId, setDesignationId] = useState('');

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [newDesignationName, setNewDesignationName] = useState('');
  const [showNewDesig, setShowNewDesig] = useState(false);

  useEffect(() => {
    loadCategories();
  }, [type]);

  useEffect(() => {
    if (categoryId) loadDesignations(categoryId);
    else setDesignations([]);
    setDesignationId('');
    setShowNewDesig(false);
    setNewDesignationName('');
  }, [categoryId]);

  async function loadCategories() {
    setCategoryId('');
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('type', type)
      .order('name');
    setCategories(data ?? []);
  }

  async function loadDesignations(catId: string) {
    const { data } = await supabase
      .from('designations')
      .select('*')
      .eq('category_id', catId)
      .order('name');
    setDesignations(data ?? []);
  }

  function handleTypeChange(_: React.MouseEvent<HTMLElement>, val: TransactionType | null) {
    if (val) setType(val);
  }

  function handleDesignationChange(e: SelectChangeEvent) {
    const val = e.target.value;
    if (val === '__new__') {
      setShowNewDesig(true);
      setDesignationId('');
    } else if (val === '__motif__') {
      setDesignationId('__motif__');
      setShowNewDesig(false);
    } else {
      setDesignationId(val);
      setShowNewDesig(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!categoryId) { setError('Veuillez sélectionner une catégorie.'); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setError('Veuillez entrer un montant valide.'); return; }

    setLoading(true);
    try {
      let finalDesigId: string | null = null;
      let finalCustom: string | null = null;

      if (showNewDesig && newDesignationName.trim()) {
        const { data: newD, error: dErr } = await supabase
          .from('designations')
          .insert({ category_id: categoryId, name: newDesignationName.trim() })
          .select()
          .single();
        if (dErr) throw dErr;
        finalDesigId = newD.id;
      } else if (designationId === '__motif__') {
        const motifDesig = designations.find(d => d.name === 'Motif oublié');
        if (motifDesig) finalDesigId = motifDesig.id;
        else finalCustom = 'Motif oublié';
      } else if (designationId) {
        finalDesigId = designationId;
      }

      const { error: txErr } = await supabase.from('transactions').insert({
        type,
        category_id: categoryId,
        designation_id: finalDesigId,
        designation_custom: finalCustom,
        amount: Number(amount),
        note: note.trim() || null,
        transaction_date: date,
      });

      if (txErr) throw txErr;

      setSuccess(true);
      setAmount('');
      setNote('');
      setCategoryId('');
      setDesignationId('');
      setNewDesignationName('');
      setShowNewDesig(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  const isEntree = type === 'entree';
  const accentColor = isEntree ? 'success.main' : 'error.main';

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <AddCircleOutlineIcon color="primary" />
          <Typography variant="h6" color="text.primary">
            Nouvelle transaction
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Type toggle */}
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
              Type de transaction
            </Typography>
            <ToggleButtonGroup
              value={type}
              exclusive
              onChange={handleTypeChange}
              fullWidth
              size="medium"
            >
              <ToggleButton
                value="entree"
                sx={{
                  '&.Mui-selected': { bgcolor: 'success.light', color: 'success.dark', borderColor: 'success.main' },
                  py: 1.5,
                }}
              >
                <TrendingUpIcon sx={{ mr: 1 }} />
                Entrée
              </ToggleButton>
              <ToggleButton
                value="sortie"
                sx={{
                  '&.Mui-selected': { bgcolor: 'error.light', color: 'error.dark', borderColor: 'error.main' },
                  py: 1.5,
                }}
              >
                <TrendingDownIcon sx={{ mr: 1 }} />
                Sortie
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Category */}
          <FormControl fullWidth required>
            <InputLabel>Catégorie</InputLabel>
            <Select
              value={categoryId}
              label="Catégorie"
              onChange={(e: SelectChangeEvent) => setCategoryId(e.target.value)}
            >
              {categories.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Designation */}
          {categoryId && (
            <FormControl fullWidth>
              <InputLabel>Désignation</InputLabel>
              <Select
                value={showNewDesig ? '__new__' : designationId}
                label="Désignation"
                onChange={handleDesignationChange}
              >
                {designations.map(d => (
                  <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                ))}
                <MenuItem value="__new__" sx={{ color: 'primary.main', fontWeight: 600 }}>
                  + Créer une nouvelle désignation
                </MenuItem>
                <MenuItem value="__motif__" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  Motif oublié
                </MenuItem>
              </Select>
            </FormControl>
          )}

          {/* New designation input */}
          {showNewDesig && (
            <TextField
              label="Nom de la nouvelle désignation"
              value={newDesignationName}
              onChange={e => setNewDesignationName(e.target.value)}
              fullWidth
              required
              autoFocus
            />
          )}

          {/* Amount */}
          <TextField
            label="Montant (Ar)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            type="number"
            inputProps={{ min: 0, step: 'any' }}
            fullWidth
            required
            sx={{
              '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                borderColor: accentColor,
              },
            }}
          />

          {/* Date */}
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />

          {/* Note */}
          <TextField
            label="Note (optionnel)"
            value={note}
            onChange={e => setNote(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />

          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">Transaction enregistrée avec succès !</Alert>}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AddCircleOutlineIcon />}
            sx={{
              bgcolor: isEntree ? 'success.main' : 'primary.main',
              '&:hover': { bgcolor: isEntree ? 'success.dark' : 'primary.dark' },
              py: 1.5,
            }}
          >
            {loading ? 'Enregistrement...' : 'Enregistrer la transaction'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
