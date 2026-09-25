import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPathVisibility1790322295052 implements MigrationInterface {
    name = 'AddPathVisibility1790322295052';

    async up( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `DROP INDEX "public"."IDX_a1d1c0d80da282e26a73641056"` );
        await queryRunner.query( `CREATE TYPE "public"."path_visibility" AS ENUM('private', 'public')` );
        await queryRunner.query( `ALTER TABLE "learning_paths" ADD "visibility" "public"."path_visibility" NOT NULL DEFAULT 'private'` );
        // Added by hand: global catalog paths are always public.
        await queryRunner.query( `UPDATE "learning_paths" SET "visibility" = 'public' WHERE "organization_id" IS NULL` );
        await queryRunner.query( `ALTER TABLE "learning_paths" DROP CONSTRAINT "UQ_20e80314f6a5daa35922f25ad44"` );
        await queryRunner.query( `CREATE UNIQUE INDEX "uq_learning_paths_organization_slug" ON "learning_paths"  ("organization_id", "slug") WHERE "organization_id" IS NOT NULL` );
        await queryRunner.query( `CREATE UNIQUE INDEX "uq_learning_paths_global_slug" ON "learning_paths"  ("slug") WHERE "organization_id" IS NULL` );
    }

    async down( queryRunner: QueryRunner ): Promise<void> {
        // Fails if two organizations (or an organization and the global catalog) use the same slug by then.
        await queryRunner.query( `DROP INDEX "public"."uq_learning_paths_global_slug"` );
        await queryRunner.query( `DROP INDEX "public"."uq_learning_paths_organization_slug"` );
        await queryRunner.query( `ALTER TABLE "learning_paths" ADD CONSTRAINT "UQ_20e80314f6a5daa35922f25ad44" UNIQUE ("slug")` );
        await queryRunner.query( `ALTER TABLE "learning_paths" DROP COLUMN "visibility"` );
        await queryRunner.query( `DROP TYPE "public"."path_visibility"` );
        await queryRunner.query( `CREATE INDEX "IDX_a1d1c0d80da282e26a73641056" ON "learning_paths" USING btree ("organization_id") ` );
    }
}
