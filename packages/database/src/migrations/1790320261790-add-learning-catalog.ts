import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLearningCatalog1790320261790 implements MigrationInterface {
    name = 'AddLearningCatalog1790320261790';

    // Edited after generating: TypeORM emitted CREATE/DROP TYPE catalog_status once per table that uses it;
    // the type is shared, so it's created once here and dropped once at the end of down().
    async up( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `CREATE TYPE "public"."item_type" AS ENUM('problem', 'article', 'video', 'book', 'course', 'note', 'exercise')` );
        await queryRunner.query( `CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard')` );
        await queryRunner.query( `CREATE TYPE "public"."catalog_status" AS ENUM('draft', 'published', 'archived')` );
        await queryRunner.query( `CREATE TABLE "items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid, "type" "public"."item_type" NOT NULL, "title" character varying(300) NOT NULL, "description" text, "difficulty" "public"."difficulty", "estimated_minutes" integer, "tags" text array NOT NULL DEFAULT '{}', "details" jsonb NOT NULL DEFAULT '{}', "status" "public"."catalog_status" NOT NULL DEFAULT 'draft', "created_by_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ba5885359424c15ca6b9e79bcf6" PRIMARY KEY ("id"))` );
        await queryRunner.query( `CREATE INDEX "IDX_97cd261a539f2103953dff5277" ON "items"  ("organization_id") ` );
        await queryRunner.query( `CREATE INDEX "IDX_08b27979745f1f9d89f3bc21df" ON "items"  ("type") ` );
        await queryRunner.query( `CREATE TABLE "learning_paths" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid, "title" character varying(200) NOT NULL, "slug" character varying(120) NOT NULL, "description" text, "status" "public"."catalog_status" NOT NULL DEFAULT 'draft', "position" integer NOT NULL DEFAULT '0', "created_by_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_20e80314f6a5daa35922f25ad44" UNIQUE ("slug"), CONSTRAINT "PK_2f073530d2af4a865296c06274c" PRIMARY KEY ("id"))` );
        await queryRunner.query( `CREATE INDEX "IDX_a1d1c0d80da282e26a73641056" ON "learning_paths"  ("organization_id") ` );
        await queryRunner.query( `CREATE TABLE "topic_items" ("topic_id" uuid NOT NULL, "item_id" uuid NOT NULL, "position" integer NOT NULL DEFAULT '0', "is_optional" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b0352be44139673865ce3959b12" PRIMARY KEY ("topic_id", "item_id"))` );
        await queryRunner.query( `CREATE INDEX "IDX_dcb5da94d772eccee93710b263" ON "topic_items"  ("item_id") ` );
        await queryRunner.query( `CREATE TABLE "topics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "module_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "slug" character varying(120) NOT NULL, "description" text, "status" "public"."catalog_status" NOT NULL DEFAULT 'draft', "position" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_topics_module_slug" UNIQUE ("module_id", "slug"), CONSTRAINT "PK_e4aa99a3fa60ec3a37d1fc4e853" PRIMARY KEY ("id"))` );
        await queryRunner.query( `CREATE TABLE "modules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "learning_path_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "slug" character varying(120) NOT NULL, "description" text, "status" "public"."catalog_status" NOT NULL DEFAULT 'draft', "position" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_modules_path_slug" UNIQUE ("learning_path_id", "slug"), CONSTRAINT "PK_7dbefd488bd96c5bf31f0ce0c95" PRIMARY KEY ("id"))` );
        await queryRunner.query( `ALTER TABLE "items" ADD CONSTRAINT "FK_97cd261a539f2103953dff5277d" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "items" ADD CONSTRAINT "FK_87551e041c180c6bea8400f9460" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "learning_paths" ADD CONSTRAINT "FK_a1d1c0d80da282e26a736410568" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "learning_paths" ADD CONSTRAINT "FK_6d90944b4fa50341b483b088169" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "topic_items" ADD CONSTRAINT "FK_9df89f5d731ab72d203f05325dd" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "topic_items" ADD CONSTRAINT "FK_dcb5da94d772eccee93710b263b" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "topics" ADD CONSTRAINT "FK_2422ec4dba8445c72580c4901df" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "modules" ADD CONSTRAINT "FK_3ea859a5dcd726fecaf4f802fc7" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
    }

    async down( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `ALTER TABLE "modules" DROP CONSTRAINT "FK_3ea859a5dcd726fecaf4f802fc7"` );
        await queryRunner.query( `ALTER TABLE "topics" DROP CONSTRAINT "FK_2422ec4dba8445c72580c4901df"` );
        await queryRunner.query( `ALTER TABLE "topic_items" DROP CONSTRAINT "FK_dcb5da94d772eccee93710b263b"` );
        await queryRunner.query( `ALTER TABLE "topic_items" DROP CONSTRAINT "FK_9df89f5d731ab72d203f05325dd"` );
        await queryRunner.query( `ALTER TABLE "learning_paths" DROP CONSTRAINT "FK_6d90944b4fa50341b483b088169"` );
        await queryRunner.query( `ALTER TABLE "learning_paths" DROP CONSTRAINT "FK_a1d1c0d80da282e26a736410568"` );
        await queryRunner.query( `ALTER TABLE "items" DROP CONSTRAINT "FK_87551e041c180c6bea8400f9460"` );
        await queryRunner.query( `ALTER TABLE "items" DROP CONSTRAINT "FK_97cd261a539f2103953dff5277d"` );
        await queryRunner.query( `DROP TABLE "modules"` );
        await queryRunner.query( `DROP TABLE "topics"` );
        await queryRunner.query( `DROP INDEX "public"."IDX_dcb5da94d772eccee93710b263"` );
        await queryRunner.query( `DROP TABLE "topic_items"` );
        await queryRunner.query( `DROP INDEX "public"."IDX_a1d1c0d80da282e26a73641056"` );
        await queryRunner.query( `DROP TABLE "learning_paths"` );
        await queryRunner.query( `DROP INDEX "public"."IDX_08b27979745f1f9d89f3bc21df"` );
        await queryRunner.query( `DROP INDEX "public"."IDX_97cd261a539f2103953dff5277"` );
        await queryRunner.query( `DROP TABLE "items"` );
        await queryRunner.query( `DROP TYPE "public"."catalog_status"` );
        await queryRunner.query( `DROP TYPE "public"."difficulty"` );
        await queryRunner.query( `DROP TYPE "public"."item_type"` );
    }
}
