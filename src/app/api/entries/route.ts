import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { matchesArabicSearch } from '@/lib/speechParser';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').trim();
    const status = searchParams.get('status') || 'all';

    const dbEntries = await prisma.entry.findMany({
      include: { transactions: true },
      orderBy: { id: 'desc' },
    });

    let entries = dbEntries.map((e) => ({
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

    if (query) {
      entries = entries.filter((e) =>
        matchesArabicSearch(
          `${e.name} ${e.nickname || ''} ${e.location} ${e.notes} ${e.occasion || ''}`,
          query
        )
      );
    }

    if (status === 'pending') {
      entries = entries.filter((e) => !e.crossed);
    } else if (status === 'crossed') {
      entries = entries.filter((e) => e.crossed);
    }

    return NextResponse.json({ success: true, entries });
  } catch (error) {
    console.error('API Error in GET /api/entries:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch entries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, nickname, occasion, amount, receivedAmount, paidAmount, location, notes, crossed } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    const created = await prisma.entry.create({
      data: {
        name: name.trim(),
        nickname: nickname?.trim() || null,
        occasion: occasion?.trim() || null,
        amount: Number(amount) || 0,
        receivedAmount: Number(receivedAmount ?? amount) || 0,
        paidAmount: Number(paidAmount) || 0,
        location: (location || '').trim(),
        notes: (notes || '').trim(),
        crossed: !!crossed,
      },
      include: { transactions: true },
    });

    const newEntry = {
      id: created.id,
      name: created.name,
      nickname: created.nickname || undefined,
      occasion: created.occasion || undefined,
      amount: created.amount,
      receivedAmount: created.receivedAmount,
      paidAmount: created.paidAmount,
      location: created.location,
      notes: created.notes,
      crossed: created.crossed,
      transactions: [],
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };

    return NextResponse.json({ success: true, entry: newEntry }, { status: 201 });
  } catch (error) {
    console.error('API Error in POST /api/entries:', error);
    return NextResponse.json({ success: false, error: 'Failed to create entry' }, { status: 500 });
  }
}
