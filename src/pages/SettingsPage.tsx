import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { supabase, isIconColumnEnabled } from '../supabase';
import type { Category, Designation, TransactionType } from '../supabase';
import { getCategoryIcon } from '../categoryIcons';
import CategoryDialog from '../components/CategoryDialog';
import type { CategoryFormValues } from '../components/CategoryDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

export default function SettingsPage() {
  const [type, setType] = useState<TransactionType>('sortie');
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactionCounts, setTransactionCounts] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [designationsMap, setDesignationsMap] = useState<Record<string, Designation[]>>({});
  const [catDialog, setCatDialog] = useState<{ open: boolean; editing: Category | null }>({ open: false, editing: null });
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteDesig, setDeleteDesig] = useState<Designation | null>(null);
  const [desigInput, setDesigInput] = useState('');
  const [editingDesig, setEditingDesig] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [copyAlertOpen, setCopyAlertOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  const isEntree = type === 'entree';

  const loadCategories = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('categories').select('*').eq('type', type).order('name');
    const cats = (data as Category[]) ?? [];
    setCategories(cats);

    const ids = cats.map(c => c.id);
    if (ids.length > 0) {
      const { data: desigs } = await supabase
        .from('designations')
        .select('*')
        .in('category_id', ids)
        .order('name');
      const map: Record<string, Designation[]> = {};
      for (const d of (desigs ?? []) as Designation[]) {
        (map[d.category_id] ??= []).push(d);
      }
      setDesignationsMap(map);
    } else {
      setDesignationsMap({});
    }

    const { data: tx } = await supabase
      .from('transactions')
      .select('category_id');
    const counts: Record<string, number> = {};
    for (const t of (tx ?? []) as { category_id: string }[]) {
      counts[t.category_id] = (counts[t.category_id] ?? 0) + 1;
    }
    setTransactionCounts(counts);

    setSelectedId(prev => (prev && cats.some(c => c.id === prev) ? prev : null));
    setLoading(false);
  }, [type]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  function handleTypeChange(_: React.MouseEvent<HTMLElement>, val: TransactionType | null) {
    if (val) setType(val);
  }

  const selected = categories.find(c => c.id === selectedId) ?? null;
  const selectedDesigs = selected ? designationsMap[selected.id] ?? [] : [];

  async function handleSaveCategory(values: CategoryFormValues) {
    const editing = catDialog.editing;
    const useIcon = await isIconColumnEnabled();
    if (editing) {
      const payload: Record<string, unknown> = { name: values.name, type: values.type };
      if (useIcon) payload.icon = values.icon;
      const { error } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', editing.id);
      if (error) throw error;
      if (values.type !== type) {
        setSelectedId(null);
      }
      setNotice('Catégorie mise à jour.');
    } else {
      const payload: Record<string, unknown> = { name: values.name, type: values.type };
      if (useIcon) payload.icon = values.icon;
      const { error } = await supabase
        .from('categories')
        .insert(payload);
      if (error) throw error;
      setNotice('Catégorie créée.');
    }
    await loadCategories();
  }

  async function handleDeleteCategory() {
    if (!deleteTarget) return;
    const count = transactionCounts[deleteTarget.id] ?? 0;
    if (count > 0) {
      setNotice(`Impossible : ${count} transaction(s) utilisent cette catégorie.`);
      setDeleteTarget(null);
      return;
    }
    const { error } = await supabase.from('categories').delete().eq('id', deleteTarget.id);
    if (error) {
      setNotice(error.message);
    } else {
      setNotice('Catégorie supprimée.');
    }
    setDeleteTarget(null);
    await loadCategories();
  }

  async function handleAddDesignation() {
    if (!selected || !desigInput.trim()) return;
    const { data, error } = await supabase
      .from('designations')
      .insert({ category_id: selected.id, name: desigInput.trim() })
      .select()
      .single();
    if (error) {
      setNotice(error.message);
      return;
    }
    setDesignationsMap(prev => ({ ...prev, [selected.id]: [...(prev[selected.id] ?? []), data as Designation] }));
    setDesigInput('');
  }

  async function handleEditDesignation(id: string) {
    if (!editingDesig || !editingDesig.name.trim()) return;
    const { error } = await supabase.from('designations').update({ name: editingDesig.name.trim() }).eq('id', id);
    if (error) {
      setNotice(error.message);
      return;
    }
    setDesignationsMap(prev => ({
      ...prev,
      [selectedId!]: (prev[selectedId!] ?? []).map(d => d.id === id ? { ...d, name: editingDesig.name.trim() } : d),
    }));
    setEditingDesig(null);
  }

  async function handleDeleteDesignation(id: string) {
    if (!deleteDesig) return;
    const { error } = await supabase.from('designations').delete().eq('id', id);
    if (error) {
      setNotice(error.message);
      return;
    }
    setDesignationsMap(prev => ({ ...prev, [deleteDesig.category_id]: (prev[deleteDesig.category_id] ?? []).filter(d => d.id !== id) }));
    setDeleteDesig(null);
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Paramètres</Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <ToggleButtonGroup value={type} exclusive onChange={handleTypeChange} size="small">
              <ToggleButton value="entree" sx={{ '&.Mui-selected': { bgcolor: 'success.light', color: 'success.dark' } }}>
                <TrendingUpIcon sx={{ mr: 0.5, fontSize: 18 }} /> Entrée
              </ToggleButton>
              <ToggleButton value="sortie" sx={{ '&.Mui-selected': { bgcolor: 'error.light', color: 'error.dark' } }}>
                <TrendingDownIcon sx={{ mr: 0.5, fontSize: 18 }} /> Sortie
              </ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCatDialog({ open: true, editing: null })}
            >
              Nouvelle catégorie
            </Button>
          </Box>
        </CardContent>
      </Card>

      {notice && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          {/* Categories */}
          <Card>
            <CardContent sx={{ p: '0 !important' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {categories.length === 0 && (
                  <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
                    Aucune catégorie {isEntree ? "d'entrée" : 'de sortie'}.
                  </Typography>
                )}
                {categories.map(cat => {
                  const Icon = getCategoryIcon(cat.icon, cat.name);
                  const isSelected = selectedId === cat.id;
                  const canDelete = (transactionCounts[cat.id] ?? 0) === 0;
                  return (
                    <ListItemButton
                      key={cat.id}
                      selected={isSelected}
                      onClick={() => setSelectedId(isSelected ? null : cat.id)}
                      sx={{ gap: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          p: 1,
                          borderRadius: 2,
                          bgcolor: isEntree ? 'success.light' : 'error.light',
                          color: isEntree ? 'success.dark' : 'error.dark',
                        }}
                      >
                        <Icon fontSize="small" />
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{cat.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(transactionCounts[cat.id] ?? 0)} transactions • {(designationsMap[cat.id] ?? []).length} désignations
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={e => { e.stopPropagation(); setCatDialog({ open: true, editing: cat }); }}
                        aria-label="modifier"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        disabled={!canDelete}
                        onClick={e => { e.stopPropagation(); setDeleteTarget(cat); }}
                        aria-label="supprimer"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </ListItemButton>
                  );
                })}
              </Box>
            </CardContent>
          </Card>

          {/* Designations of selected category */}
          <Card>
            <CardContent>
              {!selected ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  Sélectionnez une catégorie pour gérer ses désignations.
                </Typography>
              ) : (
                <>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    {(() => {
                      const Icon = getCategoryIcon(selected.icon, selected.name);
                      return (
                        <>
                          <Icon sx={{ color: isEntree ? 'success.main' : 'error.main' }} />
                          <Typography variant="h6">{selected.name}</Typography>
                        </>
                      );
                    })()}
                  </Stack>

                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Nouvelle désignation..."
                      value={desigInput}
                      onChange={e => setDesigInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') void handleAddDesignation(); }}
                    />
                    <Button variant="contained" startIcon={<AddCircleOutlineIcon />} sx={{ flexShrink: 0 }} onClick={() => void handleAddDesignation()} disabled={!desigInput.trim()}>
                      Ajouter
                    </Button>
                  </Box>

                  {selectedDesigs.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                      Aucune désignation.
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {selectedDesigs.map(d => (
                      <Box key={d.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {editingDesig?.id === d.id ? (
                          <>
                            <TextField
                              size="small"
                              fullWidth
                              autoFocus
                              value={editingDesig.name}
                              onChange={e => setEditingDesig({ id: d.id, name: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter') void handleEditDesignation(d.id); }}
                            />
                            <Button size="small" variant="contained" onClick={() => void handleEditDesignation(d.id)}>OK</Button>
                            <IconButton size="small" onClick={() => setEditingDesig(null)} aria-label="annuler"><DeleteOutlineIcon fontSize="small" /></IconButton>
                          </>
                        ) : (
                          <>
                            <Chip label={d.name} sx={{ flexGrow: 1, justifyContent: 'flex-start' }} />

                            <IconButton
                              size="small"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(String(d.id));
                                  setCopiedId(d.id);
                                  setCopyAlertOpen(true);
                                } catch (error) {
                                  console.error('Erreur lors de la copie de l’ID :', error);
                                }
                              }}
                              aria-label="Copier l'identifiant"
                              title={`Copier l'ID : ${d.id}`}
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={() => setEditingDesig({ id: d.id, name: d.name })} aria-label="modifier">
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => setDeleteDesig(d)} aria-label="supprimer">
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Create / edit category dialog */}
      <CategoryDialog
        open={catDialog.open}
        title={catDialog.editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
        initial={catDialog.editing ? { name: catDialog.editing.name, type: catDialog.editing.type, icon: catDialog.editing.icon ?? '' } : null}
        defaultType={type}
        key={catDialog.editing?.id ?? (catDialog.open ? 'new-open' : 'none')}
        onClose={() => setCatDialog({ open: false, editing: null })}
        onSave={handleSaveCategory}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Supprimer la catégorie</DialogTitle>
        <DialogContent>
          <Typography>
            Supprimer la catégorie <strong>{deleteTarget?.name}</strong> ?
            {deleteTarget && (transactionCounts[deleteTarget.id] ?? 0) > 0 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {transactionCounts[deleteTarget.id]} transaction(s) y sont liées et empêchent la suppression.
              </Alert>
            )}
            Ses désignations seront aussi supprimées.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} color="inherit">Annuler</Button>
          <Button color="error" variant="contained" onClick={() => void handleDeleteCategory()}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
      {/* Delete designation confirm */}
      <ConfirmDialog
        open={!!deleteDesig}
        title="Supprimer la désignation"
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        confirmColor="error"
        message={
          deleteDesig ? (
            <>
              Supprimer la désignation <strong>{deleteDesig.name}</strong> ?
              Les transactions existantes qui l'utilisent pourront être affectées.
            </>
          ) : ''
        }
        onConfirm={() => void handleDeleteDesignation(deleteDesig?.id ?? '')}
        onClose={() => setDeleteDesig(null)}
      />
      <Snackbar
        open={copyAlertOpen}
        autoHideDuration={2500}
        onClose={() => setCopyAlertOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setCopyAlertOpen(false)}
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
        >
          ID {copiedId} copié avec succès !
        </Alert>
      </Snackbar>
    </Box>
  );
}