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
  // 1. لو في معاملات مسجلة صريحة، نعتمد على الحساب الرياضي الدقيق أولاً
  if (entry.transactions && entry.transactions.length > 0) {
    const totalRec = entry.transactions
      .filter((t) => t.type === 'received')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalPaid = entry.transactions
      .filter((t) => t.type === 'paid')
      .reduce((sum, t) => sum + t.amount, 0);

    const diff = totalRec - totalPaid;
    if (diff === 0) {
      return { status: 'khalis', netAmount: 0, label: 'خالص ✓' };
    }
    if (diff > 0) {
      // استلمنا منه أكتر مما دفعنا له = له في ذمتنا
      return { status: 'alina', netAmount: diff, label: `واجب علينا: ${diff} ج` };
    }
    // دفعنا له أكتر مما استلمنا منه = هو اللي عليه فلوس لينا!
    const remainingForUs = Math.abs(diff);
    return { status: 'leina', netAmount: remainingForUs, label: `باقي لينا: ${remainingForUs} ج` };
  }

  // 2. إذا كان مشطوباً يدوياً بدون حركات متضاربة
  if (entry.crossed) {
    return { status: 'khalis', netAmount: 0, label: 'خالص (مشطوب)' };
  }

  // 3. فحص الملاحظات لو فيها "كان عليه" و "علينا"
  const text = `${entry.location || ''} ${entry.notes || ''}`;
  const alinaMatch = text.match(/علينا\s*(\d+)/);
  const alinaVal = alinaMatch ? parseInt(alinaMatch[1], 10) : 0;

  const received = entry.receivedAmount ?? entry.amount ?? 0;
  const paid = entry.paidAmount ?? 0;

  if (text.includes('خالص') && alinaVal === 0) {
    return { status: 'khalis', netAmount: 0, label: 'خالص ✓' };
  }

  if (alinaVal > 0) {
    const effectiveAlina = alinaVal - paid;
    if (effectiveAlina === 0) return { status: 'khalis', netAmount: 0, label: 'خالص ✓' };
    if (effectiveAlina > 0) return { status: 'alina', netAmount: effectiveAlina, label: `واجب علينا: ${effectiveAlina} ج` };
    return { status: 'leina', netAmount: Math.abs(effectiveAlina), label: `باقي لينا: ${Math.abs(effectiveAlina)} ج` };
  }

  // 4. الحساب الطبيعي للنقطة المستلمة:
  const balance = received - paid;
  if (balance === 0) {
    return { status: 'khalis', netAmount: 0, label: 'خالص ✓' };
  }
  if (balance > 0) {
    return { status: 'alina', netAmount: balance, label: `واجب علينا: ${balance} ج` };
  }
  return { status: 'leina', netAmount: Math.abs(balance), label: `باقي لينا: ${Math.abs(balance)} ج` };
}
