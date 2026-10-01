import { NextResponse } from 'next/server';
import { getAllEntries, addEntry } from '@/lib/db';
import { matchesArabicSearch } from '@/lib/speechParser';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').trim();
    const status = searchParams.get('status') || 'all';

    let entries = getAllEntries();

    if (query) {
      entries = entries.filter(e =>
        matchesArabicSearch(`${e.name} ${e.location} ${e.notes}`, query)
      );
    }

    if (status === 'pending') {
      entries = entries.filter(e => !e.crossed);
    } else if (status === 'crossed') {
      entries = entries.filter(e => e.crossed);
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
    const { name, amount, location, notes, crossed } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    const newEntry = addEntry({
      name,
      amount: Number(amount) || 0,
      location: location || '',
      notes: notes || '',
      crossed: !!crossed,
    });

    return NextResponse.json({ success: true, entry: newEntry }, { status: 201 });
  } catch (error) {
    console.error('API Error in POST /api/entries:', error);
    return NextResponse.json({ success: false, error: 'Failed to create entry' }, { status: 500 });
  }
}
