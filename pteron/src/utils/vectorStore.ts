// IndexedDB wrapper for storing link embedding vectors.
// Vectors live locally and never touch chrome.storage.sync.

const DB_NAME = 'pteron-vectors';
const DB_VERSION = 1;
const STORE_NAME = 'vectors';

export interface StoredVector {
  keyword: string;
  embeddedText: string;
  vector: number[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'keyword' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveVector(entry: StoredVector): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getVector(keyword: string): Promise<StoredVector | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(keyword);
    req.onsuccess = () => resolve((req.result as StoredVector | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllVectors(): Promise<StoredVector[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as StoredVector[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteVector(keyword: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(keyword);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
