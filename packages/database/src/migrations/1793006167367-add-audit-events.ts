import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditEvents1793006167367 implements MigrationInterface {
    name = 'AddAuditEvents1793006167367';

    async up( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `CREATE TYPE "public"."audit_action" AS ENUM('user_promoted', 'user_demoted', 'user_removed', 'path_published', 'path_moved_to_draft', 'path_archived', 'path_deleted', 'item_published', 'item_moved_to_draft', 'item_archived', 'item_deleted', 'report_dismissed', 'path_hidden', 'path_unhidden')` );
        await queryRunner.query( `CREATE TABLE "audit_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_id" uuid, "actor_name" character varying(201) NOT NULL, "action" "public"."audit_action" NOT NULL, "target_id" uuid NOT NULL, "target_label" character varying(255) NOT NULL, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_910f64d901a5c3e9878f0d4a407" PRIMARY KEY ("id"))` );
        await queryRunner.query( `CREATE INDEX "idx_audit_events_created" ON "audit_events"  ("created_at") ` );
        await queryRunner.query( `ALTER TABLE "audit_events" ADD CONSTRAINT "FK_04c7c044146c6632491a370fc04" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION` );
    }

    async down( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `ALTER TABLE "audit_events" DROP CONSTRAINT "FK_04c7c044146c6632491a370fc04"` );
        await queryRunner.query( `DROP INDEX "public"."idx_audit_events_created"` );
        await queryRunner.query( `DROP TABLE "audit_events"` );
        await queryRunner.query( `DROP TYPE "public"."audit_action"` );
    }
}
