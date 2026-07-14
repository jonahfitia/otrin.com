import { loadCollection } from './storage';
import { syncUpsert, syncDelete, pullCollection } from './sync';
import { generateId } from './formatters';
import {
  Account,
  Category,
  Transaction,
  Budget,
  Goal,
  GoalContribution,
  RecurringTransaction,
  Simulation,
  SimulationItem,
  Notification,
  Settings,
  CollectionName,
} from '@/types';

export class Repository<T extends { id: string; user_id: string; _synced?: boolean }> {
  constructor(
    private userId: string,
    private name: CollectionName,
  ) {}

  async getAll(): Promise<T[]> {
    return loadCollection<T>(this.name);
  }

  async create(data: Omit<T, 'id' | 'user_id' | '_synced'> & Partial<Pick<T, 'id'>>): Promise<T> {
    const item = {
      ...data,
      id: data.id || generateId(),
      user_id: this.userId,
      _synced: false,
    } as T;
    return syncUpsert(this.userId, this.name, item, true);
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const items = await this.getAll();
    const existing = items.find((i) => i.id === id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, _synced: false } as T;
    return syncUpsert(this.userId, this.name, updated, false);
  }

  async delete(id: string): Promise<void> {
    return syncDelete(this.userId, this.name, id);
  }

  async pull(): Promise<T[]> {
    return pullCollection<T>(this.userId, this.name);
  }
}

export function accountsRepo(userId: string) {
  return new Repository<Account>(userId, 'accounts');
}
export function categoriesRepo(userId: string) {
  return new Repository<Category>(userId, 'categories');
}
export function transactionsRepo(userId: string) {
  return new Repository<Transaction>(userId, 'transactions');
}
export function budgetsRepo(userId: string) {
  return new Repository<Budget>(userId, 'budgets');
}
export function goalsRepo(userId: string) {
  return new Repository<Goal>(userId, 'goals');
}
export function goalContributionsRepo(userId: string) {
  return new Repository<GoalContribution>(userId, 'goal_contributions');
}
export function recurringRepo(userId: string) {
  return new Repository<RecurringTransaction>(userId, 'recurring_transactions');
}
export function simulationsRepo(userId: string) {
  return new Repository<Simulation>(userId, 'simulations');
}
export function simulationItemsRepo(userId: string) {
  return new Repository<SimulationItem>(userId, 'simulation_items');
}
export function notificationsRepo(userId: string) {
  return new Repository<Notification>(userId, 'notifications');
}
export function settingsRepo(userId: string) {
  return new Repository<Settings>(userId, 'settings');
}
