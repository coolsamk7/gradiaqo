import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1790315598625 implements MigrationInterface {
    name = 'Init1790315598625';

    async up( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `CREATE TYPE "public"."platform_role" AS ENUM('application_user', 'superadmin')` );
        await queryRunner.query( `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "first_name" character varying(100) NOT NULL, "last_name" character varying(100) NOT NULL, "password_hash" character varying NOT NULL, "platform_role" "public"."platform_role" NOT NULL DEFAULT 'application_user', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))` );
        await queryRunner.query( `CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "slug" character varying(120) NOT NULL, "is_personal" boolean NOT NULL DEFAULT false, "created_by_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_963693341bd612aa01ddf3a4b68" UNIQUE ("slug"), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))` );
        await queryRunner.query( `CREATE TYPE "public"."organization_role" AS ENUM('owner', 'admin', 'member')` );
        await queryRunner.query( `CREATE TABLE "memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "organization_id" uuid NOT NULL, "role" "public"."organization_role" NOT NULL DEFAULT 'member', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_memberships_user_organization" UNIQUE ("user_id", "organization_id"), CONSTRAINT "PK_25d28bd932097a9e90495ede7b4" PRIMARY KEY ("id"))` );
        await queryRunner.query( `CREATE INDEX "IDX_e5380c394ec7912046d07b5429" ON "memberships"  ("organization_id") ` );
        await queryRunner.query( `CREATE TABLE "sessions" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "previous_token_hash" character varying(64), "rotated_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_used_at" TIMESTAMP WITH TIME ZONE NOT NULL, "user_agent" character varying(512), "ip" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))` );
        await queryRunner.query( `CREATE INDEX "IDX_085d540d9f418cfbdc7bd55bb1" ON "sessions"  ("user_id") ` );
        await queryRunner.query( `ALTER TABLE "organizations" ADD CONSTRAINT "FK_f56cb25675485f275a31825d67d" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "memberships" ADD CONSTRAINT "FK_7c1e2fdfed4f6838e0c05ae5051" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "memberships" ADD CONSTRAINT "FK_e5380c394ec7912046d07b54290" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
        await queryRunner.query( `ALTER TABLE "sessions" ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
    }

    async down( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `ALTER TABLE "sessions" DROP CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19"` );
        await queryRunner.query( `ALTER TABLE "memberships" DROP CONSTRAINT "FK_e5380c394ec7912046d07b54290"` );
        await queryRunner.query( `ALTER TABLE "memberships" DROP CONSTRAINT "FK_7c1e2fdfed4f6838e0c05ae5051"` );
        await queryRunner.query( `ALTER TABLE "organizations" DROP CONSTRAINT "FK_f56cb25675485f275a31825d67d"` );
        await queryRunner.query( `DROP INDEX "public"."IDX_085d540d9f418cfbdc7bd55bb1"` );
        await queryRunner.query( `DROP TABLE "sessions"` );
        await queryRunner.query( `DROP INDEX "public"."IDX_e5380c394ec7912046d07b5429"` );
        await queryRunner.query( `DROP TABLE "memberships"` );
        await queryRunner.query( `DROP TYPE "public"."organization_role"` );
        await queryRunner.query( `DROP TABLE "organizations"` );
        await queryRunner.query( `DROP TABLE "users"` );
        await queryRunner.query( `DROP TYPE "public"."platform_role"` );
    }
}
