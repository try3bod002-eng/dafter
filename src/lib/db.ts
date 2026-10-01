import fs from 'fs';
import path from 'path';
import { LedgerEntry, LedgerStats } from '@/types/ledger';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'daftr.json');

const INITIAL_PAGE_1_ENTRIES: Omit<LedgerEntry, 'createdAt' | 'updatedAt'>[] = [
  { id: 1, name: "اشرف الحديدى سيكردفون", amount: 800, location: "كان عليه 300", notes: "علينا 500", crossed: false },
  { id: 2, name: "كمال السيد ابو حسنين", amount: 200, location: "خالص", notes: "", crossed: false },
  { id: 3, name: "اكرم بطيل", amount: 200, location: "إيجلات x خالص", notes: "خالص", crossed: true },
  { id: 4, name: "عبد الباسط فتحى بهنسى [بع]", amount: 200, location: "", notes: "", crossed: false },
  { id: 5, name: "جلال سلام ابو سليمان", amount: 200, location: "خالص", notes: "", crossed: false },
  { id: 6, name: "على صالح ابوحسنين", amount: 500, location: "", notes: "", crossed: false },
  { id: 7, name: "محمود طاهر ابو شائع", amount: 200, location: "", notes: "", crossed: false },
  { id: 8, name: "شادى مع سينة", amount: 400, location: "كان عليه 300", notes: "علينا 100", crossed: false },
  { id: 9, name: "سباع بدوى شائع", amount: 400, location: "كان عليه 200", notes: "علينا 200", crossed: false },
  { id: 10, name: "كمال ابو اسماعيل", amount: 200, location: "خالص", notes: "", crossed: false },
  { id: 11, name: "احمد على رجب رزق", amount: 200, location: "", notes: "", crossed: false },
  { id: 12, name: "حاج محمد العوضى [شبرا]", amount: 150, location: "خالص", notes: "", crossed: true },
  { id: 13, name: "محمد خطاب خليل", amount: 100, location: "ج.ع / خطاب", notes: "", crossed: false },
  { id: 14, name: "محمود السيد بدوى خليل", amount: 200, location: "خالص", notes: "عليه 100", crossed: true },
  { id: 15, name: "وائل السيد شبانه", amount: 200, location: "", notes: "", crossed: false },
  { id: 16, name: "مصطفى الباز حمد [البنا]", amount: 200, location: "", notes: "", crossed: false },
  { id: 17, name: "محمد احمد شربين", amount: 1000, location: "كان عليه 400", notes: "علينا 600 (مدون قبله 12)", crossed: false },
  { id: 18, name: "عاطف جمال الدسوقى", amount: 200, location: "خالص من ولادة", notes: "", crossed: true },
  { id: 19, name: "جمال محمد الدسوقى ابولطيف", amount: 400, location: "خالص", notes: "", crossed: true },
  { id: 20, name: "فارس أبو طالب", amount: 200, location: "خالص", notes: "", crossed: true },
  { id: 21, name: "محمد محمود السيد خطاب", amount: 100, location: "أبو قرعة", notes: "", crossed: false },
  { id: 22, name: "السيد ابراهيم شربين", amount: 200, location: "", notes: "", crossed: false },
  { id: 23, name: "حاتم المتولى خليل", amount: 200, location: "خالص", notes: "", crossed: true },
  { id: 24, name: "محمد المتولى السيد عمر", amount: 150, location: "", notes: "", crossed: false },
  { id: 25, name: "عادل المتولى صباغ", amount: 200, location: "صيدناوى", notes: "خالص", crossed: true },
  { id: 26, name: "الاسطى ممدوح العوضى", amount: 150, location: "", notes: "", crossed: false },
  { id: 27, name: "البهيج محمد أحمد منصور", amount: 100, location: "", notes: "", crossed: false }
];

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
