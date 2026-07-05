import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Concert, ConcertStatus } from '../../concert/entities/concert.entity';
import {
  TicketType,
  TicketTypeName,
} from '../../concert/entities/ticket-type.entity';

export default class ConcertSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<any> {
    const concertRepository = dataSource.getRepository(Concert);

    // Mẫu sơ đồ sân khấu dạng SVG đơn giản để lưu vào DB
    const sampleSvg = `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#1e1e24"/>
  <rect x="200" y="50" width="400" height="100" rx="10" fill="#f39c12"/>
  <text x="400" y="110" font-family="Arial" font-size="24" fill="white" text-anchor="middle">STAGE</text>
  <rect id="SVIP" x="250" y="180" width="300" height="80" rx="5" fill="#e74c3c" opacity="0.8"/>
  <text x="400" y="225" font-family="Arial" font-size="18" fill="white" text-anchor="middle">SVIP ZONE</text>
  <rect id="VIP" x="200" y="280" width="400" height="100" rx="5" fill="#9b59b6" opacity="0.8"/>
  <text x="400" y="335" font-family="Arial" font-size="18" fill="white" text-anchor="middle">VIP ZONE</text>
  <rect id="GA" x="150" y="400" width="500" height="150" rx="5" fill="#3498db" opacity="0.8"/>
  <text x="400" y="485" font-family="Arial" font-size="20" fill="white" text-anchor="middle">GENERAL ADMISSION</text>
</svg>`;

    const now = new Date();

    const concertsData = [
      {
        title: 'The Eras Tour - Ho Chi Minh City',
        description:
          'Trải nghiệm live show đỉnh cao của Taylor Swift với các bản hit qua các thời kỳ âm nhạc.',
        location: 'Sân vận động Quân khu 7, TP. Hồ Chí Minh',
        posterUrl:
          'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800',
        biography:
          'Đêm nhạc tái hiện các kỷ nguyên âm nhạc độc đáo của siêu sao thế giới Taylor Swift.',
        tags: ['Pop', 'Taylor Swift', 'Live Concert'],
        svgStageMap: sampleSvg,
        startTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 ngày sau
        endTime: new Date(
          now.getTime() + 30 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000,
        ), // Kéo dài 4 tiếng
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: TicketTypeName.SVIP,
            price: 5500000,
            totalQuantity: 100,
            maxPerUser: 2,
            saleStartTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // Đã mở bán từ hôm qua
            saleEndTime: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // Kết thúc bán sau 15 ngày
          },
          {
            name: TicketTypeName.VIP,
            price: 3500000,
            totalQuantity: 300,
            maxPerUser: 4,
            saleStartTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            saleEndTime: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
          },
          {
            name: TicketTypeName.GA,
            price: 1500000,
            totalQuantity: 1000,
            maxPerUser: 4,
            saleStartTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            saleEndTime: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),
          },
        ],
      },
      {
        title: 'Rock Storm 2026 - Hanoi',
        description:
          'Lễ hội nhạc Rock lớn nhất năm quy tụ các ban nhạc Rock hàng đầu Việt Nam.',
        location: 'Sân vận động Quốc gia Mỹ Đình, Hà Nội',
        posterUrl:
          'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
        biography:
          'Bão Rock trở lại Hà Nội hứa hẹn một đêm cháy hết mình của các tín đồ nhạc Rock.',
        tags: ['Rock', 'Metal', 'Festival'],
        svgStageMap: sampleSvg,
        startTime: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000), // 45 ngày sau
        endTime: new Date(
          now.getTime() + 45 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000,
        ), // Kéo dài 6 tiếng
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: TicketTypeName.VIP,
            price: 1200000,
            totalQuantity: 200,
            maxPerUser: 4,
            saleStartTime: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // Bắt đầu bán sau 1 ngày
            saleEndTime: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
          },
          {
            name: TicketTypeName.CAT1,
            price: 600000,
            totalQuantity: 1000,
            maxPerUser: 4,
            saleStartTime: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
            saleEndTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
          {
            name: TicketTypeName.CAT2,
            price: 300000,
            totalQuantity: 2000,
            maxPerUser: 6,
            saleStartTime: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
            saleEndTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        ],
      },
      {
        title: 'BLACKPINK Born Pink Tour - Hanoi',
        description:
          'Tour diễn vòng quanh thế giới của nhóm nhạc nữ toàn cầu BLACKPINK tại Hà Nội.',
        location: 'Sân vận động Quốc gia Mỹ Đình, Hà Nội',
        posterUrl:
          'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
        biography:
          ' BLACKPINK quay trở lại Mỹ Đình trong tour diễn Born Pink hoành tráng nhất lịch sử.',
        tags: ['Pop', 'K-Pop', 'BLACKPINK', 'Live Concert'],
        svgStageMap: sampleSvg,
        startTime: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), // 60 ngày sau
        endTime: new Date(
          now.getTime() + 60 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000,
        ),
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: TicketTypeName.SVIP,
            price: 9800000,
            totalQuantity: 200,
            maxPerUser: 2,
            saleStartTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            saleEndTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
          },
          {
            name: TicketTypeName.VIP,
            price: 6800000,
            totalQuantity: 500,
            maxPerUser: 4,
            saleStartTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            saleEndTime: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
          },
          {
            name: TicketTypeName.CAT1,
            price: 3800000,
            totalQuantity: 1500,
            maxPerUser: 4,
            saleStartTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            saleEndTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
          {
            name: TicketTypeName.CAT2,
            price: 1200000,
            totalQuantity: 3000,
            maxPerUser: 6,
            saleStartTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            saleEndTime: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        ],
      },
      {
        title: 'Chillout Indie Night - Da Nang',
        description:
          'Đêm nhạc Indie nhẹ nhàng dành cho những tâm hồn lãng mạn bên bờ biển Đà Nẵng.',
        location: 'Công viên Biển Đông, Đà Nẵng',
        posterUrl:
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800',
        biography:
          'Đêm nhạc mộc mạc bên bờ sóng của các nghệ sĩ Indie được yêu thích nhất.',
        tags: ['Indie', 'Acoustic', 'Chill', 'Live Concert'],
        svgStageMap: sampleSvg,
        startTime: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
        endTime: new Date(
          now.getTime() + 15 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000,
        ),
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: TicketTypeName.VIP,
            price: 800000,
            totalQuantity: 150,
            maxPerUser: 4,
            saleStartTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
            saleEndTime: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000),
          },
          {
            name: TicketTypeName.GA,
            price: 450000,
            totalQuantity: 800,
            maxPerUser: 4,
            saleStartTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
            saleEndTime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          },
        ],
      },
      {
        title: 'Symphony of Lights - HCMC',
        description:
          'Buổi hòa nhạc giao hưởng cổ điển kết hợp trình diễn ánh sáng nghệ thuật.',
        location: 'Nhà hát Thành phố, TP. Hồ Chí Minh',
        posterUrl:
          'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=800',
        biography:
          'Sự kết hợp hoàn hảo giữa âm thanh thính phòng bác học và ánh sáng 3D mapping.',
        tags: ['Classical', 'Orchestra', 'Instrumental'],
        svgStageMap: sampleSvg,
        startTime: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
        endTime: new Date(
          now.getTime() + 20 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
        ),
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: TicketTypeName.VIP,
            price: 2500000,
            totalQuantity: 50,
            maxPerUser: 2,
          },
          {
            name: TicketTypeName.CAT1,
            price: 1500000,
            totalQuantity: 100,
            maxPerUser: 4,
          },
          {
            name: TicketTypeName.CAT2,
            price: 800000,
            totalQuantity: 150,
            maxPerUser: 4,
          },
        ],
      },
      {
        title: 'Rap Viet Live Concert 2026 - HCMC',
        description:
          'Đại nhạc hội hội tụ những tên tuổi hàng đầu của làng Rap Việt.',
        location: 'Nhà thi đấu Phú Thọ, TP. Hồ Chí Minh',
        posterUrl:
          'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=800',
        biography:
          'Đêm nhạc bùng nổ năng lượng của các thế hệ Rapper đình đám Việt Nam.',
        tags: ['HipHop', 'Rap', 'Live Concert'],
        svgStageMap: sampleSvg,
        startTime: new Date(now.getTime() + 75 * 24 * 60 * 60 * 1000),
        endTime: new Date(
          now.getTime() + 75 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000,
        ),
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: TicketTypeName.SVIP,
            price: 3000000,
            totalQuantity: 300,
            maxPerUser: 2,
          },
          {
            name: TicketTypeName.VIP,
            price: 2000000,
            totalQuantity: 1000,
            maxPerUser: 4,
          },
          {
            name: TicketTypeName.GA,
            price: 1000000,
            totalQuantity: 5000,
            maxPerUser: 4,
          },
        ],
      },
      {
        title: 'Jazz Under the Stars - Da Lat',
        description: 'Đêm nhạc Jazz lãng mạn dưới bầu trời đêm Đà Lạt mộng mơ.',
        location: 'Mây Lang Thang, Đà Lạt',
        posterUrl:
          'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
        biography:
          'Thưởng thức nhạc Jazz sâu lắng trong không khí se lạnh của xứ sở ngàn hoa.',
        tags: ['Jazz', 'Acoustic', 'Chill'],
        svgStageMap: sampleSvg,
        startTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        endTime: new Date(
          now.getTime() + 10 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000,
        ),
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: TicketTypeName.VIP,
            price: 1200000,
            totalQuantity: 100,
            maxPerUser: 4,
          },
          {
            name: TicketTypeName.GA,
            price: 600000,
            totalQuantity: 300,
            maxPerUser: 4,
          },
        ],
      },
      {
        title: 'EDM Rave Mania - Nha Trang',
        description:
          'Đại tiệc âm nhạc điện tử EDM cuồng nhiệt bên bờ biển Nha Trang.',
        location: 'Quảng trường 2 Tháng 4, Nha Trang',
        posterUrl:
          'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
        biography:
          'Nhảy múa cùng các DJ quốc tế và Việt Nam trong đại tiệc EDM hoành tráng.',
        tags: ['EDM', 'Electronic', 'Festival'],
        svgStageMap: sampleSvg,
        startTime: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        endTime: new Date(
          now.getTime() + 90 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000,
        ),
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: TicketTypeName.VIP,
            price: 1500000,
            totalQuantity: 500,
            maxPerUser: 4,
          },
          {
            name: TicketTypeName.GA,
            price: 700000,
            totalQuantity: 4000,
            maxPerUser: 4,
          },
        ],
      },
      {
        title: 'Lover Tour - Da Nang (Draft)',
        description: 'Đêm nhạc trữ tình bên bờ biển Mỹ Khê xinh đẹp.',
        location: 'Công viên Biển Đông, Đà Nẵng',
        posterUrl:
          'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
        biography:
          'Live concert kết hợp giữa âm nhạc lãng mạn và không gian biển thơ mộng.',
        tags: ['Indie', 'Acoustic', 'Draft'],
        svgStageMap: undefined,
        startTime: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        endTime: new Date(
          now.getTime() + 60 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000,
        ),
        status: ConcertStatus.DRAFT,
        ticketTypes: [
          {
            name: TicketTypeName.GA,
            price: 500000,
            totalQuantity: 500,
            maxPerUser: 4,
            saleStartTime: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
            saleEndTime: new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000),
          },
        ],
      },
      {
        title: 'Retro Pop Night - Hue (Draft)',
        description:
          'Đêm nhạc tái hiện các ca khúc nhạc Pop retro thập niên 90.',
        location: 'Cung An Định, Huế',
        posterUrl:
          'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
        biography:
          'Giai điệu hoài niệm trong không gian hoàng cung Huế xưa kính.',
        tags: ['Retro', 'Pop', 'Draft'],
        svgStageMap: undefined,
        startTime: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000),
        endTime: new Date(
          now.getTime() + 120 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000,
        ),
        status: ConcertStatus.DRAFT,
        ticketTypes: [
          {
            name: TicketTypeName.GA,
            price: 350000,
            totalQuantity: 1000,
            maxPerUser: 6,
          },
        ],
      },
      {
        title: 'Future Bass Fest 2026 - Can Tho (Cancelled)',
        description: 'Lễ hội âm nhạc Future Bass miền Tây sông nước.',
        location: 'Bến Ninh Kiều, Cần Thơ',
        posterUrl:
          'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800',
        biography: 'Lễ hội âm nhạc điện tử kết hợp ẩm thực sông nước Cần Thơ.',
        tags: ['EDM', 'FutureBass', 'Cancelled'],
        svgStageMap: undefined,
        startTime: new Date(now.getTime() + 150 * 24 * 60 * 60 * 1000),
        endTime: new Date(
          now.getTime() + 150 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000,
        ),
        status: ConcertStatus.CANCELLED,
        ticketTypes: [
          {
            name: TicketTypeName.GA,
            price: 500000,
            totalQuantity: 2000,
            maxPerUser: 4,
          },
        ],
      },
    ];

    for (const concertData of concertsData) {
      const exists = await concertRepository.findOne({
        where: { title: concertData.title },
      });
      if (!exists) {
        const concert = concertRepository.create({
          title: concertData.title,
          description: concertData.description,
          location: concertData.location,
          posterUrl: concertData.posterUrl,
          biography: concertData.biography,
          tags: concertData.tags,
          svgStageMap: concertData.svgStageMap,
          startTime: concertData.startTime,
          endTime: concertData.endTime,
          status: concertData.status,
          ticketTypes: concertData.ticketTypes.map((tt) => ({
            name: tt.name,
            price: tt.price,
            totalQuantity: tt.totalQuantity,
            availableQuantity: tt.totalQuantity,
            maxPerUser: tt.maxPerUser,
            saleStartTime: tt.saleStartTime,
            saleEndTime: tt.saleEndTime,
          })),
        });

        await concertRepository.save(concert);
      }
    }
  }
}
