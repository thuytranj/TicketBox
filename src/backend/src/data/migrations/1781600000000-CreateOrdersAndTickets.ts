import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrdersAndTickets1781600000000 implements MigrationInterface {
  name = 'CreateOrdersAndTickets1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create orders table
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "concert_id" uuid NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'pending',
        "total_amount" numeric(12,2) NOT NULL,
        "idempotency_key" character varying(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_orders_idempotency_key" UNIQUE ("idempotency_key")
      )
    `);

    // Create tickets table
    await queryRunner.query(`
      CREATE TABLE "tickets" (
        "id" uuid NOT NULL,
        "order_id" uuid NOT NULL,
        "ticket_type_id" uuid NOT NULL,
        "qr_code" character varying(500),
        "status" character varying(50) NOT NULL DEFAULT 'reserved',
        CONSTRAINT "PK_tickets" PRIMARY KEY ("id")
      )
    `);

    // Add constraints and indexes for orders
    await queryRunner.query(`
      ALTER TABLE "orders" ADD CONSTRAINT "CHK_orders_status"
        CHECK (status IN ('pending', 'paid', 'expired', 'cancelled'))
    `);
    await queryRunner.query(`
      ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_user_id"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_concert_id"
        FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_orders_user_id" ON "orders" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_status_created_at" ON "orders" ("status", "created_at")`,
    );

    // Add constraints and indexes for tickets
    await queryRunner.query(`
      ALTER TABLE "tickets" ADD CONSTRAINT "CHK_tickets_status"
        CHECK (status IN ('reserved', 'active', 'used'))
    `);
    await queryRunner.query(`
      ALTER TABLE "tickets" ADD CONSTRAINT "FK_tickets_order_id"
        FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "tickets" ADD CONSTRAINT "FK_tickets_ticket_type_id"
        FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_tickets_order_id" ON "tickets" ("order_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_tickets_order_id"`);
    await queryRunner.query(
      `ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_ticket_type_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_order_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tickets" DROP CONSTRAINT "CHK_tickets_status"`,
    );
    await queryRunner.query(`DROP TABLE "tickets"`);

    await queryRunner.query(`DROP INDEX "idx_orders_status_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_orders_user_id"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_concert_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "CHK_orders_status"`,
    );
    await queryRunner.query(`DROP TABLE "orders"`);
  }
}
