import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CustomerProfile database...');

  const mockCustomers = [
    {
      plate: 'ABC-1234',
      name: 'Tariq Al-Mansoor',
      phone: '+966501234567',
    },
    {
      plate: 'XYZ-9876',
      name: 'Nouf Al-Harbi',
      phone: '+966559876543',
    },
    {
      plate: 'KSA-5555',
      name: 'Fahad Al-Dossari',
      phone: '+966541112233',
    },
    {
      plate: 'TOY-2026',
      name: 'Sara Al-Ghamdi',
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
