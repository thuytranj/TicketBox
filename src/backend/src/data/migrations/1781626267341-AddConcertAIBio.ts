import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConcertAIBio1781626267341 implements MigrationInterface {
  name = 'AddConcertAIBio1781626267341';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "concerts" RENAME COLUMN "summary" TO "biography"`,
    );
    await queryRunner.query(
      `CREATE TABLE "concert_ai_bios" ("concert_id" uuid NOT NULL, "raw_text" text NOT NULL, "draft_bio" text, "status" character varying(50) NOT NULL DEFAULT 'processing', "error" text, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1f8a841fdd6f5b2638ce3a0db0d" PRIMARY KEY ("concert_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "concert_ai_bios" ADD CONSTRAINT "FK_1f8a841fdd6f5b2638ce3a0db0d" FOREIGN KEY ("concert_id") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "concert_ai_bios" DROP CONSTRAINT "FK_1f8a841fdd6f5b2638ce3a0db0d"`,
    );
    await queryRunner.query(`DROP TABLE "concert_ai_bios"`);
    await queryRunner.query(
      `ALTER TABLE "concerts" RENAME COLUMN "biography" TO "summary"`,
    );
  }
}
