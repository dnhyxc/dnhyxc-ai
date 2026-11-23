import { MigrationInterface, QueryRunner } from 'typeorm';

export class KnowledgeComment1794800000000 implements MigrationInterface {
	name = 'KnowledgeComment1794800000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE \`knowledge_comment\` (\`id\` varchar(36) NOT NULL, \`knowledge_id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`parent_id\` varchar(36) NULL, \`reply_to_user_id\` int NULL, \`content\` varchar(1000) NOT NULL, \`audience\` varchar(16) NOT NULL, \`edited_at\` timestamp NULL, \`deleted_at\` timestamp NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_knowledge_comment_doc_created\` (\`knowledge_id\`, \`created_at\`), INDEX \`IDX_knowledge_comment_parent\` (\`parent_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
		);
		await queryRunner.query(
			`CREATE TABLE \`knowledge_comment_like\` (\`id\` varchar(36) NOT NULL, \`comment_id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, UNIQUE INDEX \`UQ_knowledge_comment_like\` (\`comment_id\`, \`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE \`knowledge_comment_like\``);
		await queryRunner.query(`DROP TABLE \`knowledge_comment\``);
	}
}
