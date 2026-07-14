import AsyncStorage from '@react-native-async-storage/async-storage';
import { CollectionName } from '@/types';

const PREFIX = '@volako/';
const QUEUE_KEY = '@volako/sync_queue';

export async function loadCollection<T>(name: CollectionName): Promise<T[]> {
  const raw = await AsyncStorage.getItem(PREFIX + name);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export async function saveCollection<T>(name: CollectionName, items: T[]): Promise<void> {
  await AsyncStorage.setItem(PREFIX + name, JSON.stringify(items));
}

export async function upsertItem<T extends { id: string; _synced?: boolean }>(
  name: CollectionName,
  item: T,
): Promise<T[]> {
  const items = await loadCollection<T>(name);
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    items[idx] = item;
  } else {
    items.push(item);
  }
  await saveCollection(name, items);
  return items;
}

export async function deleteItem<T extends { id: string }>(
  name: CollectionName,
  id: string,
): Promise<T[]> {
  const items = await loadCollection<T>(name);
  const filtered = items.filter((i) => i.id !== id);
  await saveCollection(name, filtered);
  return filtered;
}

export interface SyncOperation {
  id: string;
  collection: CollectionName;
  type: 'create' | 'update' | 'delete';
  docId: string;
  data?: any;
  timestamp: number;
}

export async function enqueueSync(op: SyncOperation): Promise<void> {
  const queue = await getSyncQueue();
  queue.push(op);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getSyncQueue(): Promise<SyncOperation[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SyncOperation[];
  } catch {
    return [];
  }
}

export async function clearSyncQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function removeSyncOp(opId: string): Promise<void> {
  const queue = await getSyncQueue();
  const filtered = queue.filter((op) => op.id !== opId);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}

export async function clearAllData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const volakoKeys = keys.filter((k) => k.startsWith('@volako/'));
  await AsyncStorage.multiRemove(volakoKeys);
}
