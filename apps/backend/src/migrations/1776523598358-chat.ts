import { MigrationInterface, QueryRunner } from 'typeorm';

export class Chat1776523598358 implements MigrationInterface {
	name = 'Chat1776523598358';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE \`assistant_messages\` (\`id\` varchar(36) NOT NULL, \`role\` enum ('system', 'user', 'assistant') NOT NULL, \`turn_id\` varchar(36) NULL, \`content\` longtext NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`session_id\` varchar(36) NULL, INDEX \`idx_assistant_msg_session_turn\` (\`session_id\`, \`turn_id\`), INDEX \`idx_assistant_msg_session_created\` (\`session_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
		);
		await queryRunner.query(
			`CREATE TABLE \`assistant_sessions\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`title\` varchar(255) NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_assistant_session_user_updated\` (\`user_id\`, \`updated_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
		);
		await queryRunner.query(
			`ALTER TABLE \`assistant_messages\` ADD CONSTRAINT \`FK_23c0839b50511f7bf8c704966c2\` FOREIGN KEY (\`session_id\`) REFERENCES \`assistant_sessions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE \`assistant_messages\` DROP FOREIGN KEY \`FK_23c0839b50511f7bf8c704966c2\``,
		);
		await queryRunner.query(
			`DROP INDEX \`idx_assistant_session_user_updated\` ON \`assistant_sessions\``,
		);
		await queryRunner.query(`DROP TABLE \`assistant_sessions\``);
		await queryRunner.query(
			`DROP INDEX \`idx_assistant_msg_session_created\` ON \`assistant_messages\``,
		);
		await queryRunner.query(
			`DROP INDEX \`idx_assistant_msg_session_turn\` ON \`assistant_messages\``,
		);
		await queryRunner.query(`DROP TABLE \`assistant_messages\``);
	}
}
