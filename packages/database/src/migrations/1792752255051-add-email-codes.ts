import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailCodes1792752255051 implements MigrationInterface {
    name = 'AddEmailCodes1792752255051';

    async up( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `CREATE TYPE "public"."email_code_purpose" AS ENUM('verify_email', 'reset_password')` );
        await queryRunner.query( `CREATE TABLE "email_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "purpose" "public"."email_code_purpose" NOT NULL, "code_hash" character varying NOT NULL, "attempts" smallint NOT NULL DEFAULT '0', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_808c1d3a52c34d9ce02534f78d7" UNIQUE ("user_id", "purpose"), CONSTRAINT "PK_6ed15013da989317f69306da6e3" PRIMARY KEY ("id"))` );
        await queryRunner.query( `ALTER TABLE "users" ADD "email_verified_at" TIMESTAMP WITH TIME ZONE` );
        await queryRunner.query( `ALTER TABLE "email_codes" ADD CONSTRAINT "FK_60a2fdb525cba0453b3f5a342d4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
    }

    async down( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `ALTER TABLE "email_codes" DROP CONSTRAINT "FK_60a2fdb525cba0453b3f5a342d4"` );
        await queryRunner.query( `ALTER TABLE "users" DROP COLUMN "email_verified_at"` );
        await queryRunner.query( `DROP TABLE "email_codes"` );
        await queryRunner.query( `DROP TYPE "public"."email_code_purpose"` );
    }
}
