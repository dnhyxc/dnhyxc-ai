import { MigrationInterface, QueryRunner } from "typeorm";

export class EnglishAgent1792996514086 implements MigrationInterface {
    name = 'EnglishAgent1792996514086'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_agent_messages\` ADD \`el_resources\` json NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_agent_messages\` DROP COLUMN \`el_resources\``);
    }

}
