import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateConcertAndTicketType1781357447148 implements MigrationInterface {
    name = 'CreateConcertAndTicketType1781357447148'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_role"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_status"`);
        await queryRunner.query(`CREATE TABLE "concerts" ("id" uuid NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL, "location" character varying(255) NOT NULL, "poster_url" character varying(500), "summary" text, "tags" character varying(50) array NOT NULL DEFAULT '{}', "svg_stage_map" text, "start_time" TIMESTAMP NOT NULL, "end_time" TIMESTAMP NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'draft', "reminder_sent" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6ca96059628588a3988a5f3236a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ticket_types" ("id" uuid NOT NULL, "concert_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "price" numeric(12,2) NOT NULL, "total_quantity" integer NOT NULL, "available_quantity" integer NOT NULL, "max_per_user" integer NOT NULL DEFAULT '4', CONSTRAINT "PK_5510ce7e18a4edc648c9fbfc283" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "FK_bcb2c8c129a8b1673bddd479df9" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        
        // Custom indexes and constraints
        await queryRunner.query(`CREATE INDEX "idx_concerts_tags" ON "concerts" USING gin ("tags")`);
        await queryRunner.query(`CREATE INDEX "idx_concerts_location_status" ON "concerts" ("location", "status")`);
        await queryRunner.query(`CREATE INDEX "idx_ticket_types_concert_id" ON "ticket_types" ("concert_id")`);
        await queryRunner.query(`ALTER TABLE "ticket_types" ADD CONSTRAINT "uq_concert_ticket_type_name" UNIQUE ("concert_id", "name")`);
        await queryRunner.query(`ALTER TABLE "concerts" ADD CONSTRAINT "CHK_concerts_status" CHECK (status IN ('draft', 'active', 'cancelled'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "concerts" DROP CONSTRAINT "CHK_concerts_status"`);
        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "uq_concert_ticket_type_name"`);
        await queryRunner.query(`DROP INDEX "idx_ticket_types_concert_id"`);
        await queryRunner.query(`DROP INDEX "idx_concerts_location_status"`);
        await queryRunner.query(`DROP INDEX "idx_concerts_tags"`);

        await queryRunner.query(`ALTER TABLE "ticket_types" DROP CONSTRAINT "FK_bcb2c8c129a8b1673bddd479df9"`);
        await queryRunner.query(`DROP TABLE "ticket_types"`);
        await queryRunner.query(`DROP TABLE "concerts"`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "CHK_users_status" CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying])::text[])))`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "CHK_users_role" CHECK (((role)::text = ANY ((ARRAY['audience'::character varying, 'organizer'::character varying, 'gate_staff'::character varying])::text[])))`);
    }

}

