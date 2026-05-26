import { MigrationInterface, QueryRunner } from 'typeorm';

export class LlmRuntimeConfig1780200000000 implements MigrationInterface {
	name = 'LlmRuntimeConfig1780200000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const exists = await queryRunner.query(
			`
			SELECT COUNT(*) AS c FROM information_schema.TABLES
			WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llm_runtime_config'
			`,
		);
		const count = Number(
			Array.isArray(exists) && exists[0] && typeof exists[0] === 'object'
				? (exists[0] as { c?: string | number }).c
				: 0,
		);
		if (count > 0) return;

		await queryRunner.query(`
			CREATE TABLE \`llm_runtime_config\` (
				\`id\` int NOT NULL DEFAULT 1,
				\`enabled\` tinyint NOT NULL DEFAULT 0,
				\`base_url\` varchar(512) NOT NULL DEFAULT '',
				\`model_name\` varchar(256) NOT NULL DEFAULT '',
				\`api_key_enc\` text NULL,
				\`updated_by\` int NULL,
				\`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
				PRIMARY KEY (\`id\`)
			) ENGINE=InnoDB
		`);
		await queryRunner.query(
			`INSERT INTO \`llm_runtime_config\` (\`id\`, \`enabled\`) VALUES (1, 0)`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS \`llm_runtime_config\``);
	}
}
