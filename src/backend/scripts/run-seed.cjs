#!/usr/bin/env node

require('reflect-metadata');
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    resolvePackageJsonExports: false,
    resolvePackageJsonImports: false,
  },
});

async function getCounts(dataSource, entities) {
  const counts = await Promise.all(
    entities.map(async ([key, entity]) => [
      key,
      await dataSource.getRepository(entity).count(),
    ]),
  );

  return Object.fromEntries(counts);
}

async function main() {
  const { default: dataSource } = require('../src/data/ormconfig');
  const { default: UserSeeder } = require('../src/data/seeds/user.seed');
  const { default: ConcertSeeder } = require('../src/data/seeds/concert.seed');
  const { default: VipGuestSeeder } = require('../src/data/seeds/vip-guest.seed');
  const { default: TransactionSeeder } = require('../src/data/seeds/transaction.seed');
  const { User } = require('../src/auth/entities/user.entity');
  const { Concert } = require('../src/concert/entities/concert.entity');
  const { TicketType } = require('../src/concert/entities/ticket-type.entity');
  const { VipGuest } = require('../src/concert/entities/vip-guest.entity');
  const { Order } = require('../src/booking/entities/order.entity');
  const { Ticket } = require('../src/booking/entities/ticket.entity');
  const { Payment } = require('../src/payment/entities/payment.entity');
  const { CheckinLog } = require('../src/checkin/entities/checkin-log.entity');

  const trackedEntities = [
    ['users', User],
    ['concerts', Concert],
    ['ticket_types', TicketType],
    ['vip_guests', VipGuest],
    ['orders', Order],
    ['tickets', Ticket],
    ['payments', Payment],
    ['checkin_logs', CheckinLog],
  ];

  const seeders = [
    ['UserSeeder', new UserSeeder()],
    ['ConcertSeeder', new ConcertSeeder()],
    ['VipGuestSeeder', new VipGuestSeeder()],
    ['TransactionSeeder', new TransactionSeeder()],
  ];

  await dataSource.initialize();

  try {
    const before = await getCounts(dataSource, trackedEntities);
    console.log('[seed] Starting direct seed run...');
    console.log(`[seed] Counts before: ${JSON.stringify(before)}`);

    for (const [name, seeder] of seeders) {
      console.log(`[seed] Running ${name}...`);
      await seeder.run(dataSource);
    }

    const after = await getCounts(dataSource, trackedEntities);
    console.log(`[seed] Counts after: ${JSON.stringify(after)}`);
    console.log('[seed] Direct seed run completed.');
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

main().catch((error) => {
  console.error('[seed] Direct seed run failed.');
  console.error(error);
  process.exitCode = 1;
});
