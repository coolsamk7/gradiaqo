import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailChange1792779353612 implements MigrationInterface {
    name = 'AddEmailChange1792779353612';

    async up( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `ALTER TABLE "email_codes" ADD "new_email" character varying(255)` );
        await queryRunner.query( `ALTER TYPE "public"."email_code_purpose" ADD VALUE 'change_email'` );
    }

    async down( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `DELETE FROM "email_codes" WHERE "purpose" = 'change_email'` );
        await queryRunner.query( `CREATE TYPE "public"."email_code_purpose_old" AS ENUM('verify_email', 'reset_password')` );
        await queryRunner.query( `ALTER TABLE "email_codes" ALTER COLUMN "purpose" TYPE "public"."email_code_purpose_old" USING "purpose"::"text"::"public"."email_code_purpose_old"` );
        await queryRunner.query( `DROP TYPE "public"."email_code_purpose"` );
        await queryRunner.query( `ALTER TYPE "public"."email_code_purpose_old" RENAME TO "email_code_purpose"` );
        await queryRunner.query( `ALTER TABLE "email_codes" DROP COLUMN "new_email"` );
    }
}
