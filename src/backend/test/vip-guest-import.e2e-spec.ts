import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from './../src/app.module';
import { Concert } from './../src/concert/entities/concert.entity';
import { VipGuest } from './../src/concert/entities/vip-guest.entity';
import { VipGuestImport } from './../src/concert/entities/vip-guest-import.entity';

describe('VIP Guest Import (e2e)', () => {
  let app: INestApplication<App>;
  let concertRepository: Repository<Concert>;
  let vipGuestRepository: Repository<VipGuest>;
  let vipGuestImportRepository: Repository<VipGuestImport>;
  let token: string;
  let concertId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    concertRepository = moduleFixture.get<Repository<Concert>>(getRepositoryToken(Concert));
    vipGuestRepository = moduleFixture.get<Repository<VipGuest>>(getRepositoryToken(VipGuest));
    vipGuestImportRepository = moduleFixture.get<Repository<VipGuestImport>>(getRepositoryToken(VipGuestImport));

    // 1. Login to obtain token
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'organizer@ticketbox.vn',
        password: '123123',
      })
      .expect(200);

    token = loginRes.body.accessToken;

    // 2. Fetch a concert
    const concert = await concertRepository.findOne({ where: {} });
    if (!concert) {
      throw new Error('Seed data missing: No concert found. Please run npm run db:seed');
    }
    concertId = concert.id;

    // Clean up any stale records from previous failed runs
    await vipGuestRepository.delete({ email: 'e2e_guest_a@example.com' });
    await vipGuestRepository.delete({ email: 'e2e_guest_b@example.com' });
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should successfully upload CSV, trigger import background job and verify results', async () => {
    // 1. Prepare CSV buffer
    const csvContent =
      'Full Name,Email,Phone,Company\n' +
      'E2E Guest A,e2e_guest_a@example.com,0912345678,Google\n' +
      'E2E Guest B,e2e_guest_b@example.com,0987654321,Meta\n' +
      'Invalid Email Guest,invalid-email-format,0901112222,InvalidCompany\n' +
      'Invalid Phone Guest,e2e_guest_c@example.com,123456,InvalidPhoneCompany\n' +
      'Duplicate Guest,e2e_guest_a@example.com,0902222222,DuplicateCompany\n';

    const fileBuffer = Buffer.from(csvContent);

    // 2. POST CSV import endpoint
    const importRes = await request(app.getHttpServer())
      .post(`/api/v1/concerts/${concertId}/guests/import`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fileBuffer, 'guests.csv')
      .expect(202);

    expect(importRes.body.message).toBe('VIP Guest list import started');
    expect(importRes.body.jobId).toBeDefined();

    const jobId = importRes.body.jobId;

    // 3. Poll status until complete (max 15 seconds)
    let status = 'pending';
    let jobRecord: any = null;

    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const statusRes = await request(app.getHttpServer())
        .get(`/api/v1/concerts/${concertId}/guests/imports/${jobId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      jobRecord = statusRes.body;
      status = jobRecord.status;

      if (status === 'completed' || status === 'failed') {
        break;
      }
    }

    // 4. Validate job import details
    expect(status).toBe('completed');
    expect(jobRecord.totalRows).toBe(5);
    expect(jobRecord.importedRows).toBe(2);

    // Verify fileUrl is excluded from response
    expect(jobRecord.fileUrl).toBeUndefined();

    // Check error logs
    expect(jobRecord.errorLogs).toBeDefined();
    expect(jobRecord.errorLogs.length).toBe(3);

    // Check errors
    const errorRows = jobRecord.errorLogs.map((e: any) => e.row);
    expect(errorRows).toContain(4); // Invalid Email Guest (line 4)
    expect(errorRows).toContain(5); // Invalid Phone Guest (line 5)
    expect(errorRows).toContain(6); // Duplicate Guest (line 6)

    // Check specific error messages
    const phoneError = jobRecord.errorLogs.find((e: any) => e.row === 5);
    expect(phoneError.reason).toContain('Invalid phone number format');

    // 5. Verify database records
    const importedGuests = await vipGuestRepository.find({
      where: { concertId },
    });

    const guestEmails = importedGuests.map((g) => g.email);
    expect(guestEmails).toContain('e2e_guest_a@example.com');
    expect(guestEmails).toContain('e2e_guest_b@example.com');
    expect(guestEmails).not.toContain('invalid-email-format');
    expect(guestEmails).not.toContain('e2e_guest_c@example.com');

    // 6. Test GET /concerts/:id/guests endpoint (pagination and search)
    // Query list as organizer (authenticated)
    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/concerts/${concertId}/guests`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listRes.body.data).toBeDefined();
    expect(listRes.body.meta).toBeDefined();
    expect(listRes.body.meta.totalItems).toBeGreaterThanOrEqual(2);
    expect(listRes.body.meta.currentPage).toBe(1);

    const listEmails = listRes.body.data.map((g: any) => g.email);
    expect(listEmails).toContain('e2e_guest_a@example.com');
    expect(listEmails).toContain('e2e_guest_b@example.com');

    // Query list with search
    const searchRes = await request(app.getHttpServer())
      .get(`/api/v1/concerts/${concertId}/guests?search=Guest A`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(searchRes.body.data.length).toBe(1);
    expect(searchRes.body.data[0].email).toBe('e2e_guest_a@example.com');

    // Test Role authorization (AUDIENCE should be forbidden)
    const audienceLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'audience@ticketbox.vn',
        password: '123123',
      })
      .expect(200);

    const audienceToken = audienceLoginRes.body.accessToken;

    await request(app.getHttpServer())
      .get(`/api/v1/concerts/${concertId}/guests`)
      .set('Authorization', `Bearer ${audienceToken}`)
      .expect(403);

    // Test Unauthenticated request (should be unauthorized 401)
    await request(app.getHttpServer())
      .get(`/api/v1/concerts/${concertId}/guests`)
      .expect(401);

    // 7. Clean up database records
    await vipGuestRepository.delete({ email: 'e2e_guest_a@example.com' });
    await vipGuestRepository.delete({ email: 'e2e_guest_b@example.com' });
    await vipGuestImportRepository.delete(jobId);

    // 8. Wait for async background consumers to finish
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }, 40000);
});
