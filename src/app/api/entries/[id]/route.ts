import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = parseInt(id, 10);
    if (isNaN(entryId)) {
      return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, nickname, occasion, amount, receivedAmount, paidAmount, location, notes, crossed, transactions } = body;

    // If transactions array was passed, synchronize them
    if (Array.isArray(transactions)) {
      // Delete existing and re-insert
      await prisma.transaction.deleteMany({
        where: { entryId },
      });

      for (const t of transactions) {
        await prisma.transaction.create({
          data: {
            entryId,
            type: t.type,
            amount: Number(t.amount) || 0,
            title: t.title || 'حركة',
            occasion: t.occasion || null,
            notes: t.notes || null,
            date: t.date ? new Date(t.date) : new Date(),
          },
        });
      }
    }

    const updated = await prisma.entry.update({
      where: { id: entryId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(nickname !== undefined && { nickname: nickname?.trim() || null }),
        ...(occasion !== undefined && { occasion: occasion?.trim() || null }),
        ...(amount !== undefined && { amount: Number(amount) || 0 }),
        ...(receivedAmount !== undefined && { receivedAmount: Number(receivedAmount) || 0 }),
        ...(paidAmount !== undefined && { paidAmount: Number(paidAmount) || 0 }),
        ...(location !== undefined && { location: (location || '').trim() }),
        ...(notes !== undefined && { notes: (notes || '').trim() }),
        ...(crossed !== undefined && { crossed: !!crossed }),
      },
      include: { transactions: true },
    });

    const formatted = {
      id: updated.id,
      name: updated.name,
      nickname: updated.nickname || undefined,
      occasion: updated.occasion || undefined,
      amount: updated.amount,
      receivedAmount: updated.receivedAmount,
      paidAmount: updated.paidAmount,
      location: updated.location,
      notes: updated.notes,
      crossed: updated.crossed,
      transactions: updated.transactions.map((t) => ({
        id: t.id,
        date: t.date.toISOString(),
        type: t.type as 'received' | 'paid',
        amount: t.amount,
        title: t.title,
        occasion: t.occasion || undefined,
        notes: t.notes || undefined,
      })),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };

    return NextResponse.json({ success: true, entry: formatted });
  } catch (error) {
    console.error('API Error in PUT /api/entries/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to update entry' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = parseInt(id, 10);
    if (isNaN(entryId)) {
      return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 });
    }

    await prisma.entry.delete({
      where: { id: entryId },
    });

    return NextResponse.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    console.error('API Error in DELETE /api/entries/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete entry' }, { status: 500 });
  }
}
