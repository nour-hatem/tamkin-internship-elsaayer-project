import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();


const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CustomerProfile database...');

  const mockCustomers = [
    {
      plate: 'ABC-1234',
      name: 'طارق منصور',
      phone: '+966501234567',
    },
    {
      plate: 'XYZ-9876',
      name: 'نوف الحربي',
      phone: '+966559876543',
    },
    {
      plate: 'KSA-5555',
      name: 'فهد عابد',
      phone: '+966541112233',
    },
    {
      plate: 'TOY-2026',
      name: 'ساره الغمدي',
      phone: '+966567778899',
    },
  ];

  for (const customer of mockCustomers) {
    const upserted = await prisma.customerProfile.upsert({
      where: { plate: customer.plate },
      update: {
        name: customer.name,
        phone: customer.phone,
      },
      create: customer,
    });
    console.log(`Upserted customer: ${upserted.name} (${upserted.plate})`);
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });