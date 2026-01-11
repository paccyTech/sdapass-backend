const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function main() {
  console.log('Seeding database...');

  // Ensure base union exists
  const unionId = 'kigali-union';
  const union = await prisma.union.upsert({
    where: { id: unionId },
    update: {},
    create: {
      id: unionId,
      name: 'Kigali Union',
      description: 'Main union for Kigali region',
    },
  });

  // Ensure union admin user exists
  const adminNationalId = '1000000000000001';
  const existingAdmin = await prisma.user.findUnique({
    where: { nationalId: adminNationalId },
  });

  if (!existingAdmin) {
    const adminPasswordHash = await hashPassword('Admin@123');
    const admin = await prisma.user.create({
      data: {
        username: 'union-admin',
        nationalId: adminNationalId,
        firstName: 'Union',
        lastName: 'Admin',
        phoneNumber: '+250780000001',
        email: 'union.admin@umuganda.rw',
        passwordHash: adminPasswordHash,
        role: Role.UNION_ADMIN,
        unionId: union.id,
        isActive: true,
      },
    });

    console.log('Union admin created successfully:');
    console.log(`- Email: ${admin.email}`);
    console.log(`- Password: Admin@123`);
    console.log(`- Role: ${admin.role}`);
  } else {
    console.log('Union admin already exists, skipping creation.');
  }

  // Ensure a police verifier account exists
  const policeNationalId = '2000000000000001';
  const existingPolice = await prisma.user.findUnique({
    where: { nationalId: policeNationalId },
  });

  if (!existingPolice) {
    const policePasswordHash = await hashPassword('Police@123');
    const police = await prisma.user.create({
      data: {
        username: 'police-verifier',
        nationalId: policeNationalId,
        firstName: 'Police',
        lastName: 'Verifier',
        phoneNumber: '+250780000900',
        email: 'police.verifier@umuganda.rw',
        passwordHash: policePasswordHash,
        role: Role.POLICE_VERIFIER,
        isActive: true,
      },
    });

    console.log('Police verifier account created:');
    console.log(`- Email: ${police.email}`);
    console.log(`- Password: Police@123`);
    console.log(`- Role: ${police.role}`);
  } else {
    console.log('Police verifier already exists, skipping creation.');
  }
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
