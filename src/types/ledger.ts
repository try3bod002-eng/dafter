export interface LedgerTransaction {
  id: string;
  date: string;
  type: 'received' | 'paid'; // 'received' = نقطة استلمناها منه في مناسبتنا, 'paid' = واجب رديناه له في مناسبته
  amount: number;
  title: string;
  notes?: string;
}

export interface LedgerEntry {
  id: number;
  name: string;
  nickname?: string; // اللقب أو الشهرة (مثل: أبو طارق، المعلم)
  amount: number; // المبلغ الأساسي المسجل
  receivedAmount?: number; // إجمالي المستلم منه
  paidAmount?: number; // إجمالي المدفوع له (رد الواجب)
  location: string;
  notes: string;
  crossed: boolean; // تم رده / مسدد بالكامل
  transactions?: LedgerTransaction[];
  createdAt: string;
  updatedAt: string;
}

export interface LedgerStats {
  totalCount: number;
  totalAmount: number; // إجمالي النقطة المستلمة (لينا)
  crossedCount: number; // مسدد / خالص
  activeCount: number; // نشط
  settlementsCount: number; // عدد الحسابات اللي فيها مديونية
  totalCrossedAmount: number;
  totalAlinaAmount: number; // إجمالي الواجب اللي في رقبتنا للناس
  totalLeinaAmount?: number; // إجمالي المتبقي لينا عند الناس
}

/**
 * دالة مساعدة لحساب الرصيد الصافي لأي شخص:
 * - status: 'alina' (واجب علينا) | 'leina' (باقي لينا) | 'khalis' (خالص تماماً)
 * - netAmount: القيمة الصافية
 */
export function calculateNetBalance(entry: LedgerEntry): {
  status: 'alina' | 'leina' | 'khalis';
  netAmount: number;
  label: string;
} {
  // إذا كان مشطوباً صراحة
  if (entry.crossed) {
    return { status: 'khalis', netAmount: 0, label: 'خالص (تم الرد)' };
  }

  // فحص الملاحظات لو فيها "كان عليه" و "علينا"
  const text = `${entry.location || ''} ${entry.notes || ''}`;
  const alinaMatch = text.match(/علينا\s*(\d+)/);
  const alinaVal = alinaMatch ? parseInt(alinaMatch[1], 10) : 0;

  const kanelehMatch = text.match(/كان\s+عليه\s*(\d+)/);
  const kanelehVal = kanelehMatch ? parseInt(kanelehMatch[1], 10) : 0;

  // الحركات المسجلة
  const received = entry.receivedAmount ?? entry.amount ?? 0;
  const paid = entry.paidAmount ?? 0;

  // لو في معاملات صريحة
  if (entry.transactions && entry.transactions.length > 0) {
    const totalRec = entry.transactions
      .filter((t) => t.type === 'received')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalPaid = entry.transactions
      .filter((t) => t.type === 'paid')
      .reduce((sum, t) => sum + t.amount, 0);

    const net = totalRec - totalPaid;
    if (net === 0) return { status: 'khalis', netAmount: 0, label: 'خالص' };
    if (net > 0) return { status: 'alina', netAmount: net, label: `واجب علينا: ${net} ج` };
    return { status: 'leina', netAmount: Math.abs(net), label: `باقي لينا: ${Math.abs(net)} ج` };
  }

  if (text.includes('خالص') && alinaVal === 0) {
    return { status: 'khalis', netAmount: 0, label: 'خالص' };
  }

  if (alinaVal > 0) {
    const effectiveAlina = Math.max(0, alinaVal - paid);
    if (effectiveAlina === 0) return { status: 'khalis', netAmount: 0, label: 'خالص (سُدّد)' };
    return { status: 'alina', netAmount: effectiveAlina, label: `واجب علينا: ${effectiveAlina} ج` };
  }

  // لو كان شخص دفع لنا نقطة ومافيش حساب قديم:
  // في العرف، أي نقطة مستلمة هي واجب مستقبلي علينا حتى يتم ردها!
  const remainingObligation = Math.max(0, received - paid);
  if (remainingObligation === 0) {
    return { status: 'khalis', netAmount: 0, label: 'خالص' };
  }

  return {
    status: 'alina',
    netAmount: remainingObligation,
    label: `واجب علينا: ${remainingObligation} ج`,
  };
}
