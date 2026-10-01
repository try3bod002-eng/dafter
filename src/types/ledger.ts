export interface LedgerEntry {
  id: number;
  name: string;
  amount: number;
  location: string;
  notes: string;
  crossed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerStats {
  totalCount: number;
  totalAmount: number;
  crossedCount: number;
  activeCount: number;
  settlementsCount: number;
  totalCrossedAmount: number;
  totalAlinaAmount: number;
}
