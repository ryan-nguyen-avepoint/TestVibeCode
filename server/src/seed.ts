import { userDb, roomDb } from './lib/database';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Create system user first
  const systemPassword = await bcrypt.hash('system_password_not_for_login', 12);
  userDb.upsert('system', 'system', systemPassword);

  // 2. Create global room
  roomDb.upsert('global-room', {
    name: '🌍 Global Chat',
    description: 'Welcome to the global chat room! Everyone is here.',
    isGlobal: true,
    isPrivate: false,
    ownerId: 'system',
  });

  console.log('✅ System user created');
  console.log('✅ Global room created: 🌍 Global Chat');
  console.log('✅ Seed complete!');
}

seed()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  });
