import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../../auth/entities/user.entity';
import * as bcrypt from 'bcrypt';

export default class UserSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
  ): Promise<any> {
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
      },
      {
        email: 'staff@ticketbox.vn',
        passwordHash,
        fullName: 'Gate Staff A',
        role: UserRole.GATE_STAFF,
      },
      {
        email: 'audience@ticketbox.vn',
        passwordHash,
        fullName: 'Audience Guest',
        role: UserRole.AUDIENCE,
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
