import { MigrationInterface, QueryRunner } from "typeorm";

export class KnowledgeCommentHidden1795844318822 implements MigrationInterface {
    name = 'KnowledgeCommentHidden1795844318822'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`knowledge_comment\` ADD \`hidden_at\` timestamp NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`knowledge_comment\` DROP COLUMN \`hidden_at\``);
    }

}
