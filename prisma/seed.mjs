import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(process.cwd(), 'data', 'daftr.json');
  if (fs.existsSync(jsonPath)) {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    try {
      const entries = JSON.parse(raw);
      if (Array.isArray(entries)) {
        for (const item of entries) {
          await prisma.entry.upsert({
            where: { id: item.id },
            update: {
              name: item.name,
              nickname: item.nickname || null,
              occasion: item.occasion || null,
              amount: Number(item.amount) || 0,
              receivedAmount: Number(item.receivedAmount ?? item.amount) || 0,
              paidAmount: Number(item.paidAmount) || 0,
              location: item.location || '',
              notes: item.notes || '',
              crossed: !!item.crossed,
            },
            create: {
              id: item.id,
              name: item.name,
              nickname: item.nickname || null,
              occasion: item.occasion || null,
              amount: Number(item.amount) || 0,
              receivedAmount: Number(item.receivedAmount ?? item.amount) || 0,
              paidAmount: Number(item.paidAmount) || 0,
              location: item.location || '',
              notes: item.notes || '',
              crossed: !!item.crossed,
            },
          });
        }
        console.log(`Seeded ${entries.length} entries from daftr.json to SQLite!`);
      }
    } catch (e) {
      console.error('Error seeding data:', e);
    }
  }

  // Seed default occasions
  const defaultOccasions = ['فرح أحمد', 'سبوع مريم'];
  for (const name of defaultOccasions) {
    await prisma.occasion.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
