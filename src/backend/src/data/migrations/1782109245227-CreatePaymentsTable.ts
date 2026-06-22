import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePaymentsTable1782109245227 implements MigrationInterface {
    name = 'CreatePaymentsTable1782109245227'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL, "order_id" uuid NOT NULL, "gateway" character varying(20) NOT NULL, "transaction_id" character varying(255), "amount" numeric(12,2) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "pay_url" text, "raw_response" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_b2f7b823a21562eeca20e72b006" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_b2f7b823a21562eeca20e72b006"`);
        await queryRunner.query(`DROP TABLE "payments"`);
    }

}
