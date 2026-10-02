import { getAllEntries, getStats } from '@/lib/db';
import LedgerClient from '@/components/LedgerClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const initialEntries = await getAllEntries();
  const initialStats = await getStats();

  return (
    <LedgerClient
      initialEntries={initialEntries}
      initialStats={initialStats}
    />
  );
}
