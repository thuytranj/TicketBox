import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { User, UserRole, UserStatus } from '../../auth/entities/user.entity';
import * as bcrypt from 'bcrypt';

export default class UserSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<any> {
    const repository = dataSource.getRepository(User);

    // Hash password "123123"
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('123123', salt);

    const usersData = [
      {
        email: 'organizer@ticketbox.vn',
        passwordHash,
        fullName: 'TicketBox Organizer',
        role: UserRole.ORGANIZER,
        status: UserStatus.ACTIVE,
      },
      {
        email: 'staff@ticketbox.vn',
        passwordHash,
        fullName: 'Gate Staff A',
        role: UserRole.GATE_STAFF,
        status: UserStatus.ACTIVE,
      },
      {
        email: 'staff2@ticketbox.vn',
        passwordHash,
        fullName: 'Gate Staff B',
        role: UserRole.GATE_STAFF,
        status: UserStatus.ACTIVE,
      },
      {
        email: 'audience@ticketbox.vn',
        passwordHash,
        fullName: 'Audience Guest',
        role: UserRole.AUDIENCE,
        status: UserStatus.ACTIVE,
      },
      {
        email: 'audience1@ticketbox.vn',
        passwordHash,
        fullName: 'Audience Guest 1',
        role: UserRole.AUDIENCE,
        status: UserStatus.ACTIVE,
      },
      {
        email: 'audience2@ticketbox.vn',
        passwordHash,
        fullName: 'Audience Guest 2',
        role: UserRole.AUDIENCE,
        status: UserStatus.ACTIVE,
      },
      {
        email: 'audience3@ticketbox.vn',
        passwordHash,
        fullName: 'Audience Guest 3',
        role: UserRole.AUDIENCE,
        status: UserStatus.ACTIVE,
      },
      {
        email: 'audience4@ticketbox.vn',
        passwordHash,
        fullName: 'Audience Guest 4',
        role: UserRole.AUDIENCE,
        status: UserStatus.ACTIVE,
      },
      {
        email: 'audience5@ticketbox.vn',
        passwordHash,
        fullName: 'Audience Guest 5',
        role: UserRole.AUDIENCE,
        status: UserStatus.ACTIVE,
      },
    ];

    for (const data of usersData) {
      const exists = await repository.findOne({ where: { email: data.email } });
      if (!exists) {
        const user = repository.create(data);
        await repository.save(user);
      }
    }
  }
}
