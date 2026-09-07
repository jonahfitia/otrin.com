import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { supabase } from '../supabase';
import type { Transaction } from '../supabase';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: () => void;
}

function formatAmount(n: number) {
  return new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function TransactionList({ transactions, onDelete }: TransactionListProps) {
  async function handleDelete(id: string) {
    await supabase.from('transactions').delete().eq('id', id);
    onDelete();
  }

  if (transactions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography color="text.secondary">Aucune transaction.</Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' } }}>
            <TableCell>Date</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Catégorie</TableCell>
            <TableCell>Désignation</TableCell>
            <TableCell align="right">Montant</TableCell>
            <TableCell align="center">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map(t => (
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
              <TableCell align="center">
                <Tooltip title="Supprimer">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(t.id)}
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
  );
}
