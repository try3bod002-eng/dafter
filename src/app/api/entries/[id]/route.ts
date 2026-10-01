import { NextResponse } from 'next/server';
import { updateEntry, deleteEntry } from '@/lib/db';

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
    const updated = updateEntry(entryId, body);

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, entry: updated });
  } catch (error) {
    console.error('API Error in PUT /api/entries/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to update entry' }, { status: 500 });
  }
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

    const deleted = deleteEntry(entryId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    console.error('API Error in DELETE /api/entries/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete entry' }, { status: 500 });
  }
}
