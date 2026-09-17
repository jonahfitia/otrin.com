import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import BackspaceIcon from '@mui/icons-material/Backspace';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { supabase, isIconColumnEnabled } from '../supabase';
import type { Category, Designation, TransactionType } from '../supabase';
import { getCategoryIcon } from '../categoryIcons';
import CategoryDialog from '../components/CategoryDialog';
import type { CategoryFormValues } from '../components/CategoryDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import theme from '../theme';

interface TransactionEntryProps {
  onSuccess: () => void;
}

interface CartItem {
  type: TransactionType;
  category: Category;
  designation: Designation | null;
  amount: number;
  date: string;
}

export default function TransactionEntry({ onSuccess }: TransactionEntryProps) {
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [type, setType] = useState<TransactionType>('entree');
  const [categories, setCategories] = useState<Category[]>([]);
  const [designationsMap, setDesignationsMap] = useState<Record<string, Designation[]>>({});
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedDesignation, setSelectedDesignation] = useState<Designation | null>(null);
  const [newDesigName, setNewDesigName] = useState('');
  const [creatingDesig, setCreatingDesig] = useState(false);
  const [amount, setAmount] = useState('');
  const [recentAmounts, setRecentAmounts] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<CartItem[]>([]);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isEntree = type === 'entree';
  const accentColor = isEntree ? 'success.main' : 'error.main';

  const loadCategories = useCallback(async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('type', type)
      .order('name');
    const cats = (data as Category[]) ?? [];
    setCategories(cats);
    setSelectedCategory(prev => {
      if (prev && prev.type !== type) return null;
      return prev;
    });
    setSelectedDesignation(null);
  }, [type]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('transactions')
        .select('amount')
        .order('created_at', { ascending: false })
        .limit(40);
      if (cancelled) return;
      const seen = new Set<number>();
      const out: number[] = [];
      for (const t of (data ?? []) as { amount: number }[]) {
        const rounded = Math.round(t.amount * 100) / 100;
        if (!seen.has(rounded)) {
          seen.add(rounded);
          out.push(rounded);
        }
        if (out.length >= 8) break;
      }
      setRecentAmounts(out);
    })();
    return () => { cancelled = true; };
  }, []);

  async function loadDesignations(categoryId: string) {
    if (designationsMap[categoryId]) return;
    const { data } = await supabase
      .from('designations')
      .select('*')
      .eq('category_id', categoryId)
      .order('name');
    setDesignationsMap(prev => ({ ...prev, [categoryId]: (data as Designation[]) ?? [] }));
  }

  async function handleCategoryChange(category: Category | null) {
    setSelectedCategory(category);
    setSelectedDesignation(null);
    setCreatingDesig(false);
    setNewDesigName('');
    if (category) void loadDesignations(category.id);
  }

  function handleTypeChange(_: React.MouseEvent<HTMLElement>, val: TransactionType | null) {
    if (val && val !== type) {
      setType(val);
      setSelectedCategory(null);
      setSelectedDesignation(null);
    }
  }

  function appendDigit(d: string) {
    setSuccess(false);
    if (d === '.') {
      if (amount === '') return;
      if (amount.includes('.')) return;
      setAmount(a => a + '.');
      return;
    }
    setAmount(prev => {
      if (prev === '0') return d;
      return prev + d;
    });
  }

  function backspace() {
    setSuccess(false);
    setAmount(prev => prev.slice(0, -1));
  }

  async function handleCreateDesig() {
    if (!selectedCategory || !newDesigName.trim()) return;
    const { data, error: err } = await supabase
      .from('designations')
      .insert({ category_id: selectedCategory.id, name: newDesigName.trim() })
      .select()
      .single();
    if (err) {
      setError(err.message);
      return;
    }
    const d = data as Designation;
    setDesignationsMap(prev => ({
      ...prev,
      [selectedCategory.id]: [...(prev[selectedCategory.id] ?? []), d],
    }));
    setSelectedDesignation(d);
    setCreatingDesig(false);
    setNewDesigName('');
  }

  async function handleCreateCategory(values: CategoryFormValues) {
    const payload: Record<string, unknown> = { name: values.name, type: values.type };
    if (await isIconColumnEnabled()) payload.icon = values.icon;
    const { data, error: err } = await supabase
      .from('categories')
      .insert(payload)
      .select()
      .single();
    if (err) throw err;
    if (values.type !== type) {
      setType(values.type);
      setCategories([]);
      setSelectedCategory(null);
      setDesignationsMap({});
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('type', values.type)
        .order('name');
      setCategories((cats as Category[]) ?? []);
    } else {
      setCategories(prev => [...prev, data as Category]);
    }
    setSelectedCategory(data as Category);
    setSelectedDesignation(null);
    void loadDesignations((data as Category).id);
  }

  function addToCart() {
    setError('');
    setSuccess(false);
    if (!selectedCategory) {
      setError('Choisissez une catégorie pour ajouter un article.');
      return;
    }
    const value = Number(amount);
    if (!(value > 0)) {
      setError('Saisissez un montant valide pour ajouter un article.');
      return;
    }
    setItems(prev => [...prev, {
      type,
      category: selectedCategory,
      designation: selectedDesignation,
      amount: value,
      date,
    }]);
    setAmount('');
    setError('');
  }

  function removeFromCart(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index));
    setSuccess(false);
  }

  function updateItemDate(index: number, value: string) {
    setItems(prev => prev.map((item, i) => (i === index ? { ...item, date: value } : item)));
  }

  async function handleSubmit(): Promise<boolean> {
    setError('');
    setSuccess(false);
    if (items.length === 0) {
      setError('Votre liste est vide. Ajoutez au moins un article.');
      return false;
    }

    setLoading(true);
    try {
      const inserts = items.map(item => ({
        type: item.type,
        category_id: item.category.id,
        designation_id: item.designation?.id ?? null,
        designation_custom: null,
        amount: item.amount,
        note: note.trim() || null,
        transaction_date: item.date,
      }));
      const { error: txErr } = await supabase.from('transactions').insert(inserts);
      if (txErr) throw txErr;

      setSuccess(true);
      setItems([]);
      setAmount('');
      setNote('');
      setRecentAmounts(prev => {
        const amounts = items.map(i => i.amount).concat(prev);
        return [...new Set(amounts)].slice(0, 8);
      });
      setError('');
      onSuccess();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  const numValue = useMemo(() => Number(amount || '0'), [amount]);
  const showKeypad = isMobile;

  const totalAmount = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);
  const totalEntrees = useMemo(() => items.filter(i => i.type === 'entree').reduce((s, i) => s + i.amount, 0), [items]);
  const totalSorties = useMemo(() => items.filter(i => i.type === 'sortie').reduce((s, i) => s + i.amount, 0), [items]);

  const keypadRows: string[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '⌫'],
  ];

  const categoryDesignations = selectedCategory ? designationsMap[selectedCategory.id] ?? [] : [];

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Nouvelle transaction</Typography>

      <Grid container spacing={2} alignItems="stretch">
        {/* Left: type + categories + designations */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <ToggleButtonGroup
                value={type}
                exclusive
                onChange={handleTypeChange}
                fullWidth
                size="large"
              >
                <ToggleButton
                  value="entree"
                  sx={{ py: 1.5, '&.Mui-selected': { bgcolor: 'success.main', color: '#fff', '&:hover': { bgcolor: 'success.dark' } } }}
                >
                  <TrendingUpIcon sx={{ mr: 1 }} /> Entrée
                </ToggleButton>
                <ToggleButton
                  value="sortie"
                  sx={{ py: 1.5, '&.Mui-selected': { bgcolor: 'error.main', color: '#fff', '&:hover': { bgcolor: 'error.dark' } } }}
                >
                  <TrendingDownIcon sx={{ mr: 1 }} /> Sortie
                </ToggleButton>
              </ToggleButtonGroup>

              <Box sx={{ mt: 3, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" color="text.secondary">Catégorie</Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setCatDialogOpen(true)}
                  sx={{ color: 'primary.main', fontWeight: 600 }}
                >
                  Nouvelle
                </Button>
              </Box>
              {categories.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                  Aucune catégorie. Créez-en une.
                </Box>
              ) : (
                <Grid container spacing={1}>
                  {categories.map(cat => {
                    const Icon = getCategoryIcon(cat.icon, cat.name);
                    const selected = selectedCategory?.id === cat.id;
                    return (
                      <Grid size={{ xs: 4, sm: 3, md: 4, lg: 3 }} key={cat.id}>
                        <Box
                          onClick={() => void handleCategoryChange(selected ? null : cat)}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 0.5,
                            p: 1.25,
                            borderRadius: 2.5,
                            cursor: 'pointer',
                            userSelect: 'none',
                            border: '2px solid',
                            borderColor: selected ? accentColor : 'transparent',
                            color: selected ? (isEntree ? 'success.main' : 'error.main') : 'text.primary',
                            bgcolor: selected ? (isEntree ? 'success.light' : 'error.light') : 'grey.50',
                            '&:hover': { bgcolor: selected ? undefined : 'action.hover' },
                          }}
                        >
                          <Icon sx={{ fontSize: 30 }} />
                          <Typography variant="caption" sx={{ fontWeight: selected ? 700 : 500, textAlign: 'center', lineHeight: 1.15 }}>
                            {cat.name}
                          </Typography>
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              )}

              {selectedCategory && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Désignation
                  </Typography>
                  <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 1 }}>
                    Choisissez une désignation dans la liste, ou ajoutez-en une nouvelle.
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {categoryDesignations.map(d => (
                      <Chip
                        key={d.id}
                        label={d.name}
                        size="small"
                        color={selectedDesignation?.id === d.id ? (isEntree ? 'success' : 'error') : 'default'}
                        variant={selectedDesignation?.id === d.id ? 'filled' : 'outlined'}
                        onClick={() => setSelectedDesignation(d)}
                      />
                    ))}
                    {!creatingDesig && (
                      <Chip
                        label="＋ Nouveau"
                        size="small"
                        icon={<AddIcon />}
                        variant="outlined"
                        color="primary"
                        onClick={() => setCreatingDesig(true)}
                      />
                    )}
                  </Box>
                  {creatingDesig && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5, alignItems: 'center' }}>
                      <TextField
                        label="Nouvelle désignation"
                        value={newDesigName}
                        onChange={e => setNewDesigName(e.target.value)}
                        size="small"
                        fullWidth
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleCreateDesig(); } }}
                      />
                      <Button variant="contained" size="medium" onClick={() => void handleCreateDesig()} disabled={!newDesigName.trim()}>
                        OK
                      </Button>
                      <IconButton onClick={() => { setCreatingDesig(false); setNewDesigName(''); }} sx={{ color: 'text.disabled' }} aria-label="annuler">
                        <ClearIcon />
                      </IconButton>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right: amount + keypad */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Montant (Ar)</Typography>
              <TextField
                value={amount}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9.]/g, '');
                  setSuccess(false);
                  if (v === '') { setAmount(''); return; }
                  if (v.split('.').length > 2) return;
                  setAmount(v);
                }}
                inputMode="decimal"
                placeholder="0"
                fullWidth
                sx={{
                  '& .MuiInputBase-input': { fontSize: { xs: 42, sm: 48 }, fontWeight: 800, textAlign: 'right', py: 1, pr: 1, color: accentColor },
                }}
              />

              {recentAmounts.length > 0 && (
                <Box sx={{ mt: 1, mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">Montants récents</Typography>
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {recentAmounts.map(v => (
                      <Chip key={v} label={v.toLocaleString('fr-FR')} size="small" onClick={() => { setAmount(String(v)); setSuccess(false); }} />
                    ))}
                  </Box>
                </Box>
              )}

              {showKeypad && (
                <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75 }}>
                  {keypadRows.flat().map((k, i) => (
                    <Box
                      key={i}
                      onClick={() => k === '⌫' ? backspace() : appendDigit(k)}
                      sx={{
                        py: 1.6,
                        borderRadius: 2,
                        bgcolor: k === '⌫' ? 'action.disabledBackground' : 'action.hover',
                        fontSize: 22,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:active': { bgcolor: 'primary.main', color: '#fff' },
                      }}
                    >
                      {k === '⌫' ? <BackspaceIcon fontSize="small" /> : k}
                    </Box>
                  ))}
                </Box>
              )}

              {!showKeypad && numValue > 0 && (
                <Typography variant="h5" fontWeight={800} sx={{ my: 2 }}>
                  {numValue.toLocaleString('fr-FR')} Ar
                </Typography>
              )}

              <Button
                onClick={addToCart}
                variant="contained"
                size="large"
                fullWidth
                disabled={!selectedCategory}
                startIcon={<AddIcon />}
                sx={{
                  mt: 2,
                  py: 1.4,
                  bgcolor: isEntree ? 'success.main' : 'primary.main',
                  '&:hover': { bgcolor: isEntree ? 'success.dark' : 'primary.dark' },
                }}
              >
                Ajouter à la liste
              </Button>

              {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            </CardContent>
          </Card>
        </Grid>

        {/* Batch info: date + note */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Date par défaut"
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    fullWidth
                    size="small"
                    helperText="Date du prochain article ajouté — modifiable dans le panier ligne par ligne."
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Note globale (optionnel)"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    placeholder="Appliquée à tout l'enregistrement"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Cart */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ReceiptLongIcon color="primary" />
                <Typography variant="h6">Panier</Typography>
                <Chip label={items.length} size="small" color="primary" />
                <Box sx={{ flexGrow: 1 }} />
                {items.length > 0 && (
                  <Button size="small" color="inherit" onClick={() => setConfirmClearOpen(true)}>
                    Tout vider
                  </Button>
                )}
              </Box>

              {success && <Alert severity="success" sx={{ mb: 2 }}>Toutes les transactions enregistrées avec succès !</Alert>}

              {items.length === 0 ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  La liste est vide. Remplissez le formulaire puis touchez « Ajouter à la liste ».
                </Typography>
              ) : (
                <>
                  <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: 340, overflow: 'auto', pr: 0.5 }}>
                    {items.map((item, index) => {
                      const isIn = item.type === 'entree';
                      const Icon = getCategoryIcon(item.category.icon, item.category.name);
                      return (
                        <Box
                          key={index}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            py: 1,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Avatar
                            sx={{
                              width: 36,
                              height: 36,
                              bgcolor: isIn ? 'success.light' : 'error.light',
                              color: isIn ? 'success.dark' : 'error.dark',
                            }}
                          >
                            <Icon fontSize="small" />
                          </Avatar>
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {isIn ? '↑ ' : '↓ '}{item.category.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">
                              {item.designation?.name ?? ''}
                            </Typography>
                            <TextField
                              type="date"
                              size="small"
                              value={item.date}
                              onChange={e => updateItemDate(index, e.target.value)}
                              sx={{ mt: 0.5, width: { xs: '100%', sm: 170 } }}
                              slotProps={{ inputLabel: { shrink: true } }}
                            />
                          </Box>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{ color: isIn ? 'success.main' : 'error.main', whiteSpace: 'nowrap', alignSelf: 'flex-start', mt: 1 }}
                          >
                            {isIn ? '+ ' : '- '}{item.amount.toLocaleString('fr-FR')} Ar
                          </Typography>
                          <IconButton size="small" onClick={() => removeFromCart(index)} sx={{ color: 'text.disabled', alignSelf: 'flex-start', mt: 0.5 }} aria-label="retirer">
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      );
                    })}
                  </Box>

                  <Button
                    onClick={() => setConfirmSaveOpen(true)}
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <AddCircleOutlineIcon />}
                    sx={{ mt: 2, py: 1.5, bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
                  >
                    {loading ? 'Enregistrement...' : `Enregistrer tout (${items.length})`}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <CategoryDialog
        open={catDialogOpen}
        title="Nouvelle catégorie"
        initial={null}
        defaultType={type}
        key={catDialogOpen ? 'new-open' : 'new-closed'}
        onClose={() => setCatDialogOpen(false)}
        onSave={handleCreateCategory}
      />

      <ConfirmDialog
        open={confirmSaveOpen}
        title="Enregistrer le panier"
        message={
          items.length > 0 ? (
            <>
              Vous allez enregistrer <strong>{items.length} transaction(s)</strong>.
              <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {totalEntrees > 0 && (
                  <Typography variant="body2" color="success.main" fontWeight={600}>
                    Entrées : + {totalEntrees.toLocaleString('fr-FR')} Ar
                  </Typography>
                )}
                {totalSorties > 0 && (
                  <Typography variant="body2" color="error.main" fontWeight={600}>
                    Sorties : - {totalSorties.toLocaleString('fr-FR')} Ar
                  </Typography>
                )}
                <Typography variant="subtitle1" fontWeight={800}>
                  Total : {totalAmount.toLocaleString('fr-FR')} Ar
                </Typography>
              </Box>
              Cette action est définitive.
            </>
          ) : ''
        }
        confirmLabel="Enregistrer"
        cancelLabel="Annuler"
        confirmColor="primary"
        loading={loading}
        onConfirm={() => {
          if (!confirmSaveOpen) return;
          void handleSubmit().then(ok => { if (ok) setConfirmSaveOpen(false); });
        }}
        onClose={() => !loading && setConfirmSaveOpen(false)}
      />

      <ConfirmDialog
        open={confirmClearOpen}
        title="Vider le panier"
        message={
          items.length > 0 ? (
            <>
              Vider le panier ({items.length} article{items.length > 1 ? 's' : ''}) ? Tous les articles non enregistrés seront perdus.
            </>
          ) : ''
        }
        confirmLabel="Vider"
        cancelLabel="Annuler"
        confirmColor="error"
        onConfirm={() => { setItems([]); setConfirmClearOpen(false); }}
        onClose={() => setConfirmClearOpen(false)}
      />
    </Box>
  );
}