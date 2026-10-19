import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInterviewGoals1792424041430 implements MigrationInterface {
    name = 'AddInterviewGoals1792424041430';

    async up( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `CREATE TABLE "interview_goals" ("user_id" uuid NOT NULL, "title" character varying(100) NOT NULL, "target_date" date NOT NULL, "enrollment_ids" uuid array NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8b7db3dea3726eca5e219a7ec9a" PRIMARY KEY ("user_id"))` );
        await queryRunner.query( `ALTER TABLE "interview_goals" ADD CONSTRAINT "FK_8b7db3dea3726eca5e219a7ec9a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION` );
    }

    async down( queryRunner: QueryRunner ): Promise<void> {
        await queryRunner.query( `ALTER TABLE "interview_goals" DROP CONSTRAINT "FK_8b7db3dea3726eca5e219a7ec9a"` );
        await queryRunner.query( `DROP TABLE "interview_goals"` );
    }
}
