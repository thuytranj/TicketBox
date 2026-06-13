import { MigrationInterface, QueryRunner } from "typeorm";

export class RestrictTicketTypeNames1781358600000 implements MigrationInterface {
    name = 'RestrictTicketTypeNames1781358600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "chk_ticket_types_name" CHECK (name IN ('GA', 'SVIP', 'VIP', 'CAT1', 'CAT2'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "chk_ticket_types_name"`);
    }
}
