import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCheckinSupport1782400000000 implements MigrationInterface {
  name = 'AddCheckinSupport1782400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // 1. ALTER TABLE "tickets" — add checkin columns + rename qr_code
    // ============================================================

    // Rename qr_code → qr_code_hash
    await queryRunner.query(
      `ALTER TABLE "tickets" RENAME COLUMN "qr_code" TO "qr_code_hash"`,
    );

    // Add UNIQUE index on qr_code_hash
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tickets_qr_code_hash" ON "tickets" ("qr_code_hash") WHERE "qr_code_hash" IS NOT NULL`,
    );

    // Add checkin_status column
    await queryRunner.query(`
      ALTER TABLE "tickets"
        ADD COLUMN "checkin_status" character varying(50) NOT NULL DEFAULT 'not_checked_in'
    `);

    // Add CHECK constraint for checkin_status
    await queryRunner.query(`
      ALTER TABLE "tickets"
        ADD CONSTRAINT "CHK_tickets_checkin_status"
        CHECK (checkin_status IN ('not_checked_in', 'checked_in'))
    `);

    // Add checked_in_at column
    await queryRunner.query(`
      ALTER TABLE "tickets"
        ADD COLUMN "checked_in_at" TIMESTAMP
    `);

    // ============================================================
    // 2. ALTER TABLE "vip_guests" — add checkin columns
    // ============================================================

    // Add checkin_status column
    await queryRunner.query(`
      ALTER TABLE "vip_guests"
        ADD COLUMN "checkin_status" character varying(50) NOT NULL DEFAULT 'not_checked_in'
    `);

    // Add CHECK constraint for checkin_status
    await queryRunner.query(`
      ALTER TABLE "vip_guests"
        ADD CONSTRAINT "CHK_vip_guests_checkin_status"
        CHECK (checkin_status IN ('not_checked_in', 'checked_in'))
    `);

    // Add checked_in_at column
    await queryRunner.query(`
      ALTER TABLE "vip_guests"
        ADD COLUMN "checked_in_at" TIMESTAMP
    `);

    // ============================================================
    // 3. CREATE TABLE "checkin_logs"
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE "checkin_logs" (
        "id" uuid NOT NULL,
        "ticket_id" uuid,
        "vip_guest_id" uuid,
        "checked_by" uuid NOT NULL,
        "scan_time" TIMESTAMP NOT NULL DEFAULT now(),
        "is_offline" boolean NOT NULL DEFAULT false,
        "device_id" character varying(255) NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'valid',
        CONSTRAINT "PK_checkin_logs" PRIMARY KEY ("id")
      )
    `);

    // CHECK: exactly one of ticket_id or vip_guest_id must be non-null
    await queryRunner.query(`
      ALTER TABLE "checkin_logs"
        ADD CONSTRAINT "CHK_checkin_logs_ticket_or_vip"
        CHECK (
          (ticket_id IS NOT NULL AND vip_guest_id IS NULL)
          OR
          (ticket_id IS NULL AND vip_guest_id IS NOT NULL)
        )
    `);

    // CHECK: status values
    await queryRunner.query(`
      ALTER TABLE "checkin_logs"
        ADD CONSTRAINT "CHK_checkin_logs_status"
        CHECK (status IN ('valid', 'invalidated_fraud'))
    `);

    // Foreign keys
    await queryRunner.query(`
      ALTER TABLE "checkin_logs"
        ADD CONSTRAINT "FK_checkin_logs_ticket_id"
        FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "checkin_logs"
        ADD CONSTRAINT "FK_checkin_logs_vip_guest_id"
        FOREIGN KEY ("vip_guest_id") REFERENCES "vip_guests"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "checkin_logs"
        ADD CONSTRAINT "FK_checkin_logs_checked_by"
        FOREIGN KEY ("checked_by") REFERENCES "users"("id") ON DELETE RESTRICT
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX "idx_checkin_logs_ticket_id" ON "checkin_logs" ("ticket_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_checkin_logs_vip_guest_id" ON "checkin_logs" ("vip_guest_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_checkin_logs_scan_time" ON "checkin_logs" ("scan_time")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop checkin_logs
    await queryRunner.query(`DROP INDEX "idx_checkin_logs_scan_time"`);
    await queryRunner.query(`DROP INDEX "idx_checkin_logs_vip_guest_id"`);
    await queryRunner.query(`DROP INDEX "idx_checkin_logs_ticket_id"`);
    await queryRunner.query(
      `ALTER TABLE "checkin_logs" DROP CONSTRAINT "FK_checkin_logs_checked_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "checkin_logs" DROP CONSTRAINT "FK_checkin_logs_vip_guest_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "checkin_logs" DROP CONSTRAINT "FK_checkin_logs_ticket_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "checkin_logs" DROP CONSTRAINT "CHK_checkin_logs_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "checkin_logs" DROP CONSTRAINT "CHK_checkin_logs_ticket_or_vip"`,
    );
    await queryRunner.query(`DROP TABLE "checkin_logs"`);

    // Revert vip_guests
    await queryRunner.query(
      `ALTER TABLE "vip_guests" DROP COLUMN "checked_in_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vip_guests" DROP CONSTRAINT "CHK_vip_guests_checkin_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vip_guests" DROP COLUMN "checkin_status"`,
    );

    // Revert tickets
    await queryRunner.query(
      `ALTER TABLE "tickets" DROP COLUMN "checked_in_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" DROP CONSTRAINT "CHK_tickets_checkin_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" DROP COLUMN "checkin_status"`,
    );
    await queryRunner.query(`DROP INDEX "uq_tickets_qr_code_hash"`);
    await queryRunner.query(
      `ALTER TABLE "tickets" RENAME COLUMN "qr_code_hash" TO "qr_code"`,
    );
  }
}
