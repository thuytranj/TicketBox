import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDatabaseIndexes1783087763251 implements MigrationInterface {
    name = 'AddDatabaseIndexes1783087763251'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "checkin_logs" DROP CONSTRAINT "FK_checkin_logs_checked_by"`);
        await queryRunner.query(`ALTER TABLE "checkin_logs" DROP CONSTRAINT "FK_checkin_logs_vip_guest_id"`);
        await queryRunner.query(`ALTER TABLE "checkin_logs" DROP CONSTRAINT "FK_checkin_logs_ticket_id"`);
        await queryRunner.query(`DROP INDEX "public"."uq_tickets_qr_code_hash"`);
        await queryRunner.query(`DROP INDEX "public"."idx_checkin_logs_ticket_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_checkin_logs_vip_guest_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_checkin_logs_scan_time"`);
        await queryRunner.query(`ALTER TABLE "vip_guests" DROP CONSTRAINT "CHK_vip_guests_checkin_status"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "CHK_tickets_checkin_status"`);
        await queryRunner.query(`ALTER TABLE "checkin_logs" DROP CONSTRAINT "CHK_checkin_logs_ticket_or_vip"`);
        await queryRunner.query(`ALTER TABLE "checkin_logs" DROP CONSTRAINT "CHK_checkin_logs_status"`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "UQ_2b913371491182eba38b75b465e" UNIQUE ("qr_code_hash")`);
        await queryRunner.query(`CREATE INDEX "IDX_bcb2c8c129a8b1673bddd479df" ON "ticket_types" ("concert_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3bc2498facc0f964d69f828f84" ON "vip_guests" ("qr_code_hash") `);
        await queryRunner.query(`CREATE INDEX "IDX_cd010beed317f44124943e5f30" ON "concerts" ("status", "start_time") `);
        await queryRunner.query(`CREATE INDEX "IDX_bd5636236f799b19f132abf8d7" ON "tickets" ("order_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a95369aeea12da7fde110e95e0" ON "tickets" ("ticket_type_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_0a8af465a50a2896d243692812" ON "notification_logs" ("user_id", "channel", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e4d3266e6037e5d0cb9274256" ON "checkin_logs" ("ticket_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_9c4461bdd481b0ca9ff27dd3c0" ON "checkin_logs" ("vip_guest_id") `);
        await queryRunner.query(`ALTER TABLE "checkin_logs" ADD CONSTRAINT "FK_5e4d3266e6037e5d0cb92742562" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "checkin_logs" ADD CONSTRAINT "FK_9c4461bdd481b0ca9ff27dd3c00" FOREIGN KEY ("vip_guest_id") REFERENCES "vip_guests"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "checkin_logs" ADD CONSTRAINT "FK_9ac8a57a202d56fafdbc52605ac" FOREIGN KEY ("checked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "checkin_logs" DROP CONSTRAINT "FK_9ac8a57a202d56fafdbc52605ac"`);
        await queryRunner.query(`ALTER TABLE "checkin_logs" DROP CONSTRAINT "FK_9c4461bdd481b0ca9ff27dd3c00"`);
        await queryRunner.query(`ALTER TABLE "checkin_logs" DROP CONSTRAINT "FK_5e4d3266e6037e5d0cb92742562"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9c4461bdd481b0ca9ff27dd3c0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e4d3266e6037e5d0cb9274256"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0a8af465a50a2896d243692812"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a95369aeea12da7fde110e95e0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bd5636236f799b19f132abf8d7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cd010beed317f44124943e5f30"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3bc2498facc0f964d69f828f84"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bcb2c8c129a8b1673bddd479df"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "UQ_2b913371491182eba38b75b465e"`);
        await queryRunner.query(`ALTER TABLE "checkin_logs" ADD CONSTRAINT "CHK_checkin_logs_status" CHECK (((status)::text = ANY ((ARRAY['valid'::character varying, 'invalidated_fraud'::character varying])::text[])))`);
        await queryRunner.query(`ALTER TABLE "checkin_logs" ADD CONSTRAINT "CHK_checkin_logs_ticket_or_vip" CHECK ((((ticket_id IS NOT NULL) AND (vip_guest_id IS NULL)) OR ((ticket_id IS NULL) AND (vip_guest_id IS NOT NULL))))`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "CHK_tickets_checkin_status" CHECK (((checkin_status)::text = ANY ((ARRAY['not_checked_in'::character varying, 'checked_in'::character varying])::text[])))`);
        await queryRunner.query(`ALTER TABLE "vip_guests" ADD CONSTRAINT "CHK_vip_guests_checkin_status" CHECK (((checkin_status)::text = ANY ((ARRAY['not_checked_in'::character varying, 'checked_in'::character varying])::text[])))`);
        await queryRunner.query(`CREATE INDEX "idx_checkin_logs_scan_time" ON "checkin_logs" ("scan_time") `);
        await queryRunner.query(`CREATE INDEX "idx_checkin_logs_vip_guest_id" ON "checkin_logs" ("vip_guest_id") `);
        await queryRunner.query(`CREATE INDEX "idx_checkin_logs_ticket_id" ON "checkin_logs" ("ticket_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_tickets_qr_code_hash" ON "tickets" ("qr_code_hash") WHERE (qr_code_hash IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "checkin_logs" ADD CONSTRAINT "FK_checkin_logs_ticket_id" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "checkin_logs" ADD CONSTRAINT "FK_checkin_logs_vip_guest_id" FOREIGN KEY ("vip_guest_id") REFERENCES "vip_guests"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "checkin_logs" ADD CONSTRAINT "FK_checkin_logs_checked_by" FOREIGN KEY ("checked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
