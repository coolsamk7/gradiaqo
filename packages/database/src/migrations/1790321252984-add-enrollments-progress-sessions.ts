import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnrollmentsProgressSessions1790321252984 implements MigrationInterface {
    name = 'AddEnrollmentsProgressSessions1790321252984';

    async up( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `CREATE TYPE "public"."order_parent_type" AS ENUM('path', 'module', 'topic')` );
        await queryRunner.query( `CREATE TABLE "enrollment_orders" ("enrollment_id" uuid NOT NULL, "parent_type" "public"."order_parent_type" NOT NULL, "parent_id" uuid NOT NULL, "ordered_ids" uuid array NOT NULL, CONSTRAINT "PK_acd2427708364c3a59eacb83f2a" PRIMARY KEY ("enrollment_id", "parent_type", "parent_id"))` );
        await queryRunner.query( `CREATE TYPE "public"."rule_scope" AS ENUM('module', 'topic', 'item')` );
        await queryRunner.query( `CREATE TYPE "public"."rule_mode" AS ENUM('include', 'exclude')` );
        await queryRunner.query( `CREATE TABLE "enrollment_rules" ("enrollment_id" uuid NOT NULL, "scope" "public"."rule_scope" NOT NULL, "scope_id" uuid NOT NULL, "mode" "public"."rule_mode" NOT NULL, CONSTRAINT "PK_cbeab792fdd7bb34197bcab0775" PRIMARY KEY ("enrollment_id", "scope", "scope_id"))` );
        await queryRunner.query( `CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'paused', 'completed', 'dropped')` );
        await queryRunner.query( `CREATE TABLE "enrollments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "learning_path_id" uuid NOT NULL, "status" "public"."enrollment_status" NOT NULL DEFAULT 'active', "position" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_enrollments_user_path" UNIQUE ("user_id", "learning_path_id"), CONSTRAINT "PK_7c0f752f9fb68bf6ed7367ab00f" PRIMARY KEY ("id"))` );
        await queryRunner.query( `CREATE INDEX "IDX_fd63309ff655e32a9a709e3a4f" ON "enrollments"  ("learning_path_id") ` );
        await queryRunner.query( `CREATE TYPE "public"."progress_status" AS ENUM('not_started', 'in_progress', 'done', 'revise')` );
        await queryRunner.query( `CREATE TABLE "item_progress" ("user_id" uuid NOT NULL, "item_id" uuid NOT NULL, "status" "public"."progress_status" NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_29241c61ead96d1e35cb084eaca" PRIMARY KEY ("user_id", "item_id"))` );
        await queryRunner.query( `CREATE INDEX "IDX_baffc9c17efc92892443bdcbdb" ON "item_progress"  ("item_id") ` );
        await queryRunner.query( `CREATE TABLE "study_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "topic_id" uuid, "item_id" uuid, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "duration_minutes" integer NOT NULL, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_study_sessions_duration" CHECK ("duration_minutes" > 0), CONSTRAINT "PK_529b2be328c0a953f9bf0cf988e" PRIMARY KEY ("id"))` );
        await queryRunner.query( `CREATE INDEX "IDX_474c011f36cc01d94d05fd0098" ON "study_sessions"  ("topic_id") ` );
        await queryRunner.query( `CREATE INDEX "IDX_dc755981d98aa128966b9a73fd" ON "study_sessions"  ("item_id") ` );
        await queryRunner.query( `CREATE INDEX "idx_study_sessions_user_started" ON "study_sessions"  ("user_id", "started_at") ` );
        await queryRunner.query( `ALTER TABLE "enrollment_orders" ADD CONSTRAINT "FK_f956e87a5d23fb1bbb4127ede18" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "enrollment_rules" ADD CONSTRAINT "FK_d3035ec0690796a80e94c222fad" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_ff997f5a39cd24a491b9aca45c9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_fd63309ff655e32a9a709e3a4f9" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "item_progress" ADD CONSTRAINT "FK_a023fef9913fb84fd1997ba1913" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "item_progress" ADD CONSTRAINT "FK_baffc9c17efc92892443bdcbdbf" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "study_sessions" ADD CONSTRAINT "FK_5ea09953d6fd1462a931a596e23" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "study_sessions" ADD CONSTRAINT "FK_474c011f36cc01d94d05fd00988" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "study_sessions" ADD CONSTRAINT "FK_dc755981d98aa128966b9a73fd2" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE NO ACTION` );
    }

    async down( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `ALTER TABLE "study_sessions" DROP CONSTRAINT "FK_dc755981d98aa128966b9a73fd2"` );
        await queryRunner.query( `ALTER TABLE "study_sessions" DROP CONSTRAINT "FK_474c011f36cc01d94d05fd00988"` );
        await queryRunner.query( `ALTER TABLE "study_sessions" DROP CONSTRAINT "FK_5ea09953d6fd1462a931a596e23"` );
        await queryRunner.query( `ALTER TABLE "item_progress" DROP CONSTRAINT "FK_baffc9c17efc92892443bdcbdbf"` );
        await queryRunner.query( `ALTER TABLE "item_progress" DROP CONSTRAINT "FK_a023fef9913fb84fd1997ba1913"` );
        await queryRunner.query( `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_fd63309ff655e32a9a709e3a4f9"` );
        await queryRunner.query( `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_ff997f5a39cd24a491b9aca45c9"` );
        await queryRunner.query( `ALTER TABLE "enrollment_rules" DROP CONSTRAINT "FK_d3035ec0690796a80e94c222fad"` );
        await queryRunner.query( `ALTER TABLE "enrollment_orders" DROP CONSTRAINT "FK_f956e87a5d23fb1bbb4127ede18"` );
        await queryRunner.query( `DROP INDEX "public"."idx_study_sessions_user_started"` );
        await queryRunner.query( `DROP INDEX "public"."IDX_dc755981d98aa128966b9a73fd"` );
        await queryRunner.query( `DROP INDEX "public"."IDX_474c011f36cc01d94d05fd0098"` );
        await queryRunner.query( `DROP TABLE "study_sessions"` );
        await queryRunner.query( `DROP INDEX "public"."IDX_baffc9c17efc92892443bdcbdb"` );
        await queryRunner.query( `DROP TABLE "item_progress"` );
        await queryRunner.query( `DROP TYPE "public"."progress_status"` );
        await queryRunner.query( `DROP INDEX "public"."IDX_fd63309ff655e32a9a709e3a4f"` );
        await queryRunner.query( `DROP TABLE "enrollments"` );
        await queryRunner.query( `DROP TYPE "public"."enrollment_status"` );
        await queryRunner.query( `DROP TABLE "enrollment_rules"` );
        await queryRunner.query( `DROP TYPE "public"."rule_mode"` );
        await queryRunner.query( `DROP TYPE "public"."rule_scope"` );
        await queryRunner.query( `DROP TABLE "enrollment_orders"` );
        await queryRunner.query( `DROP TYPE "public"."order_parent_type"` );
    }
}
