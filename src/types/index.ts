export type TransactionType = 'income' | 'expense';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: string;
  color: string;
  icon: string;
  balance: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  _synced?: boolean;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  is_default: boolean;
  created_at: string;
  _synced?: boolean;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  date: string;
  label: string;
  type: TransactionType;
  amount: number;
  balance_after: number | null;
  notes: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
  _synced?: boolean;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  month: number;
  year: number;
  amount: number;
  created_at: string;
  updated_at: string;
  _synced?: boolean;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  color: string;
  icon: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  _synced?: boolean;
}

export interface GoalContribution {
  id: string;
  user_id: string;
  goal_id: string;
  amount: number;
  date: string;
  notes: string | null;
  created_at: string;
  _synced?: boolean;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  label: string;
  type: TransactionType;
  amount: number | null;
  amount_percent: number | null;
  frequency: Frequency;
  day_of_month: number | null;
  next_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  _synced?: boolean;
}

export interface Simulation {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  start_balance: number;
  created_at: string;
  updated_at: string;
  _synced?: boolean;
}

export interface SimulationItem {
  id: string;
  user_id: string;
  simulation_id: string;
  date: string;
  label: string;
  type: TransactionType;
  amount: number;
  notes: string | null;
  created_at: string;
  _synced?: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  _synced?: boolean;
}

export interface Settings {
  id: string;
  user_id: string;
  currency: string;
  currency_name: string;
  theme: string;
  created_at: string;
  updated_at: string;
  _synced?: boolean;
}

export const CURRENCIES = [
  { code: 'Ar', name: 'Ariary', symbol: 'Ar' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'Dollar', symbol: '$' },
  { code: 'FCFA', name: 'Franc CFA', symbol: 'FCFA' },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salaire', icon: 'briefcase', color: '#10b981' },
  { name: 'Prime', icon: 'star', color: '#f59e0b' },
  { name: 'Vente', icon: 'shopping-bag', color: '#3b82f6' },
  { name: 'Freelance', icon: 'laptop', color: '#8b5cf6' },
  { name: 'Cadeau', icon: 'gift', color: '#ec4899' },
  { name: 'Autres', icon: 'plus-circle', color: '#6b7280' },
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Nourriture', icon: 'utensils', color: '#ef4444' },
  { name: 'Transport', icon: 'car', color: '#f97316' },
  { name: 'Logement', icon: 'home', color: '#84cc16' },
  { name: 'Internet', icon: 'wifi', color: '#06b6d4' },
  { name: 'Eau', icon: 'droplets', color: '#3b82f6' },
  { name: 'Électricité', icon: 'zap', color: '#f59e0b' },
  { name: 'Santé', icon: 'heart-pulse', color: '#f43f5e' },
  { name: 'Église', icon: 'church', color: '#7c3aed' },
  { name: 'Famille', icon: 'users', color: '#10b981' },
  { name: 'Éducation', icon: 'graduation-cap', color: '#0ea5e9' },
  { name: 'Loisirs', icon: 'gamepad-2', color: '#a855f7' },
  { name: 'Voyage', icon: 'plane', color: '#14b8a6' },
  { name: 'Investissement', icon: 'trending-up', color: '#22c55e' },
  { name: 'Épargne', icon: 'piggy-bank', color: '#10b981' },
  { name: 'Divers', icon: 'more-horizontal', color: '#6b7280' },
];

export type CollectionName =
  | 'accounts'
  | 'categories'
  | 'transactions'
  | 'budgets'
  | 'goals'
  | 'goal_contributions'
  | 'recurring_transactions'
  | 'simulations'
  | 'simulation_items'
  | 'notifications'
  | 'settings';
