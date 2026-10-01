import { getAllEntries, getStats } from '@/lib/db';
import LedgerClient from '@/components/LedgerClient';

export default function Home() {
  const initialEntries = getAllEntries();
  const initialStats = getStats();

  return (
    <LedgerClient
      initialEntries={initialEntries}
      initialStats={initialStats}
    />
  );
}
