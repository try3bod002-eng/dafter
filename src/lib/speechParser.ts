export function parseEgyptianArabicNumbers(text: string): number | null {
  if (!text) return null;

  // Extract digits (Arabic-Indic or standard)
  const digitsMatch = text.match(/[\d٠١٢٣٤٥٦٧٨٩]+/);
  if (digitsMatch) {
    const s = digitsMatch[0]
      .replace(/٠/g, '0').replace(/١/g, '1').replace(/٢/g, '2').replace(/٣/g, '3').replace(/٤/g, '4')
      .replace(/٥/g, '5').replace(/٦/g, '6').replace(/٧/g, '7').replace(/٨/g, '8').replace(/٩/g, '9');
    return parseInt(s, 10);
  }

  const cleaned = text.trim();
  let total = 0;

  if (cleaned.includes('الفين') || cleaned.includes('ألفين')) total += 2000;
  else if (cleaned.includes('الف') || cleaned.includes('ألف')) total += 1000;

  if (cleaned.includes('تسعمية') || cleaned.includes('تسعمائة')) total += 900;
  else if (cleaned.includes('تمنمية') || cleaned.includes('ثمانمائة') || cleaned.includes('تمنميه')) total += 800;
  else if (cleaned.includes('سبعمية') || cleaned.includes('سبعمائة')) total += 700;
  else if (cleaned.includes('ستمية') || cleaned.includes('ستمائة')) total += 600;
  else if (cleaned.includes('خمسمية') || cleaned.includes('خمسمائة')) total += 500;
  else if (cleaned.includes('ربعمية') || cleaned.includes('أربعمائة')) total += 400;
  else if (cleaned.includes('تلتمية') || cleaned.includes('ثلاثمائة')) total += 300;
  else if (cleaned.includes('ميتين') || cleaned.includes('مائتان') || cleaned.includes('مائتين')) total += 200;
  else if (cleaned.includes('مية') || cleaned.includes('مائة')) total += 100;

  if (cleaned.includes('خمسين')) total += 50;

  return total > 0 ? total : null;
}

export interface ParsedSpokenEntry {
  name: string;
  amount: number;
  location: string;
  notes: string;
  crossed: boolean;
}

export function parseSpokenSentence(rawText: string): ParsedSpokenEntry {
  const raw = rawText.trim();
  let name = '';
  let amount: number | null = null;
  let location = '';
  let notes = '';

  const hasTags = /(الاسم|اسم|المبلغ|مبلغ|البلد|بلد|من|الملاحظات|ملاحظات|الملاحظة|ملاحظة)/i.test(raw);

  if (hasTags) {
    const tokens = raw.split(/(الاسم|اسم|المبلغ|مبلغ|البلد|بلد|من|الملاحظات|ملاحظات|الملاحظة|ملاحظة)/);
    let cur = '';

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i].trim();
      if (!t) continue;

      if (['الاسم', 'اسم'].includes(t)) cur = 'name';
      else if (['المبلغ', 'مبلغ'].includes(t)) cur = 'amount';
      else if (['البلد', 'بلد', 'من'].includes(t)) cur = 'location';
      else if (['الملاحظات', 'ملاحظات', 'الملاحظة', 'ملاحظة'].includes(t)) cur = 'notes';
      else {
        if (cur === 'name' && !name) name = t;
        else if (cur === 'amount' && amount === null) amount = parseEgyptianArabicNumbers(t);
        else if (cur === 'location' && !location) location = t;
        else if (cur === 'notes' && !notes) notes = t;
        else if (!cur && !name) name = t;
      }
    }
  }

  if (amount === null) {
    amount = parseEgyptianArabicNumbers(raw);
  }

  // Fallback: natural flow (Name before number, notes/location after)
  if (!name && amount !== null) {
    const amountRegex = /(\d+|الفين|ألفين|ألف|الف|تسعمية|تمنمية|سبعمية|ستمية|خمسمية|ربعمية|تلتمية|ميتين|مية)/;
    const match = raw.match(amountRegex);
    if (match && match.index !== undefined) {
      name = raw.substring(0, match.index).trim();
      const after = raw.substring(match.index + match[0].length).trim();
      if (after) {
        if (after.includes('خالص') || after.includes('عليه') || after.includes('علينا')) {
          notes = after;
        } else {
          location = after;
        }
      }
    }
  }

  if (!name) name = raw;

  name = name.replace(/^(سجل|اكتب|ضيف|حط|سجل عندك|ضيف عندك)\s+/g, '').replace(/(احفظ|خلاص)$/g, '').trim();

  if (raw.includes('خالص') && (!notes || !notes.includes('خالص'))) {
    notes = notes ? `${notes} - خالص` : 'خالص';
  }

  const crossed = notes.includes('مشطوب') || notes.includes('مردود');

  return {
    name: name || 'اسم غير محدد',
    amount: amount !== null ? amount : 200,
    location: location || '',
    notes: notes || '',
    crossed,
  };
}
