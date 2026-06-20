import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1781020486759 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" UUID NOT NULL,
                "email" character varying(255) NOT NULL,
                "password_hash" character varying(255) NOT NULL,
                "full_name" character varying(255) NOT NULL,
                "role" character varying(50) NOT NULL DEFAULT 'audience',
                "status" character varying(50) NOT NULL DEFAULT 'pending',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_users_email" UNIQUE ("email"),
                CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_users_role" CHECK (role IN ('audience', 'organizer', 'gate_staff')),
                CONSTRAINT "CHK_users_status" CHECK (status IN ('pending', 'active'))
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
