import fs from 'fs';
import path from 'path';
import { LedgerEntry, LedgerStats } from '@/types/ledger';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'daftr.json');

const INITIAL_PAGE_1_ENTRIES: Omit<LedgerEntry, 'createdAt' | 'updatedAt'>[] = [];

function ensureDbFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const now = new Date().toISOString();
    const seededData: LedgerEntry[] = INITIAL_PAGE_1_ENTRIES.map(item => ({
      ...item,
      createdAt: now,
      updatedAt: now,
    }));
    fs.writeFileSync(DB_FILE, JSON.stringify(seededData, null, 2), 'utf-8');
  }
}

export function getAllEntries(): LedgerEntry[] {
  ensureDbFile();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as LedgerEntry[];
  } catch (err) {
    console.error("Error reading database file:", err);
    return [];
  }
}

export function saveAllEntries(entries: LedgerEntry[]): boolean {
  ensureDbFile();
  try {
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(entries, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
    return true;
  } catch (err) {
    console.error("Error writing to database:", err);
    return false;
  }
}

export function addEntry(data: { name: string; amount: number; location?: string; notes?: string; crossed?: boolean }): LedgerEntry {
  const entries = getAllEntries();
  const maxId = entries.reduce((max, e) => (e.id > max ? e.id : max), 0);
  const now = new Date().toISOString();

  const newEntry: LedgerEntry = {
    id: maxId + 1,
    name: data.name.trim(),
    amount: Number(data.amount) || 0,
    location: (data.location || '').trim(),
    notes: (data.notes || '').trim(),
    crossed: !!data.crossed,
    createdAt: now,
    updatedAt: now,
  };

  entries.unshift(newEntry);
  saveAllEntries(entries);
  return newEntry;
}

export function updateEntry(id: number, data: Partial<Omit<LedgerEntry, 'id' | 'createdAt'>>): LedgerEntry | null {
  const entries = getAllEntries();
  const index = entries.findIndex(e => e.id === id);
  if (index === -1) return null;

  const existing = entries[index];
  const updated: LedgerEntry = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  entries[index] = updated;
  saveAllEntries(entries);
  return updated;
}

export function deleteEntry(id: number): boolean {
  const entries = getAllEntries();
  const filtered = entries.filter(e => e.id !== id);
  if (filtered.length === entries.length) return false;

  saveAllEntries(filtered);
  return true;
}

export function getStats(): LedgerStats {
  const entries = getAllEntries();
  const totalCount = entries.length;
  const totalAmount = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const crossedCount = entries.filter(e => e.crossed).length;
  const activeCount = totalCount - crossedCount;
  const settlementsCount = entries.filter(e => 
    e.notes.includes('كان عليه') || e.notes.includes('علينا') || e.location.includes('كان عليه') || e.location.includes('علينا')
  ).length;

  return {
    totalCount,
    totalAmount,
    crossedCount,
    activeCount,
    settlementsCount,
  };
}
