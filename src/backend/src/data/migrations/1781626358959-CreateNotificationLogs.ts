import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotificationLogs1781626358959 implements MigrationInterface {
    name = 'CreateNotificationLogs1781626358959'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notification_logs" ("id" BIGSERIAL NOT NULL, "user_id" uuid NOT NULL, "type" character varying(50) NOT NULL, "title" character varying(255) NOT NULL, "body" text NOT NULL, "channel" character varying(50) NOT NULL DEFAULT 'in_app', "status" character varying(50) NOT NULL DEFAULT 'unread', "reference_id" uuid, "read_at" TIMESTAMP, "sent_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_19c524e644cdeaebfcffc284871" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "notification_logs"`);
    }

}
