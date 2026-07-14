import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  loadCollection,
  saveCollection,
  upsertItem,
  deleteItem,
  enqueueSync,
  getSyncQueue,
  removeSyncOp,
  clearSyncQueue,
  SyncOperation,
} from './storage';
import { CollectionName } from '@/types';
import { generateId } from './formatters';

function userCollectionPath(userId: string, name: CollectionName): string {
  return `users/${userId}/${name}`;
}

/**
 * Pull all documents for a collection from Firestore and merge into local storage.
 * Firestore is the source of truth for synced documents.
 */
export async function pullCollection<T extends { id: string; _synced?: boolean }>(
  userId: string,
  name: CollectionName,
): Promise<T[]> {
  const colRef = collection(db, userCollectionPath(userId, name));
  const snapshot = await getDocs(colRef);
  const remoteItems: T[] = [];
  snapshot.forEach((d) => {
    remoteItems.push({ ...(d.data() as any), id: d.id, _synced: true });
  });

  const localItems = await loadCollection<T>(name);
  const localById = new Map(localItems.map((i) => [i.id, i]));
  const remoteIds = new Set(remoteItems.map((i) => i.id));

  // Keep local unsynced items that aren't on the server yet
  const merged: T[] = [...remoteItems];
  for (const [id, item] of localById) {
    if (!remoteIds.has(id) && !item._synced) {
      merged.push(item);
    }
  }

  await saveCollection(name, merged);
  return merged;
}

/**
 * Push a single create/update to Firestore (or queue if offline).
 */
async function pushItem(
  userId: string,
  name: CollectionName,
  item: any,
  isCreate: boolean,
): Promise<void> {
  const docRef = doc(db, userCollectionPath(userId, name), item.id);
  const payload = { ...item };
  delete payload._synced;
  await setDoc(docRef, payload, { merge: !isCreate });
}

async function pushDelete(userId: string, name: CollectionName, docId: string): Promise<void> {
  const docRef = doc(db, userCollectionPath(userId, name), docId);
  await deleteDoc(docRef);
}

/**
 * Create or update an item locally, then sync to Firestore.
 * If Firestore is unreachable, the operation is queued for later.
 */
export async function syncUpsert<T extends { id: string; user_id: string; _synced?: boolean }>(
  userId: string,
  name: CollectionName,
  item: T,
  isCreate: boolean,
): Promise<T> {
  const localItem = { ...item, _synced: false };
  await upsertItem(name, localItem);

  try {
    await pushItem(userId, name, localItem, isCreate);
    const syncedItem = { ...item, _synced: true };
    await upsertItem(name, syncedItem);
    return syncedItem;
  } catch (err) {
    await enqueueSync({
      id: generateId(),
      collection: name,
      type: isCreate ? 'create' : 'update',
      docId: item.id,
      data: { ...item, _synced: false },
      timestamp: Date.now(),
    });
    return localItem;
  }
}

/**
 * Delete an item locally, then sync the deletion to Firestore.
 */
export async function syncDelete(
  userId: string,
  name: CollectionName,
  docId: string,
): Promise<void> {
  await deleteItem<{ id: string }>(name, docId);

  try {
    await pushDelete(userId, name, docId);
  } catch (err) {
    await enqueueSync({
      id: generateId(),
      collection: name,
      type: 'delete',
      docId,
      timestamp: Date.now(),
    });
  }
}

/**
 * Process the pending sync queue — called when connectivity is restored.
 */
export async function flushSyncQueue(userId: string): Promise<void> {
  const queue = await getSyncQueue();
  if (queue.length === 0) return;

  const remaining: SyncOperation[] = [];

  for (const op of queue) {
    try {
      if (op.type === 'delete') {
        await pushDelete(userId, op.collection, op.docId);
      } else {
        await pushItem(userId, op.collection, op.data, op.type === 'create');
      }
      await removeSyncOp(op.id);
    } catch (err) {
      remaining.push(op);
    }
  }

  if (remaining.length === 0) {
    await clearSyncQueue();
  }
}

/**
 * Pull all collections for the current user.
 */
export async function pullAllData(userId: string): Promise<void> {
  const collections: CollectionName[] = [
    'accounts',
    'categories',
    'transactions',
    'budgets',
    'goals',
    'goal_contributions',
    'recurring_transactions',
    'simulations',
    'simulation_items',
    'notifications',
    'settings',
  ];

  await Promise.all(collections.map((c) => pullCollection(userId, c)));
  await flushSyncQueue(userId);
}
