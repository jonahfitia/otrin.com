import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { loansRepo, loanRepaymentsRepo } from '@/lib/repository';
import { formatCurrency, formatDate, generateId } from '@/lib/formatters';
import { Loan, LoanRepayment } from '@/types';
import { Card, LoadingSpinner, EmptyState, Modal, Input, Button, Badge } from '@/components/ui';
import { colors } from '@/components/theme';
import { Ionicons } from '@expo/vector-icons';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: colors.amber },
  partially_repaid: { label: 'Remboursement partiel', color: colors.blue },
  repaid: { label: 'Remboursé', color: colors.green },
  cancelled: { label: 'Annulé', color: colors.gray },
};

export default function LoansScreen() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<LoanRepayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<Loan | null>(null);
  const [showRepay, setShowRepay] = useState(false);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);

  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState('');
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split('T')[0]);
  const [repayDate, setRepayDate] = useState('');
  const [notes, setNotes] = useState('');

  const [repayAmount, setRepayAmount] = useState('');
  const [repayDateVal, setRepayDateVal] = useState(new Date().toISOString().split('T')[0]);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [loansData, repaymentsData] = await Promise.all([
      loansRepo(user.uid).getAll(),
      loanRepaymentsRepo(user.uid).getAll(),
    ]);
    setLoans(loansData.sort((a, b) => b.date.localeCompare(a.date)));
    setRepayments(repaymentsData);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const resetForm = () => {
    setPersonName('');
    setAmount('');
    setLoanDate(new Date().toISOString().split('T')[0]);
    setRepayDate('');
    setNotes('');
    setEditLoan(null);
  };

  const handleSave = async () => {
    if (!user || !personName || !amount || !loanDate) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;
    await loansRepo(user.uid).create({
      person_name: personName,
      amount: numAmount,
      remaining_amount: numAmount,
      date: loanDate,
      expected_repayment_date: repayDate || loanDate,
      status: 'pending',
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    resetForm();
    setShowForm(false);
    await loadData();
  };

  const handleRepay = async () => {
    if (!user || !showDetail || !repayAmount) return;
    const numAmount = parseFloat(repayAmount);
    if (isNaN(numAmount) || numAmount <= 0) return;
    const newRemaining = showDetail.remaining_amount - numAmount;
    const newStatus = newRemaining <= 0 ? 'repaid' : 'partially_repaid';

    await loanRepaymentsRepo(user.uid).create({
      loan_id: showDetail.id,
      amount: numAmount,
      date: repayDateVal,
      notes: null,
      created_at: new Date().toISOString(),
    });

    await loansRepo(user.uid).update(showDetail.id, {
      remaining_amount: Math.max(0, newRemaining),
      status: newStatus,
      updated_at: new Date().toISOString(),
    });

    setRepayAmount('');
    setRepayDateVal(new Date().toISOString().split('T')[0]);
    setShowRepay(false);
    await loadData();
    const updated = (await loansRepo(user.uid).getAll()).find((l) => l.id === showDetail.id) || null;
    setShowDetail(updated);
  };

  const handleDelete = (loan: Loan) => {
    if (!user) return;
    Alert.alert('Supprimer', `Retirer le prêt à ${loan.person_name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const relatedRepayments = repayments.filter((r) => r.loan_id === loan.id);
          for (const r of relatedRepayments) {
            await loanRepaymentsRepo(user.uid).delete(r.id);
          }
          await loansRepo(user.uid).delete(loan.id);
          setShowDetail(null);
          await loadData();
        },
      },
    ]);
  };

  const totalOutstanding = loans
    .filter((l) => l.status !== 'repaid' && l.status !== 'cancelled')
    .reduce((s, l) => s + l.remaining_amount, 0);

  const totalLent = loans.reduce((s, l) => s + l.amount, 0);
  const totalRecovered = loans
    .filter((l) => l.status !== 'cancelled')
    .reduce((s, l) => s + (l.amount - l.remaining_amount), 0);

  const isOverdue = (loan: Loan) => {
    if (loan.status === 'repaid' || loan.status === 'cancelled') return false;
    return new Date(loan.expected_repayment_date) < new Date();
  };

  if (loading) return <LoadingSpinner />;

  const detailRepayments = repayments.filter((r) => r.loan_id === showDetail?.id);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Prêts & Créances</Text>

        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Résumé</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total prêté</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totalLent, currency)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Remboursé</Text>
            <Text style={[styles.summaryValue, { color: colors.green }]}>{formatCurrency(totalRecovered, currency)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelBold}>Restant dû</Text>
            <Text style={[styles.summaryValueBold, { color: colors.red }]}>{formatCurrency(totalOutstanding, currency)}</Text>
          </View>
        </Card>

        {loans.length === 0 ? (
          <EmptyState message="Aucun prêt enregistré" />
        ) : (
          loans.map((loan) => {
            const statusCfg = STATUS_CONFIG[loan.status] || STATUS_CONFIG.pending;
            const overdue = isOverdue(loan);
            return (
              <TouchableOpacity key={loan.id} onPress={() => setShowDetail(loan)} onLongPress={() => handleDelete(loan)}>
                <Card style={styles.loanCard}>
                  <View style={styles.loanHeader}>
                    <View style={styles.loanPerson}>
                      <View style={[styles.avatar, { backgroundColor: overdue ? colors.red + '20' : colors.primary + '20' }]}>
                        <Ionicons name="person" size={18} color={overdue ? colors.red : colors.primary} />
                      </View>
                      <View style={styles.loanPersonInfo}>
                        <Text style={styles.loanName}>{loan.person_name}</Text>
                        <Text style={styles.loanDate}>{formatDate(loan.date)}</Text>
                      </View>
                    </View>
                    <View style={styles.loanStatusRow}>
                      {overdue && <Badge label="En retard" color={colors.red} />}
                      <Badge label={statusCfg.label} color={statusCfg.color} />
                    </View>
                  </View>
                  <View style={styles.loanAmounts}>
                    <View>
                      <Text style={styles.loanAmountLabel}>Montant</Text>
                      <Text style={styles.loanAmount}>{formatCurrency(loan.amount, currency)}</Text>
                    </View>
                    <View style={styles.loanAmountRight}>
                      <Text style={styles.loanAmountLabel}>Restant</Text>
                      <Text style={[styles.loanAmount, { color: loan.remaining_amount > 0 ? colors.red : colors.green }]}>
                        {formatCurrency(loan.remaining_amount, currency)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.loanFooter}>
                    <Ionicons name="calendar" size={14} color={colors.textMuted} />
                    <Text style={styles.loanFooterText}>
                      Remb. prévu : {formatDate(loan.expected_repayment_date)}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => { resetForm(); setShowForm(true); }}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showForm} onClose={() => setShowForm(false)} title="Nouveau prêt">
        <Input label="Nom du bénéficiaire" value={personName} onChangeText={setPersonName} placeholder="Qui emprunte ?" />
        <Input label="Montant" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" />
        <Input label="Date du prêt" value={loanDate} onChangeText={setLoanDate} placeholder="YYYY-MM-DD" />
        <Input label="Date de remboursement prévue" value={repayDate} onChangeText={setRepayDate} placeholder="YYYY-MM-DD" />
        <Input label="Notes" value={notes} onChangeText={setNotes} placeholder="Optionnel" multiline />
        <Button title="Enregistrer" onPress={handleSave} style={{ marginTop: 12 }} />
      </Modal>

      <Modal visible={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail?.person_name || 'Détail'}>
        {showDetail && (
          <View>
            <View style={styles.detailSection}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Montant</Text>
                <Text style={styles.detailValue}>{formatCurrency(showDetail.amount, currency)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Restant</Text>
                <Text style={[styles.detailValue, { color: showDetail.remaining_amount > 0 ? colors.red : colors.green }]}>
                  {formatCurrency(showDetail.remaining_amount, currency)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date du prêt</Text>
                <Text style={styles.detailValue}>{formatDate(showDetail.date)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Remb. prévu</Text>
                <Text style={styles.detailValue}>{formatDate(showDetail.expected_repayment_date)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Statut</Text>
                <Badge label={STATUS_CONFIG[showDetail.status]?.label || showDetail.status} color={STATUS_CONFIG[showDetail.status]?.color || colors.gray} />
              </View>
              {showDetail.notes && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailValue}>{showDetail.notes}</Text>
                </View>
              )}
            </View>

            {detailRepayments.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Remboursements</Text>
                {detailRepayments.map((r) => (
                  <View key={r.id} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{formatDate(r.date)}</Text>
                    <Text style={[styles.detailValue, { color: colors.green }]}>+{formatCurrency(r.amount, currency)}</Text>
                  </View>
                ))}
              </View>
            )}

            {showDetail.status !== 'repaid' && showDetail.status !== 'cancelled' && (
              <Button title="Enregistrer un remboursement" onPress={() => { setRepayAmount(''); setShowRepay(true); }} variant="outline" style={{ marginTop: 12 }} />
            )}
            <Button title="Supprimer" onPress={() => handleDelete(showDetail)} variant="destructive" size="sm" style={{ marginTop: 8 }} />
          </View>
        )}
      </Modal>

      <Modal visible={showRepay} onClose={() => setShowRepay(false)} title="Nouveau remboursement">
        <Input label="Montant remboursé" value={repayAmount} onChangeText={setRepayAmount} keyboardType="numeric" placeholder="0" />
        <Input label="Date" value={repayDateVal} onChangeText={setRepayDateVal} placeholder="YYYY-MM-DD" />
        <Button title="Valider le remboursement" onPress={handleRepay} style={{ marginTop: 12 }} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 16, marginTop: 8 },
  summaryCard: { marginBottom: 16 },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 14, color: colors.textMuted },
  summaryValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  summaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  summaryLabelBold: { fontSize: 14, fontWeight: '700', color: colors.text },
  summaryValueBold: { fontSize: 16, fontWeight: '800' },
  loanCard: { marginBottom: 12 },
  loanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  loanPerson: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  loanPersonInfo: { flex: 1 },
  loanName: { fontSize: 15, fontWeight: '600', color: colors.text },
  loanDate: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  loanStatusRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  loanAmounts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  loanAmountLabel: { fontSize: 12, color: colors.textMuted },
  loanAmount: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 },
  loanAmountRight: { alignItems: 'flex-end' },
  loanFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  loanFooterText: { fontSize: 12, color: colors.textMuted },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  detailSection: { marginBottom: 16 },
  detailSectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  detailLabel: { fontSize: 14, color: colors.textMuted, flex: 1 },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.text },
});
