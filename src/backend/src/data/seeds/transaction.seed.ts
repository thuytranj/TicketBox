import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../../auth/entities/user.entity';
import { Concert } from '../../concert/entities/concert.entity';
import { TicketType } from '../../concert/entities/ticket-type.entity';
import { Order, OrderStatus } from '../../booking/entities/order.entity';
import { Ticket, TicketStatus } from '../../booking/entities/ticket.entity';
import { Payment, PaymentGateway, PaymentStatus } from '../../payment/entities/payment.entity';
import { CheckinLog, CheckinLogStatus } from '../../checkin/entities/checkin-log.entity';
import { VipGuest } from '../../concert/entities/vip-guest.entity';
import { CheckinStatus } from '../../common/enums/checkin-status.enum';
import { generateUuidV7 } from '../../auth/utils/uuid';

export default class TransactionSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<any> {
    const orderRepository = dataSource.getRepository(Order);
    const checkinLogRepository = dataSource.getRepository(CheckinLog);
    const userRepository = dataSource.getRepository(User);
    const concertRepository = dataSource.getRepository(Concert);
    const vipGuestRepository = dataSource.getRepository(VipGuest);

    const now = new Date();

    // 1. Lấy danh sách Gate Staff và Khán giả đã được seed
    const gateStaffs = await userRepository.find({
      where: { role: UserRole.GATE_STAFF },
    });
    const audiences = await userRepository.find({
      where: { role: UserRole.AUDIENCE },
    });

    if (gateStaffs.length === 0 || audiences.length === 0) {
      console.warn('[seed] Skip TransactionSeeder: No gate staff or audiences found in DB.');
      return;
    }

    // 2. Lấy toàn bộ các Concert kèm các TicketType của chúng
    const concerts = await concertRepository.find({
      relations: ['ticketTypes'],
    });

    // 3. Seed dữ liệu giao dịch động cho từng Concert
    for (const concert of concerts) {
      // Chỉ seed cho các concert ở trạng thái active
      if (concert.status !== 'active') {
        continue;
      }

      const exists = await orderRepository.findOne({
        where: { concertId: concert.id },
      });

      if (!exists) {
        const isPast = concert.startTime < now;
        let counts;

        if (isPast) {
          // Sự kiện trong quá khứ: nhiều check-in, một ít no-show (PAID nhưng chưa checkin)
          counts = {
            checkedInCount: Math.floor(Math.random() * 25) + 20, // 20 đến 44 đơn đã check-in
            paidCount: Math.floor(Math.random() * 4) + 1,        // 1 đến 4 đơn paid chưa check-in
            pendingCount: 0,                                     // Quá khứ không có pending
            cancelledCount: Math.floor(Math.random() * 5) + 2,   // 2 đến 6 đơn hủy
            expiredCount: Math.floor(Math.random() * 5) + 2,     // 2 đến 6 đơn hết hạn
          };
        } else {
          // Sự kiện trong tương lai: chưa check-in, chỉ có paid và pending
          counts = {
            checkedInCount: 0,
            paidCount: Math.floor(Math.random() * 20) + 10,      // 10 đến 29 đơn đã mua
            pendingCount: Math.floor(Math.random() * 6) + 2,     // 2 đến 7 đơn pending
            cancelledCount: Math.floor(Math.random() * 4) + 1,   // 1 đến 4 đơn hủy
            expiredCount: Math.floor(Math.random() * 4) + 1,     // 1 đến 4 đơn hết hạn
          };
        }

        console.log(`[seed] Seeding transactions for "${concert.title}" (isPast: ${isPast})...`);
        await this.seedTransactionsForConcert(
          dataSource,
          concert,
          audiences,
          gateStaffs,
          counts,
          isPast
        );
      }
    }

    // 4. Tạo CheckinLog cho khách mời VIP đã check-in (được seed ở VipGuestSeeder)
    console.log('[seed] Generating check-in logs for VIP Guests...');
    const checkedInVips = await vipGuestRepository.find({
      where: { checkinStatus: CheckinStatus.CHECKED_IN },
    });

    for (const vip of checkedInVips) {
      const logExists = await checkinLogRepository.findOne({
        where: { vipGuestId: vip.id },
      });
      if (!logExists) {
        const staff = gateStaffs[Math.floor(Math.random() * gateStaffs.length)];
        const concert = await concertRepository.findOne({ where: { id: vip.concertId } });
        
        // Thời điểm quét vé nằm trong khoảng thời gian diễn ra concert
        const scanTime = concert 
          ? new Date(concert.startTime.getTime() + 10 * 60 * 1000)
          : new Date();

        const log = checkinLogRepository.create({
          id: generateUuidV7(),
          ticketId: null,
          vipGuestId: vip.id,
          checkedBy: staff.id,
          scanTime,
          isOffline: false,
          deviceId: 'device_gate_vip',
          status: CheckinLogStatus.VALID,
        });
        await checkinLogRepository.save(log);
      }
    }
  }

  private async seedTransactionsForConcert(
    dataSource: DataSource,
    concert: Concert,
    audiences: User[],
    gateStaffs: User[],
    counts: {
      paidCount: number;
      checkedInCount: number;
      pendingCount: number;
      cancelledCount: number;
      expiredCount: number;
    },
    isPast: boolean
  ) {
    const orderRepository = dataSource.getRepository(Order);
    const ticketRepository = dataSource.getRepository(Ticket);
    const paymentRepository = dataSource.getRepository(Payment);
    const checkinLogRepository = dataSource.getRepository(CheckinLog);

    const ticketTypes = concert.ticketTypes;
    if (!ticketTypes || ticketTypes.length === 0) return;

    let userIndex = 0;
    const getNextAudience = () => {
      const user = audiences[userIndex];
      userIndex = (userIndex + 1) % audiences.length;
      return user;
    };

    const runSeed = async (status: OrderStatus, needCheckin: boolean, count: number) => {
      for (let i = 0; i < count; i++) {
        const audience = getNextAudience();
        const ticketType = ticketTypes[Math.floor(Math.random() * ticketTypes.length)];
        const qty = Math.floor(Math.random() * 2) + 1; // 1 hoặc 2 vé mỗi đơn
        const amount = ticketType.price * qty;

        // 1. Tạo Đơn Hàng (Order)
        // Thời gian tạo đơn hàng: Nếu concert trong quá khứ thì đơn hàng tạo trước concert từ 1 đến 15 ngày
        const orderDate = isPast
          ? new Date(concert.startTime.getTime() - (Math.floor(Math.random() * 14) + 1) * 24 * 60 * 60 * 1000 + i * 30 * 60 * 1000)
          : new Date(Date.now() - (Math.floor(Math.random() * 5) + 1) * 24 * 60 * 60 * 1000 - i * 60 * 60 * 1000);

        const order = orderRepository.create({
          id: generateUuidV7(),
          userId: audience.id,
          concertId: concert.id,
          status,
          totalAmount: amount,
          createdAt: orderDate,
        });
        await orderRepository.save(order);

        // 2. Tạo giao dịch Thanh Toán (Payment)
        let paymentStatus = PaymentStatus.PENDING;
        if (status === OrderStatus.PAID) {
          paymentStatus = PaymentStatus.SUCCESS;
        } else if (status === OrderStatus.CANCELLED || status === OrderStatus.EXPIRED) {
          paymentStatus = PaymentStatus.FAILED;
        }

        const gateway = Math.random() > 0.5 ? PaymentGateway.MOMO : PaymentGateway.VNPAY;
        const payment = paymentRepository.create({
          id: generateUuidV7(),
          orderId: order.id,
          gateway,
          transactionId: `TXN_${gateway.toUpperCase()}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          amount: amount,
          status: paymentStatus,
          createdAt: new Date(orderDate.getTime() + 5 * 60 * 1000), // Thanh toán sau 5 phút
          payUrl: 'https://payment.gateway/pay',
          rawResponse: { message: 'Mock response', code: paymentStatus === PaymentStatus.SUCCESS ? '00' : '99' },
        });
        await paymentRepository.save(payment);

        // 3. Tạo Vé (Ticket)
        // Vé chỉ tồn tại ở dạng Active hoặc Used nếu đơn hàng đã được thanh toán (PAID)
        // Nếu đơn hàng đang Pending thì vé ở dạng RESERVED
        if (status === OrderStatus.PAID || status === OrderStatus.PENDING) {
          const ticketsList: Ticket[] = [];
          for (let q = 0; q < qty; q++) {
            const ticketStatus = needCheckin 
              ? TicketStatus.USED 
              : (status === OrderStatus.PAID ? TicketStatus.ACTIVE : TicketStatus.RESERVED);

            const checkinStatus = needCheckin ? CheckinStatus.CHECKED_IN : CheckinStatus.NOT_CHECKED_IN;
            const checkedInAt = needCheckin 
              ? new Date(concert.startTime.getTime() + Math.floor(Math.random() * 120) * 60 * 1000) // check-in ngẫu nhiên trong vòng 2 tiếng sau giờ bắt đầu
              : null;

            const ticket = ticketRepository.create({
              id: generateUuidV7(),
              orderId: order.id,
              ticketTypeId: ticketType.id,
              qrCodeHash: `ticket_hash_${generateUuidV7().substring(0, 18)}`,
              status: ticketStatus,
              checkinStatus,
              checkedInAt,
            });
            ticketsList.push(ticket);
          }
          await ticketRepository.save(ticketsList);

          // 4. Tạo Lịch sử Soát Vé (CheckinLog) nếu đã checkin
          if (needCheckin) {
            for (const ticket of ticketsList) {
              const staff = gateStaffs[Math.floor(Math.random() * gateStaffs.length)];
              const log = checkinLogRepository.create({
                id: generateUuidV7(),
                ticketId: ticket.id,
                vipGuestId: null,
                checkedBy: staff.id,
                scanTime: ticket.checkedInAt || new Date(),
                isOffline: Math.random() > 0.8, // 20% soát vé offline
                deviceId: `device_gate_${Math.floor(Math.random() * 3) + 1}`,
                status: CheckinLogStatus.VALID,
              });
              await checkinLogRepository.save(log);
            }
          }
        }
      }
    };

    // Chạy tạo các đơn hàng tương ứng
    await runSeed(OrderStatus.PAID, true, counts.checkedInCount);
    await runSeed(OrderStatus.PAID, false, counts.paidCount);
    await runSeed(OrderStatus.PENDING, false, counts.pendingCount);
    await runSeed(OrderStatus.CANCELLED, false, counts.cancelledCount);
    await runSeed(OrderStatus.EXPIRED, false, counts.expiredCount);
  }
}
