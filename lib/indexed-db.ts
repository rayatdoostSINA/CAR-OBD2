const DB_NAME = 'multigauge-obd';
const STORE = 'preferences';

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePreference<T>(key: string, value: T) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).put(value, key);
}

export async function loadPreference<T>(key: string, fallback: T): Promise<T> {
  try {
    const database = await openDatabase();
    return await new Promise<T>((resolve) => {
      const request = database.transaction(STORE).objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? fallback);
      request.onerror = () => resolve(fallback);
    });
  } catch { return fallback; }
}
