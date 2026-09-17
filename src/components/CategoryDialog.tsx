import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { ICON_PALETTE, DEFAULT_ICON } from '../categoryIcons';
import type { TransactionType } from '../supabase';

export interface CategoryFormValues {
  name: string;
  type: TransactionType;
  icon: string;
}

interface CategoryDialogProps {
  open: boolean;
  title: string;
  initial: CategoryFormValues | null;
  defaultType: TransactionType;
  onClose: () => void;
  onSave: (values: CategoryFormValues) => Promise<void> | void;
}

export default function CategoryDialog({ open, title, initial, defaultType, onClose, onSave }: CategoryDialogProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<TransactionType>(initial?.type ?? defaultType);
  const [icon, setIcon] = useState(initial?.icon || DEFAULT_ICON);
  const [saving, setSaving] = useState(false);

  const isEntree = type === 'entree';
  const accent = isEntree ? 'success.main' : 'error.main';

  function reset() {
    setName(initial?.name ?? '');
    setType(initial?.type ?? defaultType);
    setIcon(initial?.icon || DEFAULT_ICON);
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), type, icon: icon || DEFAULT_ICON });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const iconKeys = Object.keys(ICON_PALETTE);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
            {/* Type */}
            <ToggleButtonGroup
              value={type}
              exclusive
              onChange={(_, val: TransactionType) => val && setType(val)}
              fullWidth
              size="small"
            >
              <ToggleButton
                value="entree"
                sx={{ '&.Mui-selected': { bgcolor: 'success.light', color: 'success.dark' } }}
              >
                <TrendingUpIcon sx={{ mr: 0.5 }} /> Entrée
              </ToggleButton>
              <ToggleButton
                value="sortie"
                sx={{ '&.Mui-selected': { bgcolor: 'error.light', color: 'error.dark' } }}
              >
                <TrendingDownIcon sx={{ mr: 0.5 }} /> Sortie
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Name */}
            <TextField
              label="Nom de la catégorie"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              fullWidth
              required
              sx={{ '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: accent } }}
            />

            {/* Icon */}
            <Box>
              <Box component="span" sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'text.secondary' }}>
                Icône
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 0.5, mt: 1, maxHeight: 200, overflow: 'auto' }}>
                {iconKeys.map(key => {
                  const Icon = ICON_PALETTE[key];
                  const selected = icon === key;
                  return (
                    <Box
                      key={key}
                      onClick={() => setIcon(key)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 1,
                        borderRadius: 2,
                        cursor: 'pointer',
                        border: selected ? `2px solid ${isEntree ? '#2e7d32' : '#c62828'}` : '2px solid transparent',
                        bgcolor: selected ? (isEntree ? 'success.light' : 'error.light') : 'action.hover',
                        color: selected ? (isEntree ? 'success.dark' : 'error.dark') : 'text.secondary',
                        '&:hover': { bgcolor: selected ? undefined : 'action.selected' },
                      }}
                    >
                      <Icon fontSize="small" />
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} color="inherit">Annuler</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!name.trim() || saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ bgcolor: isEntree ? 'success.main' : 'primary.main', '&:hover': { bgcolor: isEntree ? 'success.dark' : 'primary.dark' } }}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}