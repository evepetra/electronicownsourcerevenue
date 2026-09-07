/**
 * Offline capture queue.
 *
 * Collectors in the field can capture a payment while the network is down.
 * Entries are stored in IndexedDB and replayed against the backend as soon as
 * the browser reports it is back online.
 */
import { useEffect, useState } from "react";

const DB_NAME = "eosr-offline";
const STORE = "pending-payments";
const VERSION = 1;

export type QueuedPayment = {
  id: string;
  invoiceNo: string;
  councilCode: string;
  channel: string;
  amount: number;
  payerRef: string;
  cashierName: string | null;
  phone: string | null;
  capturedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = fn(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function queuePayment(entry: Omit<QueuedPayment, "id" | "capturedAt">) {
  const record: QueuedPayment = {
    ...entry,
    id: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
  };
  await tx("readwrite", (s) => s.put(record));
  window.dispatchEvent(new CustomEvent("eosr:queue-changed"));
  return record;
}

export async function listQueued(): Promise<QueuedPayment[]> {
  if (typeof indexedDB === "undefined") return [];
  const rows = await tx<QueuedPayment[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedPayment[]>);
  return rows.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

export async function removeQueued(id: string) {
  await tx("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
  window.dispatchEvent(new CustomEvent("eosr:queue-changed"));
}

/** Live online/offline state, safe during server rendering. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/** Number of captures waiting to sync. */
export function useQueuedPayments() {
  const [items, setItems] = useState<QueuedPayment[]>([]);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void listQueued().then((rows) => {
        if (alive) setItems(rows);
      });
    };
    refresh();
    window.addEventListener("eosr:queue-changed", refresh);
    window.addEventListener("online", refresh);
    return () => {
      alive = false;
      window.removeEventListener("eosr:queue-changed", refresh);
      window.removeEventListener("online", refresh);
    };
  }, []);
  return items;
}
