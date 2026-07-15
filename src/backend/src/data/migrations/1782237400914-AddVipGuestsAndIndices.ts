import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVipGuestsAndIndices1782237400914 implements MigrationInterface {
    name = 'AddVipGuestsAndIndices1782237400914'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_order_id"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_ticket_type_id"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_user_id"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_concert_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_ticket_types_concert_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_concerts_tags"`);
        await queryRunner.query(`DROP INDEX "public"."idx_concerts_location_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_tickets_order_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_status_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notification_logs_cleanup"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "chk_ticket_types_sale_time"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "chk_ticket_types_name"`);
        await queryRunner.query(`ALTER TABLE "concerts" DROP CONSTRAINT "CHK_concerts_status"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "CHK_tickets_status"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "CHK_orders_status"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "uq_concert_ticket_type_name"`);
        await queryRunner.query(`CREATE TABLE "vip_guests" ("id" uuid NOT NULL, "concert_id" uuid NOT NULL, "full_name" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "phone" character varying(50), "affiliate_company" character varying(255), "qr_code_hash" character varying(500) NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fbfcfeefd0260778e44a72acf7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4e7a02af7d9f2b4a60fe8a3ea9" ON "vip_guests" ("concert_id", "email") `);
        await queryRunner.query(`CREATE TABLE "vip_guest_imports" ("id" uuid NOT NULL, "concert_id" uuid NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'pending', "total_rows" integer NOT NULL DEFAULT '0', "imported_rows" integer NOT NULL DEFAULT '0', "error_logs" jsonb, "file_url" character varying(1000), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8dabb564a278790eb2e1fbccc1b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c3696f15886983fda54f21a321" ON "vip_guest_imports" ("concert_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_b2f7b823a21562eeca20e72b00" ON "payments" ("order_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a922b820eeef29ac1c6800e826" ON "orders" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b8a806ead6ca04fb91112e4126" ON "orders" ("concert_id") `);
        await queryRunner.query(`ALTER TABLE "vip_guests" ADD CONSTRAINT "FK_26a1838a546f3d6ae1e5f5a08bf" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vip_guest_imports" ADD CONSTRAINT "FK_e524edb27d7d531c2b8c1dbe3d5" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_bd5636236f799b19f132abf8d70" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_a95369aeea12da7fde110e95e00" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_a922b820eeef29ac1c6800e826a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_b8a806ead6ca04fb91112e41260" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_b8a806ead6ca04fb91112e41260"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_a922b820eeef29ac1c6800e826a"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_a95369aeea12da7fde110e95e00"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_bd5636236f799b19f132abf8d70"`);
        await queryRunner.query(`ALTER TABLE "vip_guest_imports" DROP CONSTRAINT "FK_e524edb27d7d531c2b8c1dbe3d5"`);
        await queryRunner.query(`ALTER TABLE "vip_guests" DROP CONSTRAINT "FK_26a1838a546f3d6ae1e5f5a08bf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b8a806ead6ca04fb91112e4126"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a922b820eeef29ac1c6800e826"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b2f7b823a21562eeca20e72b00"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c3696f15886983fda54f21a321"`);
        await queryRunner.query(`DROP TABLE "vip_guest_imports"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4e7a02af7d9f2b4a60fe8a3ea9"`);
        await queryRunner.query(`DROP TABLE "vip_guests"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "uq_concert_ticket_type_name" UNIQUE ("concert_id", "name")`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "CHK_orders_status" CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'expired'::character varying, 'cancelled'::character varying])::text[])))`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "CHK_tickets_status" CHECK (((status)::text = ANY ((ARRAY['reserved'::character varying, 'active'::character varying, 'used'::character varying])::text[])))`);
        await queryRunner.query(`ALTER TABLE "concerts" ADD CONSTRAINT "CHK_concerts_status" CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'cancelled'::character varying])::text[])))`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "chk_ticket_types_name" CHECK (((name)::text = ANY ((ARRAY['GA'::character varying, 'SVIP'::character varying, 'VIP'::character varying, 'CAT1'::character varying, 'CAT2'::character varying])::text[])))`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "chk_ticket_types_sale_time" CHECK (((sale_end_time IS NULL) OR (sale_start_time IS NULL) OR (sale_end_time > sale_start_time)))`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_logs_cleanup" ON "notification_logs" ("read_at") WHERE ((status)::text = 'read'::text)`);
        await queryRunner.query(`CREATE INDEX "idx_orders_status_created_at" ON "orders" ("status", "created_at") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_user_id" ON "orders" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "idx_tickets_order_id" ON "tickets" ("order_id") `);
        await queryRunner.query(`CREATE INDEX "idx_concerts_location_status" ON "concerts" ("location", "status") `);
        await queryRunner.query(`CREATE INDEX "idx_concerts_tags" ON "concerts" ("tags") `);
        await queryRunner.query(`CREATE INDEX "idx_ticket_types_concert_id" ON "ticket_types" ("concert_id") `);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_concert_id" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_tickets_ticket_type_id" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_tickets_order_id" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
