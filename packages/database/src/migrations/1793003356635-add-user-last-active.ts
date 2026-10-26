import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserLastActive1793003356635 implements MigrationInterface {
    name = 'AddUserLastActive1793003356635';

    async up( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `ALTER TABLE "users" ADD "last_active_at" TIMESTAMP WITH TIME ZONE` );
        // Start from the most recent use of a device that is still logged in.
        await queryRunner.query(
            `UPDATE "users" SET "last_active_at" = "s"."last_used_at" FROM ( SELECT "user_id", MAX( "last_used_at" ) AS "last_used_at" FROM "sessions" GROUP BY "user_id" ) "s" WHERE "s"."user_id" = "users"."id"`,
        );
    }

    async down( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `ALTER TABLE "users" DROP COLUMN "last_active_at"` );
    }
}
