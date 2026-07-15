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
      // Chỉ seed cho các concert ở trạng thái active hoặc completed
      if (concert.status !== 'active' && concert.status !== 'completed') {
        continue;
      }

      const isPast = concert.startTime < now;
      const hasActiveTicketSale = concert.ticketTypes.some(
        (tt) => tt.saleStartTime <= now && tt.saleEndTime >= now
      );

      // Chỉ seed cho concert đã qua hoặc đang mở bán vé
      if (!isPast && !hasActiveTicketSale) {
        console.log(`[seed] Skipping "${concert.title}" (not past and sales not active now). Cleaning up any old transactions...`);
        const oldOrders = await orderRepository.find({ where: { concertId: concert.id } });
        for (const order of oldOrders) {
          const tickets = await dataSource.getRepository(Ticket).find({ where: { orderId: order.id } });
          for (const ticket of tickets) {
            await dataSource.getRepository(CheckinLog).delete({ ticketId: ticket.id });
            await dataSource.getRepository(Ticket).delete({ id: ticket.id });
          }
          await dataSource.getRepository(Payment).delete({ orderId: order.id });
          await orderRepository.delete({ id: order.id });
        }
        for (const tt of concert.ticketTypes) {
          tt.availableQuantity = tt.totalQuantity;
          await dataSource.getRepository(TicketType).save(tt);
        }
        continue;
      }

      // Dọn dẹp bất kỳ order/payment/ticket/checkin cũ nào của concert này để tránh trùng lặp
      const oldOrders = await orderRepository.find({ where: { concertId: concert.id } });
      for (const order of oldOrders) {
        const tickets = await dataSource.getRepository(Ticket).find({ where: { orderId: order.id } });
        for (const ticket of tickets) {
          await dataSource.getRepository(CheckinLog).delete({ ticketId: ticket.id });
          await dataSource.getRepository(Ticket).delete({ id: ticket.id });
        }
        await dataSource.getRepository(Payment).delete({ orderId: order.id });
        await orderRepository.delete({ id: order.id });
      }

      // Reset lại availableQuantity về totalQuantity
      for (const tt of concert.ticketTypes) {
        tt.availableQuantity = tt.totalQuantity;
        await dataSource.getRepository(TicketType).save(tt);
      }

      let counts;

      if (isPast) {
        // Lấy tổng số lượng vé phát hành của concert
        const totalCapacity = concert.ticketTypes.reduce((sum, tt) => sum + tt.totalQuantity, 0);
        
        // Mục tiêu tỷ lệ lấp đầy (fill rate) cao cho sự kiện quá khứ: 75% - 95%
        const targetFillRate = 0.75 + Math.random() * 0.20;
        const targetTicketsSold = Math.floor(totalCapacity * targetFillRate);
        
        // Mỗi đơn hàng trung bình mua 1.5 vé -> tính số lượng đơn hàng paid tương ứng
        const totalPaidOrders = Math.floor(targetTicketsSold / 1.5);
        
        // Tỷ lệ check-in cao cho các đơn hàng đã thanh toán (85% - 95% số vé đã mua được check-in)
        const targetCheckinRate = 0.85 + Math.random() * 0.10;
        const checkedInCount = Math.floor(totalPaidOrders * targetCheckinRate);
        const paidCount = Math.max(0, totalPaidOrders - checkedInCount);

        counts = {
          checkedInCount,
          paidCount,
          pendingCount: 0,                                     // Quá khứ không có pending
          cancelledCount: Math.floor(Math.random() * 10) + 5,  // 5 đến 14 đơn hủy
          expiredCount: Math.floor(Math.random() * 10) + 5,    // 5 đến 14 đơn hết hạn
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
        const availableTypes = ticketTypes.filter(tt => tt.availableQuantity > 0);
        if (availableTypes.length === 0) {
          break;
        }
        const ticketType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        const qty = Math.min(Math.floor(Math.random() * 2) + 1, ticketType.availableQuantity);
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

          // Cập nhật số lượng vé còn lại trong DB để thống kê chính xác
          ticketType.availableQuantity = Math.max(0, ticketType.availableQuantity - qty);
          await dataSource.getRepository(TicketType).save(ticketType);

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
