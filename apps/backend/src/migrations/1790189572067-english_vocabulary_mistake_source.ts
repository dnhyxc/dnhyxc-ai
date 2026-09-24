import { MigrationInterface, QueryRunner } from "typeorm";

export class EnglishVocabularyMistakeSource1790189572067 implements MigrationInterface {
    name = 'EnglishVocabularyMistakeSource1790189572067'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_mistake\` ADD \`source\` varchar(32) NOT NULL DEFAULT ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_mistake\` DROP COLUMN \`source\``);
    }

}
