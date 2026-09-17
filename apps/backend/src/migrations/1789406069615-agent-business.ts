import { MigrationInterface, QueryRunner } from "typeorm";

export class AgentBusiness1789406069615 implements MigrationInterface {
    name = 'AgentBusiness1789406069615'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`skill_try_session_summaries\` (\`session_id\` varchar(36) NOT NULL, \`summary\` longtext NOT NULL, \`covers_before_at\` timestamp NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_skill_try_summary_session\` (\`session_id\`), PRIMARY KEY (\`session_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`skill_try_messages\` (\`id\` varchar(36) NOT NULL, \`role\` enum ('user', 'assistant') NOT NULL, \`turn_id\` varchar(36) NULL, \`content\` longtext NOT NULL, \`search_organic\` json NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`session_id\` varchar(36) NULL, INDEX \`idx_skill_try_msg_session_turn\` (\`session_id\`, \`turn_id\`), INDEX \`idx_skill_try_msg_session_created\` (\`session_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`english_agent_messages\` (\`id\` varchar(36) NOT NULL, \`role\` enum ('user', 'assistant') NOT NULL, \`turn_id\` varchar(36) NULL, \`content\` longtext NOT NULL, \`search_organic\` json NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`session_id\` varchar(36) NULL, INDEX \`idx_english_agent_msg_session_turn\` (\`session_id\`, \`turn_id\`), INDEX \`idx_english_agent_msg_session_created\` (\`session_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`english_agent_sessions\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`title\` varchar(255) NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_english_agent_session_user_updated\` (\`user_id\`, \`updated_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`english_agent_session_summaries\` (\`session_id\` varchar(36) NOT NULL, \`summary\` longtext NOT NULL, \`covers_before_at\` timestamp NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_english_agent_summary_session\` (\`session_id\`), PRIMARY KEY (\`session_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`skill_try_messages\` ADD CONSTRAINT \`FK_399e35ef9620bc1e6cb0b96d1f5\` FOREIGN KEY (\`session_id\`) REFERENCES \`skill_try_sessions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`english_agent_messages\` ADD CONSTRAINT \`FK_f59e9a5cd0d09acbaedf4ecf2fc\` FOREIGN KEY (\`session_id\`) REFERENCES \`english_agent_sessions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_agent_messages\` DROP FOREIGN KEY \`FK_f59e9a5cd0d09acbaedf4ecf2fc\``);
        await queryRunner.query(`ALTER TABLE \`skill_try_messages\` DROP FOREIGN KEY \`FK_399e35ef9620bc1e6cb0b96d1f5\``);
        await queryRunner.query(`DROP INDEX \`idx_english_agent_summary_session\` ON \`english_agent_session_summaries\``);
        await queryRunner.query(`DROP TABLE \`english_agent_session_summaries\``);
        await queryRunner.query(`DROP INDEX \`idx_english_agent_session_user_updated\` ON \`english_agent_sessions\``);
        await queryRunner.query(`DROP TABLE \`english_agent_sessions\``);
        await queryRunner.query(`DROP INDEX \`idx_english_agent_msg_session_created\` ON \`english_agent_messages\``);
        await queryRunner.query(`DROP INDEX \`idx_english_agent_msg_session_turn\` ON \`english_agent_messages\``);
        await queryRunner.query(`DROP TABLE \`english_agent_messages\``);
        await queryRunner.query(`DROP INDEX \`idx_skill_try_msg_session_created\` ON \`skill_try_messages\``);
        await queryRunner.query(`DROP INDEX \`idx_skill_try_msg_session_turn\` ON \`skill_try_messages\``);
        await queryRunner.query(`DROP TABLE \`skill_try_messages\``);
        await queryRunner.query(`DROP INDEX \`idx_skill_try_summary_session\` ON \`skill_try_session_summaries\``);
        await queryRunner.query(`DROP TABLE \`skill_try_session_summaries\``);
    }

}
