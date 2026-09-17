import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { supabase } from '../supabase';
import type { Transaction } from '../supabase';
import ConfirmDialog from './ConfirmDialog';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: () => void;
  balanceMap?: Record<string, number>;
}

function formatAmount(n: number) {
  return new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function TransactionList({ transactions, onDelete, balanceMap }: TransactionListProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [prevCount, setPrevCount] = useState(transactions.length);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (prevCount !== transactions.length) {
    setPrevCount(transactions.length);
    setPage(0);
  }

  const deleteTarget = transactions.find(t => t.id === deleteId) ?? null;

  async function handleConfirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await supabase.from('transactions').delete().eq('id', deleteId);
      setDeleteId(null);
      onDelete();
    } finally {
      setDeleting(false);
    }
  }

  if (transactions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography color="text.secondary">Aucune transaction.</Typography>
      </Box>
    );
  }

  const shown = transactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <TableContainer>
        <Table size="small">
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' } }}>
            <TableCell>Date</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Catégorie</TableCell>
            <TableCell>Désignation</TableCell>
            <TableCell align="right">Montant</TableCell>
            <TableCell align="right">Solde</TableCell>
            <TableCell align="center">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {shown.map(t => (
            <TableRow
              key={t.id}
              hover
              sx={{ '&:last-child td': { border: 0 } }}
            >
              <TableCell>
                <Typography variant="body2">{formatDate(t.transaction_date)}</Typography>
              </TableCell>
              <TableCell>
                {t.type === 'entree' ? (
                  <Chip
                    icon={<TrendingUpIcon />}
                    label="Entrée"
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                ) : (
                  <Chip
                    icon={<TrendingDownIcon />}
                    label="Sortie"
                    size="small"
                    color="error"
                    variant="outlined"
                  />
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2">{t.categories?.name ?? '-'}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {t.designations?.name ?? t.designation_custom ?? '-'}
                </Typography>
                {t.note && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {t.note}
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">
                <Typography
                  variant="body2"
                  fontWeight={600}
                  color={t.type === 'entree' ? 'success.main' : 'error.main'}
                >
                  {t.type === 'sortie' ? '- ' : '+ '}
                  {formatAmount(t.amount)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography
                  variant="body2"
                  fontWeight={600}
                  color={balanceMap && (balanceMap[t.id] ?? 0) >= 0 ? 'primary.main' : 'warning.dark'}
                >
                  {balanceMap ? formatAmount(balanceMap[t.id] ?? 0) : '-'}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Tooltip title="Supprimer">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => setDeleteId(t.id)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={transactions.length}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={e => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 25, 50, 100]}
        labelRowsPerPage="Lignes par page"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} sur ${count}`}
        sx={{
          '& .MuiTablePagination-selectLabel': { mb: 0 },
          '& .MuiTablePagination-displayedRows': { mb: 0 },
        }}
      />
    <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer la transaction"
        message={
          deleteTarget ? (
            <>
              Supprimer cette transaction ?
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  {formatDate(deleteTarget.transaction_date)} — {deleteTarget.categories?.name ?? '-'}
                  {deleteTarget.designations?.name ? ` • ${deleteTarget.designations.name}` : ''}
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  color={deleteTarget.type === 'entree' ? 'success.main' : 'error.main'}
                >
                  {deleteTarget.type === 'entree' ? '+ ' : '- '}{formatAmount(deleteTarget.amount)}
                </Typography>
              </Box>
            </>
          ) : ''
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        confirmColor="error"
        loading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => !deleting && setDeleteId(null)}
      />
    </Box>
  );
}
