import { MigrationInterface, QueryRunner } from "typeorm";

export class KnowledgePublic1785689382806 implements MigrationInterface {
    name = 'KnowledgePublic1785689382806'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`knowledge\` ADD \`is_public\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`CREATE INDEX \`IDX_knowledge_public\` ON \`knowledge\` (\`is_public\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_knowledge_public\` ON \`knowledge\``);
        await queryRunner.query(`ALTER TABLE \`knowledge\` DROP COLUMN \`is_public\``);
    }

}
