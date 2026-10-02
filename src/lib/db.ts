import { prisma } from '@/lib/prisma';
import { LedgerEntry, LedgerStats, calculateNetBalance } from '@/types/ledger';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'daftr.json');

export async function getAllEntries(): Promise<LedgerEntry[]> {
  try {
    const entries = await prisma.entry.findMany({
      include: { transactions: true },
      orderBy: { id: 'desc' },
    });

    return entries.map((e) => ({
      id: e.id,
      name: e.name,
      nickname: e.nickname || undefined,
      occasion: e.occasion || undefined,
      amount: e.amount,
      receivedAmount: e.receivedAmount,
      paidAmount: e.paidAmount,
      location: e.location,
      notes: e.notes,
      crossed: e.crossed,
      transactions: e.transactions.map((t) => ({
        id: t.id,
        date: t.date.toISOString(),
        type: t.type as 'received' | 'paid',
        amount: t.amount,
        title: t.title,
        occasion: t.occasion || undefined,
        notes: t.notes || undefined,
      })),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));
  } catch (err) {
    console.error('Error fetching from SQLite, falling back to daftr.json:', err);
    if (fs.existsSync(DB_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      } catch {}
    }
    return [];
  }
}

export async function getStats(): Promise<LedgerStats> {
  const entries = await getAllEntries();
  const totalCount = entries.length;
  const totalAmount = entries.reduce(
    (sum, e) => sum + (Number(e.receivedAmount ?? e.amount) || 0),
    0
  );

  let crossedCount = 0;
  let totalCrossedAmount = 0;
  let totalPaidAmount = 0;
  let totalAlinaAmount = 0;
  let totalLeinaAmount = 0;
  let settlementsCount = 0;

  entries.forEach((e) => {
    let paid = Number(e.paidAmount) || 0;
    if (e.transactions && e.transactions.length > 0) {
      paid = e.transactions
        .filter((t) => t.type === 'paid')
        .reduce((sum, t) => sum + t.amount, 0);
    }
    totalPaidAmount += paid;

    const net = calculateNetBalance(e);
    if (net.status === 'khalis' || e.crossed) {
      crossedCount++;
      totalCrossedAmount += (Number(e.paidAmount ?? e.amount) || 0);
    } else if (net.status === 'alina') {
      settlementsCount++;
      totalAlinaAmount += net.netAmount;
    } else if (net.status === 'leina') {
      totalLeinaAmount += net.netAmount;
    }
  });

  const activeCount = totalCount - crossedCount;

  return {
    totalCount,
    totalAmount,
    totalPaidAmount,
    crossedCount,
    activeCount,
    settlementsCount,
    totalCrossedAmount,
    totalAlinaAmount,
    totalLeinaAmount,
  };
}
