import { MigrationInterface, QueryRunner } from "typeorm";

export class AssistantSessionSummary1789480828252 implements MigrationInterface {
    name = 'AssistantSessionSummary1789480828252'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`assistant_session_summaries\` (\`session_id\` varchar(36) NOT NULL, \`summary\` longtext NOT NULL, \`covers_before_at\` timestamp NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_assistant_summary_session\` (\`session_id\`), PRIMARY KEY (\`session_id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`idx_assistant_summary_session\` ON \`assistant_session_summaries\``);
        await queryRunner.query(`DROP TABLE \`assistant_session_summaries\``);
    }

}
