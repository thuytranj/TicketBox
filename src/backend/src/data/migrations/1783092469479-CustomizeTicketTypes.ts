import { MigrationInterface, QueryRunner } from "typeorm";

export class CustomizeTicketTypes1783092469479 implements MigrationInterface {
    name = 'CustomizeTicketTypes1783092469479'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "uq_concert_ticket_type_name" UNIQUE ("concert_id", "name")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "uq_concert_ticket_type_name"`);
    }

}
