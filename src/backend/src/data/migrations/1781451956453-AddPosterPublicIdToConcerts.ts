import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPosterPublicIdToConcerts1781451956453 implements MigrationInterface {
  name = 'AddPosterPublicIdToConcerts1781451956453';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "concerts" ADD "poster_public_id" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "concerts" DROP COLUMN "poster_public_id"`,
    );
  }
}
