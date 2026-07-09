import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdatePastConcertsToCompleted1783614192291 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE "concerts" SET "status" = 'completed' WHERE "status" = 'active' AND "end_time" < NOW();`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE "concerts" SET "status" = 'active' WHERE "status" = 'completed';`
        );
    }

}
