import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Concert } from '../../concert/entities/concert.entity';
import { VipGuest, VipGuestStatus } from '../../concert/entities/vip-guest.entity';
import { CheckinStatus } from '../../common/enums/checkin-status.enum';

export default class VipGuestSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<any> {
    const vipGuestRepository = dataSource.getRepository(VipGuest);
    const concertRepository = dataSource.getRepository(Concert);

    // Tìm các concert tiêu biểu để thêm khách VIP
    const erasTour = await concertRepository.findOne({
      where: { title: 'The Eras Tour - Ho Chi Minh City' },
    });

    const rapVietPast = await concertRepository.findOne({
      where: { title: 'Rap Viet Finals 2025 (Past)' },
    });

    const guestsToSeed: Partial<VipGuest>[] = [];

    if (erasTour) {
      guestsToSeed.push(
        {
          concertId: erasTour.id,
          fullName: 'Trấn Thành',
          email: 'tranthanh@vip.vn',
          phone: '0901234567',
          affiliateCompany: 'Vie Channel',
          qrCodeHash: 'vip_hash_eras_1',
          status: VipGuestStatus.ACTIVE,
          checkinStatus: CheckinStatus.NOT_CHECKED_IN,
          checkedInAt: null,
        },
        {
          concertId: erasTour.id,
          fullName: 'Nguyễn Thanh Tùng',
          email: 'sontung@vip.vn',
          phone: '0901112222',
          affiliateCompany: 'M-TP Entertainment',
          qrCodeHash: 'vip_hash_eras_2',
          status: VipGuestStatus.ACTIVE,
          checkinStatus: CheckinStatus.NOT_CHECKED_IN,
          checkedInAt: null,
        },
        {
          concertId: erasTour.id,
          fullName: 'Mỹ Tâm',
          email: 'mytam@vip.vn',
          phone: '0903334444',
          affiliateCompany: 'MT Entertainment',
          qrCodeHash: 'vip_hash_eras_3',
          status: VipGuestStatus.ACTIVE,
          checkinStatus: CheckinStatus.NOT_CHECKED_IN,
          checkedInAt: null,
        }
      );
    }

    if (rapVietPast) {
      guestsToSeed.push(
        {
          concertId: rapVietPast.id,
          fullName: 'Suboi Hàng Lâm',
          email: 'suboi@vip.vn',
          phone: '0905556666',
          affiliateCompany: 'Rap Việt Production',
          qrCodeHash: 'vip_hash_rapviet_1',
          status: VipGuestStatus.USED,
          checkinStatus: CheckinStatus.CHECKED_IN,
          checkedInAt: new Date(rapVietPast.startTime.getTime() + 15 * 60 * 1000), // Check in sau khi bắt đầu 15 phút
        },
        {
          concertId: rapVietPast.id,
          fullName: 'Karik Nguyễn',
          email: 'karik@vip.vn',
          phone: '0907778888',
          affiliateCompany: 'Rap Việt Production',
          qrCodeHash: 'vip_hash_rapviet_2',
          status: VipGuestStatus.USED,
          checkinStatus: CheckinStatus.CHECKED_IN,
          checkedInAt: new Date(rapVietPast.startTime.getTime() + 20 * 60 * 1000), // Check in sau khi bắt đầu 20 phút
        },
        {
          concertId: rapVietPast.id,
          fullName: 'JustaTee Nguyễn',
          email: 'justatee@vip.vn',
          phone: '0909990000',
          affiliateCompany: 'SpaceSpeakers',
          qrCodeHash: 'vip_hash_rapviet_3',
          status: VipGuestStatus.ACTIVE,
          checkinStatus: CheckinStatus.NOT_CHECKED_IN,
          checkedInAt: null,
        }
      );
    }

    for (const data of guestsToSeed) {
      const exists = await vipGuestRepository.findOne({
        where: { concertId: data.concertId, email: data.email },
      });
      if (!exists) {
        const guest = vipGuestRepository.create(data);
        await vipGuestRepository.save(guest);
      }
    }
  }
}
