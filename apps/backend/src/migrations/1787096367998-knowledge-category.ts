import { MigrationInterface, QueryRunner } from "typeorm";

export class KnowledgeCategory1787096367998 implements MigrationInterface {
    name = 'KnowledgeCategory1787096367998'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`knowledge_category\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`name\` varchar(64) NOT NULL, \`sort_order\` int NOT NULL DEFAULT '0', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_knowledge_category_user_sort\` (\`user_id\`, \`sort_order\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`knowledge\` ADD \`category_id\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`knowledge\` DROP COLUMN \`category_id\``);
        await queryRunner.query(`DROP INDEX \`idx_knowledge_category_user_sort\` ON \`knowledge_category\``);
        await queryRunner.query(`DROP TABLE \`knowledge_category\``);
    }

}
