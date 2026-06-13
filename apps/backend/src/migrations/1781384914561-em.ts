import { MigrationInterface, QueryRunner } from "typeorm";

export class Em1781384914561 implements MigrationInterface {
    name = 'Em1781384914561'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`llm_runtime_config\` ADD \`vector_search_profiles\` json NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`llm_runtime_config\` DROP COLUMN \`vector_search_profiles\``);
    }

}
