import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotificationLogsCleanupIndex1781878800000 implements MigrationInterface {
    name = 'AddNotificationLogsCleanupIndex1781878800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_notification_logs_cleanup" ON "notification_logs" ("read_at") WHERE "status" = 'read'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_notification_logs_cleanup"`);
    }
}
