import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPathImportedAuditAction1793189867189 implements MigrationInterface {
    name = 'AddPathImportedAuditAction1793189867189';

    async up( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `ALTER TYPE "public"."audit_action" ADD VALUE 'path_imported'` );
    }

    async down( queryRunner: QueryRunner ): Promise<void> {
        // The old type has no such value, so these rows can't be kept.
        await queryRunner.query( `DELETE FROM "audit_events" WHERE "action" = 'path_imported'` );
        await queryRunner.query( `CREATE TYPE "public"."audit_action_old" AS ENUM('user_promoted', 'user_demoted', 'user_removed', 'path_published', 'path_moved_to_draft', 'path_archived', 'path_deleted', 'item_published', 'item_moved_to_draft', 'item_archived', 'item_deleted', 'report_dismissed', 'path_hidden', 'path_unhidden')` );
        await queryRunner.query( `ALTER TABLE "audit_events" ALTER COLUMN "action" TYPE "public"."audit_action_old" USING "action"::"text"::"public"."audit_action_old"` );
        await queryRunner.query( `DROP TYPE "public"."audit_action"` );
        await queryRunner.query( `ALTER TYPE "public"."audit_action_old" RENAME TO "audit_action"` );
    }
}
