import { MigrationInterface, QueryRunner } from "typeorm";

export class EnglishPracticeReportRounds1790131522028 implements MigrationInterface {
    name = 'EnglishPracticeReportRounds1790131522028'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_practice_report\` ADD \`rounds\` json NULL`);
        await queryRunner.query(`ALTER TABLE \`english_practice_report\` ADD \`source_meta\` json NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_practice_report\` DROP COLUMN \`source_meta\``);
        await queryRunner.query(`ALTER TABLE \`english_practice_report\` DROP COLUMN \`rounds\``);
    }

}
