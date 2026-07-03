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
    const ticketRepository = dataSource.getRepository(Ticket);
    const paymentRepository = dataSource.getRepository(Payment);
    const checkinLogRepository = dataSource.getRepository(CheckinLog);
    const userRepository = dataSource.getRepository(User);
    const concertRepository = dataSource.getRepository(Concert);
    const vipGuestRepository = dataSource.getRepository(VipGuest);

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

    // 2. Tìm các Concert cụ thể
    const rapVietPast = await concertRepository.findOne({
      where: { title: 'Rap Viet Finals 2025 (Past)' },
      relations: ['ticketTypes'],
    });

    const indiePast = await concertRepository.findOne({
      where: { title: 'Indie Sound Concert 2025 (Past)' },
      relations: ['ticketTypes'],
    });

    const erasTourFuture = await concertRepository.findOne({
      where: { title: 'The Eras Tour - Ho Chi Minh City' },
      relations: ['ticketTypes'],
    });

    // 3. Seed dữ liệu cho Concert Rap Viet Finals 2025 (Quá khứ)
    if (rapVietPast) {
      const exists = await orderRepository.findOne({
        where: { concertId: rapVietPast.id },
      });
      if (!exists) {
        console.log(`[seed] Seeding transactions for ${rapVietPast.title}...`);
        await this.seedTransactionsForConcert(
          dataSource,
          rapVietPast,
          audiences,
          gateStaffs,
          {
            paidCount: 3,        // PAID nhưng chưa check-in (no-show)
            checkedInCount: 12,  // PAID và đã check-in thành công
            pendingCount: 0,     // Sự kiện quá khứ không nên có pending
            cancelledCount: 2,   // Đã hủy
            expiredCount: 3,     // Đã hết hạn
          },
          true // là sự kiện trong quá khứ
        );
      }
    }

    // 4. Seed dữ liệu cho Concert Indie Sound Concert 2025 (Quá khứ)
    if (indiePast) {
      const exists = await orderRepository.findOne({
        where: { concertId: indiePast.id },
      });
      if (!exists) {
        console.log(`[seed] Seeding transactions for ${indiePast.title}...`);
        await this.seedTransactionsForConcert(
          dataSource,
          indiePast,
          audiences,
          gateStaffs,
          {
            paidCount: 2,
            checkedInCount: 8,
            pendingCount: 0,
            cancelledCount: 1,
            expiredCount: 1,
          },
          true
        );
      }
    }

    // 5. Seed dữ liệu cho Concert The Eras Tour - Ho Chi Minh City (Tương lai)
    if (erasTourFuture) {
      const exists = await orderRepository.findOne({
        where: { concertId: erasTourFuture.id },
      });
      if (!exists) {
        console.log(`[seed] Seeding transactions for ${erasTourFuture.title}...`);
        await this.seedTransactionsForConcert(
          dataSource,
          erasTourFuture,
          audiences,
          gateStaffs,
          {
            paidCount: 10,       // Vé đang active, sẵn sàng đi diễn
            checkedInCount: 0,   // Chưa diễn ra nên không có soát vé
            pendingCount: 4,     // Đơn hàng đang chờ thanh toán
            cancelledCount: 2,
            expiredCount: 2,
          },
          false // sự kiện tương lai
        );
      }
    }

    // 6. Tạo CheckinLog cho khách mời VIP đã check-in (được seed ở VipGuestSeeder)
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
        // Thời gian tạo đơn hàng: Nếu concert trong quá khứ thì đơn hàng tạo trước concert 15 ngày
        const orderDate = isPast
          ? new Date(concert.startTime.getTime() - 15 * 24 * 60 * 60 * 1000 + i * 60 * 60 * 1000)
          : new Date(Date.now() - i * 60 * 60 * 1000);

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
