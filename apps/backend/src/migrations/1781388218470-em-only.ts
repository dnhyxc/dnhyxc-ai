import { MigrationInterface, QueryRunner } from "typeorm";

export class EmOnly1781388218470 implements MigrationInterface {
    name = 'EmOnly1781388218470'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`llm_runtime_config\` ADD \`vector_bge_only\` tinyint NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`llm_runtime_config\` DROP COLUMN \`vector_bge_only\``);
    }

}
