import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Concert, ConcertStatus } from '../../concert/entities/concert.entity';

// Helper function to create dates in UTC that correspond to a specific Vietnam GMT+7 time
function getNiceDate(offsetDays: number, hourGmt7: number, minuteGmt7: number = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0); // Clear local time
  d.setDate(d.getDate() + offsetDays);
  
  let utcHour = hourGmt7 - 7;
  let dayOffset = 0;
  if (utcHour < 0) {
    utcHour += 24;
    dayOffset = -1;
  }
  
  return new Date(Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + dayOffset,
    utcHour,
    minuteGmt7,
    0,
    0
  ));
}

export default class ConcertSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<any> {
    const concertRepository = dataSource.getRepository(Concert);

    // Mẫu sơ đồ sân khấu dạng SVG đơn giản để lưu vào DB
    const sampleSvg = `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="600" fill="#1e1e24"/>
  <rect x="200" y="50" width="400" height="100" rx="10" fill="#f39c12"/>
  <text x="400" y="110" font-family="Arial" font-size="24" fill="white" text-anchor="middle">STAGE</text>
  <rect x="250" y="180" width="300" height="80" rx="5" fill="#e74c3c" opacity="0.8"/>
  <text x="400" y="225" font-family="Arial" font-size="18" fill="white" text-anchor="middle">SVIP ZONE</text>
  <rect x="200" y="280" width="400" height="100" rx="5" fill="#9b59b6" opacity="0.8"/>
  <text x="400" y="335" font-family="Arial" font-size="18" fill="white" text-anchor="middle">VIP ZONE</text>
  <rect x="150" y="400" width="500" height="150" rx="5" fill="#3498db" opacity="0.8"/>
  <text x="400" y="485" font-family="Arial" font-size="20" fill="white" text-anchor="middle">GENERAL ADMISSION</text>
</svg>`;

    const concertsData = [
      {
        title: 'The Eras Tour - Ho Chi Minh City',
        description:
          'Trải nghiệm live show đỉnh cao của Taylor Swift với các bản hit qua các thời kỳ âm nhạc.',
        location: 'Sân vận động Quân khu 7, TP. Hồ Chí Minh',
        posterUrl:
          'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800',
        biography: `TAYLOR SWIFT | THE ERAS TOUR - HO CHI MINH CITY

Chào mừng bạn đến với chuyến hành trình âm nhạc đi qua tất cả các kỷ nguyên (Eras) trong sự nghiệp của Taylor Swift. Đây là sự kiện âm nhạc quy mô quốc tế lớn nhất năm 2026 tại Việt Nam.

Nghệ sĩ & Chương trình:
- Nghệ sĩ chính: Taylor Swift
- Khách mời mở màn (Opening Act): Sabrina Carpenter
- Thời lượng: Hơn 3.5 tiếng với danh sách biểu diễn (setlist) gồm 44 ca khúc thuộc 10 album kỷ nguyên.

Lịch trình sự kiện (Timeline):
• 15:00 - Mở cửa khu vực check-in dành cho vé Standard Zone A (Early Entry).
• 16:00 - Mở cửa toàn bộ các cổng soát vé (Standard Zone B, General Admission).
• 18:30 - Sabrina Carpenter bắt đầu biểu diễn mở màn.
• 19:30 - Taylor Swift chính thức lên sân khấu.
• 23:00 - Đêm nhạc kết thúc.

Quy định tham gia (Gate Rules):
1. Độ tuổi: Trẻ em dưới 7 tuổi không được tham gia khu vực Fanzone/Đứng. Trẻ em từ 7-12 tuổi phải có người giám hộ đi kèm.
2. Vật dụng cấm mang vào sân: Máy ảnh chuyên nghiệp (ống kính rời), gậy selfie, nước uống đóng chai có nắp, và vật sắc nhọn.
3. Quy định Check-in: Vui lòng chuẩn bị sẵn mã QR trên điện thoại hoặc bản in rõ nét để quét nhanh tại cổng soát vé.`,
        tags: ['Pop', 'Taylor Swift', 'Live Concert'],
        svgStageMap: sampleSvg,
        startTime: getNiceDate(30, 19, 30), // 30 ngày sau, 19:30
        endTime: getNiceDate(30, 23, 0), // 30 ngày sau, 23:00
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: 'Standard Zone A',
            price: 5500000,
            totalQuantity: 100,
            maxPerUser: 2,
            saleStartTime: getNiceDate(-1, 9, 0), // Đã mở bán từ hôm qua lúc 09:00
            saleEndTime: getNiceDate(15, 23, 30), // Kết thúc bán sau 15 ngày lúc 23:30
          },
          {
            name: 'Standard Zone B',
            price: 3500000,
            totalQuantity: 300,
            maxPerUser: 4,
            saleStartTime: getNiceDate(-1, 9, 0),
            saleEndTime: getNiceDate(15, 23, 30),
          },
          {
            name: 'General Admission',
            price: 1500000,
            totalQuantity: 1000,
            maxPerUser: 4,
            saleStartTime: getNiceDate(-1, 9, 0),
            saleEndTime: getNiceDate(25, 23, 30),
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
        biography: `ROCK STORM 2026 - HANOI

Bão Rock trở lại Hà Nội hứa hẹn một đêm cháy hết mình của các tín đồ nhạc Rock. Quy tụ dàn nghệ sĩ gạo cội và những màu sắc Indie Rock mới mẻ của Việt Nam.

Line-up ban nhạc:
- Bức Tường
- Ngọt (Tribute Session)
- 7UPPERCUTS
- Microwave
- Chillies

Lịch trình sự kiện (Timeline):
• 17:00 - Mở cổng soát vé cho tất cả các hạng vé.
• 18:30 - Khai mạc lễ hội và ban nhạc đầu tiên biểu diễn.
• 21:00 - Đỉnh điểm đêm diễn với set nhạc của Bức Tường.
• 23:30 - Đêm nhạc kết thúc.

Quy định an ninh:
1. Tuyệt đối không mang chất kích thích, chai thủy tinh hoặc vũ khí vào sân vận động.
2. Ban tổ chức có quyền từ chối vào cửa đối với khách hàng có hành vi gây rối mất trật tự.`,
        tags: ['Rock', 'Metal', 'Festival'],
        svgStageMap: sampleSvg,
        startTime: getNiceDate(45, 18, 30), // 45 ngày sau, 18:30
        endTime: getNiceDate(45, 23, 30), // 45 ngày sau, 23:30
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: 'Rock VIP Pit',
            price: 1200000,
            totalQuantity: 200,
            maxPerUser: 4,
            saleStartTime: getNiceDate(1, 10, 0), // Bắt đầu bán sau 1 ngày lúc 10:00
            saleEndTime: getNiceDate(20, 18, 0),
          },
          {
            name: 'Rock Zone A',
            price: 600000,
            totalQuantity: 1000,
            maxPerUser: 4,
            saleStartTime: getNiceDate(1, 10, 0),
            saleEndTime: getNiceDate(30, 18, 0),
          },
          {
            name: 'Rock Zone B',
            price: 300000,
            totalQuantity: 2000,
            maxPerUser: 6,
            saleStartTime: getNiceDate(1, 10, 0),
            saleEndTime: getNiceDate(30, 18, 0),
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
        biography: `BLACKPINK BORN PINK TOUR - HANOI

BLACKPINK quay trở lại Mỹ Đình trong tour diễn Born Pink hoành tráng nhất lịch sử. Đêm nhạc hứa hẹn mang đến những hiệu ứng sân khấu bùng nổ, âm thanh đỉnh cao và các bản hit toàn cầu.

Line-up nghệ sĩ:
- Jisoo, Jennie, Rosé, Lisa

Lịch trình sự kiện:
• 16:30 - Mở cửa check-in khu vực VIP Blink (Xem soundcheck).
• 17:30 - Bắt đầu buổi Soundcheck dành riêng cho vé VIP Blink.
• 18:00 - Mở cửa đón khách tất cả các hạng vé.
• 19:30 - Đêm diễn chính thức bắt đầu.
• 22:30 - Đêm nhạc kết thúc.

Quy định check-in & Lightstick:
- Chỉ chấp nhận Lightstick chính hãng (BI-Ping-Bong).
- Vui lòng đổi vòng tay trước giờ biểu diễn tối thiểu 2 tiếng để hạn chế ùn tắc.`,
        tags: ['Pop', 'K-Pop', 'BLACKPINK', 'Live Concert'],
        svgStageMap: sampleSvg,
        startTime: getNiceDate(60, 19, 30), // 60 ngày sau, 19:30
        endTime: getNiceDate(60, 22, 30), // 60 ngày sau, 22:30
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: 'VIP Blink',
            price: 9800000,
            totalQuantity: 200,
            maxPerUser: 2,
            saleStartTime: getNiceDate(-2, 12, 0), // Đã mở bán 2 ngày trước
            saleEndTime: getNiceDate(10, 12, 0),
          },
          {
            name: 'Platinum Zone',
            price: 6800000,
            totalQuantity: 500,
            maxPerUser: 4,
            saleStartTime: getNiceDate(-2, 12, 0),
            saleEndTime: getNiceDate(20, 12, 0),
          },
          {
            name: 'CAT 1',
            price: 3800000,
            totalQuantity: 1500,
            maxPerUser: 4,
            saleStartTime: getNiceDate(-2, 12, 0),
            saleEndTime: getNiceDate(30, 12, 0),
          },
          {
            name: 'CAT 2',
            price: 1200000,
            totalQuantity: 3000,
            maxPerUser: 6,
            saleStartTime: getNiceDate(-2, 12, 0),
            saleEndTime: getNiceDate(30, 12, 0),
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
        biography: `CHILLOUT INDIE NIGHT - DA NANG

Đêm nhạc mộc mạc bên bờ sóng của các nghệ sĩ Indie được yêu thích nhất. Hãy cùng thả hồn vào những giai điệu Acoustic ngọt ngào dưới ánh hoàng hôn và gió biển Đà Nẵng.

Nghệ sĩ biểu diễn:
- Vũ. (Hoàng tử Indie)
- Trang
- Đen Vâu (Khách mời đặc biệt)
- Thịnh Suy

Lịch trình sự kiện (Timeline):
• 16:30 - Mở cổng soát vé đón khách.
• 17:30 - Hoàng hôn Acoustic với màn chào sân của Thịnh Suy.
• 19:30 - Phần biểu diễn chính thức của Vũ. và Trang.
• 21:30 - Sự xuất hiện của Đen Vâu.
• 22:30 - Kết thúc đêm nhạc.`,
        tags: ['Indie', 'Acoustic', 'Chill', 'Live Concert'],
        svgStageMap: sampleSvg,
        startTime: getNiceDate(15, 17, 30), // 15 ngày sau, 17:30
        endTime: getNiceDate(15, 22, 30), // 15 ngày sau, 22:30
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: 'VIP Seat',
            price: 800000,
            totalQuantity: 150,
            maxPerUser: 4,
            saleStartTime: getNiceDate(-5, 9, 0),
            saleEndTime: getNiceDate(12, 18, 0),
          },
          {
            name: 'General Admission',
            price: 450000,
            totalQuantity: 800,
            maxPerUser: 4,
            saleStartTime: getNiceDate(-5, 9, 0),
            saleEndTime: getNiceDate(14, 18, 0),
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
        biography: `SYMPHONY OF LIGHTS - HCMC

Sự kết hợp hoàn hảo giữa âm thanh thính phòng bác học và trình diễn ánh sáng 3D Mapping hiện đại bậc nhất. Mang lại một bữa tiệc thị giác và thính giác đỉnh cao.

Dàn nhạc & Nhạc trưởng:
- Dàn nhạc Giao hưởng TP.HCM (HBSO)
- Nhạc trưởng khách mời từ Pháp: Alexandre Guyon

Lịch trình sự kiện:
• 19:00 - Đón khách và chụp ảnh lưu niệm tại tiền sảnh Nhà Hát.
• 19:45 - Mở cửa khán phòng và ổn định chỗ ngồi.
• 20:00 - Phần 1: Giao hưởng cổ điển của Mozart & Beethoven.
• 21:00 - Nghỉ giải lao (Teabreak).
• 21:30 - Phần 2: Trình diễn nhạc phim kinh điển kết hợp 3D Mapping.
• 22:30 - Kết thúc chương trình.

Lưu ý trang phục (Dress Code): Formal/Semi-formal (Lịch sự, khuyến khích mặc đồ màu trắng hoặc đen).`,
        tags: ['Classical', 'Orchestra', 'Instrumental'],
        svgStageMap: sampleSvg,
        startTime: getNiceDate(20, 20, 0), // 20 ngày sau, 20:00
        endTime: getNiceDate(20, 22, 30), // 20 ngày sau, 22:30
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: 'Grand Balcony',
            price: 2500000,
            totalQuantity: 50,
            maxPerUser: 2,
            saleStartTime: getNiceDate(-3, 10, 0),
            saleEndTime: getNiceDate(18, 20, 0),
          },
          {
            name: 'Floor Seat',
            price: 1500000,
            totalQuantity: 100,
            maxPerUser: 4,
            saleStartTime: getNiceDate(-3, 10, 0),
            saleEndTime: getNiceDate(18, 20, 0),
          },
          {
            name: 'Balcony',
            price: 800000,
            totalQuantity: 150,
            maxPerUser: 4,
            saleStartTime: getNiceDate(-3, 10, 0),
            saleEndTime: getNiceDate(18, 20, 0),
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
        biography: `RAP VIET LIVE CONCERT 2026

Đêm nhạc bùng nổ năng lượng của các thế hệ Rapper đình đám Việt Nam. Sân khấu 360 độ hiện đại bậc nhất đem đến góc nhìn mãn nhãn từ tất cả vị trí.

Dàn Line-up:
- Huấn luyện viên Rap Việt mùa mới nhất.
- Hàng chục Rapper trẻ đang thống trị bảng xếp hạng âm nhạc hiện nay.

Lịch trình chương trình:
• 17:30 - Mở cửa khu vực Fanzone đứng (SVIP Pit).
• 18:00 - Mở cửa các khu vực vé ngồi (VIP Stand, General Admission).
• 19:30 - DJ Set khởi động chương trình.
• 20:00 - Đêm nhạc chính thức bắt đầu.
• 23:30 - Kết thúc sự kiện.`,
        tags: ['HipHop', 'Rap', 'Live Concert'],
        svgStageMap: sampleSvg,
        startTime: getNiceDate(75, 20, 0), // 75 ngày sau, 20:00
        endTime: getNiceDate(75, 23, 30), // 75 ngày sau, 23:30
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: 'SVIP Pit',
            price: 3000000,
            totalQuantity: 300,
            maxPerUser: 2,
            saleStartTime: getNiceDate(0, 9, 0), // Mở bán hôm nay lúc 9:00
            saleEndTime: getNiceDate(60, 23, 30),
          },
          {
            name: 'VIP Stand',
            price: 2000000,
            totalQuantity: 1000,
            maxPerUser: 4,
            saleStartTime: getNiceDate(0, 9, 0),
            saleEndTime: getNiceDate(60, 23, 30),
          },
          {
            name: 'General Admission',
            price: 1000000,
            totalQuantity: 5000,
            maxPerUser: 4,
            saleStartTime: getNiceDate(0, 9, 0),
            saleEndTime: getNiceDate(70, 23, 30),
          },
        ],
      },
      {
        title: 'Jazz Under the Stars - Da Lat',
        description: 'Đêm nhạc Jazz lãng mạn dưới bầu trời đêm Đà Lạt mộng mơ.',
        location: 'Mây Lang Thang, Đà Lạt',
        posterUrl:
          'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
        biography: `JAZZ UNDER THE STARS - DA LAT

Thưởng thức nhạc Jazz sâu lắng trong không khí se lạnh của xứ sở ngàn hoa Đà Lạt. Dưới ánh nến lung linh và bầu trời đêm ngập tràn ánh sao.

Dàn nhạc & Khách mời:
- Saxophonist Trần Mạnh Tuấn cùng nhóm Jazz Saigon.
- Ca sĩ khách mời đặc biệt trình bày các bản tình khúc Trịnh Công Sơn phong cách Jazz.

Thời gian tổ chức:
• 18:30 - Đón khách và mời trà ấm/rượu vang nhẹ.
• 19:30 - Phần 1: Các bản nhạc Jazz cổ điển không lời.
• 20:30 - Phần 2: Trình diễn Jazz kết hợp ca sĩ khách mời.
• 22:00 - Đêm nhạc kết thúc.`,
        tags: ['Jazz', 'Acoustic', 'Chill'],
        svgStageMap: sampleSvg,
        startTime: getNiceDate(10, 19, 30), // 10 ngày sau, 19:30
        endTime: getNiceDate(10, 22, 0), // 10 ngày sau, 22:00
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: 'VIP Lounge',
            price: 1200000,
            totalQuantity: 100,
            maxPerUser: 4,
            saleStartTime: getNiceDate(-5, 9, 0),
            saleEndTime: getNiceDate(8, 12, 0),
          },
          {
            name: 'GA Standing',
            price: 600000,
            totalQuantity: 300,
            maxPerUser: 4,
            saleStartTime: getNiceDate(-5, 9, 0),
            saleEndTime: getNiceDate(9, 12, 0),
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
        biography: `EDM RAVE MANIA - NHA TRANG

Nhảy múa cùng các DJ hàng đầu thế giới trong đại tiệc âm nhạc điện tử lớn nhất mùa hè 2026 tại Nha Trang.

DJ Line-up:
- DJ Hardwell (Special Headliner)
- Hoaprox
- DJ Trang Moon

Lịch trình chương trình:
• 15:00 - Mở cửa kiểm soát vé và chào mừng bằng các DJ trẻ khu vực.
• 18:00 - Set nhạc của Hoaprox.
• 20:30 - Trình diễn chính của Headliner Hardwell với hiệu ứng pháo hoa nghệ thuật.
• 23:00 - Kết thúc sự kiện.`,
        tags: ['EDM', 'Electronic', 'Festival'],
        svgStageMap: sampleSvg,
        startTime: getNiceDate(90, 15, 0), // 90 ngày sau, 15:00
        endTime: getNiceDate(90, 23, 0), // 90 ngày sau, 23:00
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: 'VIP Pool Side',
            price: 1500000,
            totalQuantity: 500,
            maxPerUser: 4,
            saleStartTime: getNiceDate(5, 10, 0), // Mở bán sau 5 ngày lúc 10:00
            saleEndTime: getNiceDate(85, 23, 30),
          },
          {
            name: 'General Admission',
            price: 700000,
            totalQuantity: 4000,
            maxPerUser: 4,
            saleStartTime: getNiceDate(5, 10, 0),
            saleEndTime: getNiceDate(85, 23, 30),
          },
        ],
      },
      {
        title: 'Lover Tour - Da Nang (Draft)',
        description: 'Đêm nhạc trữ tình bên bờ biển Mỹ Khê xinh đẹp.',
        location: 'Công viên Biển Đông, Đà Nẵng',
        posterUrl:
          'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
        biography: `LOVER TOUR - DA NANG (DRAFT)

Live concert kết hợp giữa âm nhạc lãng mạn và không gian biển thơ mộng.
(Bản nháp đang trong quá trình lập cấu hình dự án của ban tổ chức).`,
        tags: ['Indie', 'Acoustic', 'Draft'],
        svgStageMap: undefined,
        startTime: getNiceDate(60, 19, 0),
        endTime: getNiceDate(60, 22, 0),
        status: ConcertStatus.DRAFT,
        ticketTypes: [
          {
            name: 'GA Standard',
            price: 500000,
            totalQuantity: 500,
            maxPerUser: 4,
            saleStartTime: getNiceDate(10, 9, 0),
            saleEndTime: getNiceDate(40, 21, 30),
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
        biography: `RETRO POP NIGHT - HUE

Giai điệu hoài niệm trong không gian hoàng cung Huế cổ kính. Tái hiện lại thời kỳ hoàng kim của nhạc Việt thập niên 90.
(Dự thảo dự án, chưa công bố chính thức).`,
        tags: ['Retro', 'Pop', 'Draft'],
        svgStageMap: undefined,
        startTime: getNiceDate(120, 19, 0),
        endTime: getNiceDate(120, 22, 0),
        status: ConcertStatus.DRAFT,
        ticketTypes: [
          {
            name: 'General Admission',
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
        biography: `FUTURE BASS FEST 2026 - CAN THO

Lễ hội âm nhạc điện tử kết hợp ẩm thực đặc trưng sông nước miền Tây.
(Sự kiện đã bị HỦY bỏ do điều kiện thời tiết không đảm bảo).`,
        tags: ['EDM', 'FutureBass', 'Cancelled'],
        svgStageMap: undefined,
        startTime: getNiceDate(150, 16, 0),
        endTime: getNiceDate(150, 22, 0),
        status: ConcertStatus.CANCELLED,
        ticketTypes: [
          {
            name: 'General Admission',
            price: 500000,
            totalQuantity: 2000,
            maxPerUser: 4,
          },
        ],
      },
      {
        title: 'Rap Viet Finals 2025 (Past)',
        description:
          'Đêm chung kết lịch sử tìm ra quán quân Rap Việt mùa tiếp theo đầy kịch tính.',
        location: 'Nhà thi đấu Phú Thọ, TP. Hồ Chí Minh',
        posterUrl:
          'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
        biography: `RAP VIET FINALS 2025 (PAST CONCERT)

Đêm chung kết lịch sử tìm ra quán quân thế hệ mới của nhạc Rap Việt Nam, quy tụ tất cả các huấn luyện viên, giám khảo và top 8 thí sinh xuất sắc nhất.

Line-up nghệ sĩ:
- Giám khảo & HLV: Suboi, Karik, JustaTee, BigDaddy, Andree Right Hand, Thái VG.
- Thí sinh biểu diễn: Top 8 chung cuộc biểu diễn solo và kết hợp cùng HLV.
- Khách mời đặc biệt: Chi Pu, Hoàng Thùy Linh, Double2T.

Lịch trình sự kiện (Timeline):
• 17:00 - Đón khách và soát vé VIP/Vip Guest.
• 18:00 - Mở cửa khán đài phổ thông (General Admission).
• 19:45 - Chương trình lên sóng truyền hình trực tiếp và bắt đầu biểu diễn.
• 23:30 - Công bố kết quả quán quân và bế mạc sự kiện.`,
        tags: ['Rap', 'HipHop', 'Completed'],
        svgStageMap: sampleSvg,
        startTime: getNiceDate(-30, 19, 30), // 30 ngày trước, 19:30
        endTime: getNiceDate(-30, 23, 30), // 30 ngày trước, 23:30
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: 'VIP Zone',
            price: 2500000,
            totalQuantity: 200,
            maxPerUser: 4,
            saleStartTime: getNiceDate(-60, 9, 0),
            saleEndTime: getNiceDate(-31, 18, 0),
          },
          {
            name: 'General Admission',
            price: 1000000,
            totalQuantity: 500,
            maxPerUser: 4,
            saleStartTime: getNiceDate(-60, 9, 0),
            saleEndTime: getNiceDate(-31, 18, 0),
          },
        ],
      },
      {
        title: 'Indie Sound Concert 2025 (Past)',
        description:
          'Đại hội âm nhạc Indie quy tụ những ca sĩ, ban nhạc Indie được yêu thích nhất.',
        location: 'Mây Lang Thang, Đà Lạt',
        posterUrl:
          'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
        biography: `INDIE SOUND CONCERT 2025 (PAST CONCERT)

Hòa mình vào không gian âm nhạc mộc mạc và lãng mạn giữa lòng thành phố sương mù Đà Lạt. Hàng ngàn khán giả đã cùng thăng hoa và hát vang những bản tình ca mộc mạc bên ánh lửa sưởi ấm đêm lạnh.

Dàn Line-up:
- Thịnh Suy
- Vũ.
- Phùng Khánh Linh
- Chillies Band

Thời gian diễn ra:
• 17:30 - Mở cửa đón khách tự do vào khu vực rừng thông.
• 18:30 - Đêm diễn bắt đầu với các bản Ballad mộc.
• 21:30 - Đêm nhạc kết thúc.`,
        tags: ['Indie', 'Acoustic', 'Completed'],
        svgStageMap: sampleSvg,
        startTime: getNiceDate(-15, 18, 30), // 15 ngày trước, 18:30
        endTime: getNiceDate(-15, 21, 30), // 15 ngày trước, 21:30
        status: ConcertStatus.ACTIVE,
        ticketTypes: [
          {
            name: 'VIP Seat',
            price: 1500000,
            totalQuantity: 50,
            maxPerUser: 4,
            saleStartTime: getNiceDate(-40, 9, 0),
            saleEndTime: getNiceDate(-16, 18, 0),
          },
          {
            name: 'General Admission',
            price: 700000,
            totalQuantity: 200,
            maxPerUser: 4,
            saleStartTime: getNiceDate(-40, 9, 0),
            saleEndTime: getNiceDate(-16, 18, 0),
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
