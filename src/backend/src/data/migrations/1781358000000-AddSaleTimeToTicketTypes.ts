import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSaleTimeToTicketTypes1781358000000 implements MigrationInterface {
    name = 'AddSaleTimeToTicketTypes1781358000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD "sale_start_time" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD "sale_end_time" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "chk_ticket_types_sale_time" CHECK (sale_end_time IS NULL OR sale_start_time IS NULL OR sale_end_time > sale_start_time)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "chk_ticket_types_sale_time"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP "sale_end_time"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP "sale_start_time"`);
    }
}
