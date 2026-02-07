import { MigrationInterface, QueryRunner } from 'typeorm';

export class Chat1770474522392 implements MigrationInterface {
	name = 'Chat1770474522392';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE \`attachments\` (\`id\` int NOT NULL AUTO_INCREMENT, \`filePath\` varchar(500) NOT NULL, \`originalName\` varchar(255) NULL, \`mimeType\` varchar(50) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`message_id\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
		);
		await queryRunner.query(
			`CREATE TABLE \`chat_messages\` (\`id\` int NOT NULL AUTO_INCREMENT, \`role\` enum ('system', 'user', 'assistant') NOT NULL, \`content\` text NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`sessionId\` varchar(255) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
		);
		await queryRunner.query(
			`CREATE TABLE \`chat_sessions\` (\`id\` varchar(255) NOT NULL, \`partial_content\` text NULL, \`is_active\` tinyint NOT NULL DEFAULT 1, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
		);
		await queryRunner.query(
			`ALTER TABLE \`attachments\` ADD CONSTRAINT \`FK_623e10eec51ada466c5038979e3\` FOREIGN KEY (\`message_id\`) REFERENCES \`chat_messages\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE \`chat_messages\` ADD CONSTRAINT \`FK_a82476a8acdd6cd6936378cb72d\` FOREIGN KEY (\`sessionId\`) REFERENCES \`chat_sessions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE \`chat_messages\` DROP FOREIGN KEY \`FK_a82476a8acdd6cd6936378cb72d\``,
		);
		await queryRunner.query(
			`ALTER TABLE \`attachments\` DROP FOREIGN KEY \`FK_623e10eec51ada466c5038979e3\``,
		);
		await queryRunner.query(`DROP TABLE \`chat_sessions\``);
		await queryRunner.query(`DROP TABLE \`chat_messages\``);
		await queryRunner.query(`DROP TABLE \`attachments\``);
	}
}
