import { MigrationInterface, QueryRunner } from "typeorm";

export class EbookAssistant1781692695060 implements MigrationInterface {
    name = 'EbookAssistant1781692695060'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`ebook_assistant_messages\` (\`id\` varchar(36) NOT NULL, \`role\` enum ('user', 'assistant') NOT NULL, \`turn_id\` varchar(36) NULL, \`content\` longtext NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`session_id\` varchar(36) NULL, INDEX \`idx_ebook_assistant_msg_session_turn\` (\`session_id\`, \`turn_id\`), INDEX \`idx_ebook_assistant_msg_session_created\` (\`session_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`ebook_assistant_sessions\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`book_id\` varchar(36) NOT NULL, \`title\` varchar(255) NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_ebook_assistant_session_user_updated\` (\`user_id\`, \`updated_at\`), INDEX \`idx_ebook_assistant_session_user_book_updated\` (\`user_id\`, \`book_id\`, \`updated_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`ebook_assistant_session_summaries\` (\`session_id\` varchar(36) NOT NULL, \`summary\` longtext NOT NULL, \`covers_before_at\` timestamp NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_ebook_assistant_summary_session\` (\`session_id\`), PRIMARY KEY (\`session_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`ebook_assistant_messages\` ADD CONSTRAINT \`FK_9d66dc28f9d7084a84553beb769\` FOREIGN KEY (\`session_id\`) REFERENCES \`ebook_assistant_sessions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_assistant_messages\` DROP FOREIGN KEY \`FK_9d66dc28f9d7084a84553beb769\``);
        await queryRunner.query(`DROP INDEX \`idx_ebook_assistant_summary_session\` ON \`ebook_assistant_session_summaries\``);
        await queryRunner.query(`DROP TABLE \`ebook_assistant_session_summaries\``);
        await queryRunner.query(`DROP INDEX \`idx_ebook_assistant_session_user_book_updated\` ON \`ebook_assistant_sessions\``);
        await queryRunner.query(`DROP INDEX \`idx_ebook_assistant_session_user_updated\` ON \`ebook_assistant_sessions\``);
        await queryRunner.query(`DROP TABLE \`ebook_assistant_sessions\``);
        await queryRunner.query(`DROP INDEX \`idx_ebook_assistant_msg_session_created\` ON \`ebook_assistant_messages\``);
        await queryRunner.query(`DROP INDEX \`idx_ebook_assistant_msg_session_turn\` ON \`ebook_assistant_messages\``);
        await queryRunner.query(`DROP TABLE \`ebook_assistant_messages\``);
    }

}
