import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvitationsAndReports1790329588271 implements MigrationInterface {
    name = 'AddInvitationsAndReports1790329588271';

    async up( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `CREATE TABLE "organization_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "email" character varying(255) NOT NULL, "role" "public"."organization_role" NOT NULL, "invited_by_id" uuid, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_organization_invitations_organization_email" UNIQUE ("organization_id", "email"), CONSTRAINT "PK_f172f12b8a9ee6584b661f57e24" PRIMARY KEY ("id"))` );
        await queryRunner.query( `CREATE INDEX "IDX_c1d63ed5127c053e50abcdbce5" ON "organization_invitations"  ("email") ` );
        await queryRunner.query( `CREATE TYPE "public"."report_reason" AS ENUM('spam', 'inappropriate', 'copyright', 'other')` );
        await queryRunner.query( `CREATE TYPE "public"."report_status" AS ENUM('open', 'dismissed', 'actioned')` );
        await queryRunner.query( `CREATE TABLE "path_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "learning_path_id" uuid NOT NULL, "reporter_id" uuid, "reason" "public"."report_reason" NOT NULL, "details" text, "status" "public"."report_status" NOT NULL DEFAULT 'open', "resolved_by_id" uuid, "resolved_at" TIMESTAMP WITH TIME ZONE, "resolution_note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_42588cd0b154418fa8e3229ca1c" PRIMARY KEY ("id"))` );
        await queryRunner.query( `CREATE INDEX "idx_path_reports_status_created" ON "path_reports"  ("status", "created_at") ` );
        await queryRunner.query( `CREATE UNIQUE INDEX "uq_path_reports_open" ON "path_reports"  ("learning_path_id", "reporter_id") WHERE "status" = 'open'` );
        await queryRunner.query( `ALTER TABLE "learning_paths" ADD "public_blocked_at" TIMESTAMP WITH TIME ZONE` );
        await queryRunner.query( `ALTER TABLE "organization_invitations" ADD CONSTRAINT "FK_7f88954e8d667a76ae3ced6f446" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "organization_invitations" ADD CONSTRAINT "FK_f2adb477aa41340163bac901751" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "path_reports" ADD CONSTRAINT "FK_99541a2a7504d3cee5bd6c6a03b" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "path_reports" ADD CONSTRAINT "FK_84e41959d6a451d06b7345725b7" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "path_reports" ADD CONSTRAINT "FK_4a0ca1cc8fdcdfc527ce7f60164" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION` );
    }

    async down( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `ALTER TABLE "path_reports" DROP CONSTRAINT "FK_4a0ca1cc8fdcdfc527ce7f60164"` );
        await queryRunner.query( `ALTER TABLE "path_reports" DROP CONSTRAINT "FK_84e41959d6a451d06b7345725b7"` );
        await queryRunner.query( `ALTER TABLE "path_reports" DROP CONSTRAINT "FK_99541a2a7504d3cee5bd6c6a03b"` );
        await queryRunner.query( `ALTER TABLE "organization_invitations" DROP CONSTRAINT "FK_f2adb477aa41340163bac901751"` );
        await queryRunner.query( `ALTER TABLE "organization_invitations" DROP CONSTRAINT "FK_7f88954e8d667a76ae3ced6f446"` );
        await queryRunner.query( `ALTER TABLE "learning_paths" DROP COLUMN "public_blocked_at"` );
        await queryRunner.query( `DROP INDEX "public"."uq_path_reports_open"` );
        await queryRunner.query( `DROP INDEX "public"."idx_path_reports_status_created"` );
        await queryRunner.query( `DROP TABLE "path_reports"` );
        await queryRunner.query( `DROP TYPE "public"."report_status"` );
        await queryRunner.query( `DROP TYPE "public"."report_reason"` );
        await queryRunner.query( `DROP INDEX "public"."IDX_c1d63ed5127c053e50abcdbce5"` );
        await queryRunner.query( `DROP TABLE "organization_invitations"` );
    }
}
