import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create demo user
  const hashedPassword = await bcrypt.hash('Demo123!', 10);

  const user = await prisma.user.upsert({
    where: { email: 'demo@fortune-teller.com' },
    update: {},
    create: {
      email: 'demo@fortune-teller.com',
      username: 'demo_user',
      password: hashedPassword,
      birthDate: new Date('1990-01-01'),
      birthTime: '08:00',
      gender: 'male',
      language: 'zh-CN',
      timezone: 'Asia/Shanghai',
    },
  });

  console.log('Created demo user:', user);

  // Create sample fortune
  await prisma.fortune.create({
    data: {
      userId: user.id,
      category: 'daily',
      title: 'Daily Fortune',
      description: 'Today is a good day for new beginnings',
      prediction: 'You will have good luck today',
      luckyNumber: 8,
      luckyColor: 'red',
      luckyDirection: 'east',
      advice: 'Be confident and take initiative',
      score: 85,
    },
  });

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
