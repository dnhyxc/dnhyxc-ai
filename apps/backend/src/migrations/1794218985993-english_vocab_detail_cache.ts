import { MigrationInterface, QueryRunner } from "typeorm";

export class EnglishVocabDetailCache1794218985993 implements MigrationInterface {
    name = 'EnglishVocabDetailCache1794218985993'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_vocab_detail_cache\` (\`id\` varchar(36) NOT NULL, \`cache_key\` varchar(64) NOT NULL, \`schema_version\` varchar(16) NOT NULL, \`lemma\` varchar(120) NOT NULL, \`detail\` json NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_evdc_cache_key\` (\`cache_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`english_agent_session_summaries\` DROP COLUMN \`covers_before_message_id\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_agent_session_summaries\` ADD \`covers_before_message_id\` varchar(36) NULL`);
        await queryRunner.query(`DROP INDEX \`UQ_evdc_cache_key\` ON \`english_vocab_detail_cache\``);
        await queryRunner.query(`DROP TABLE \`english_vocab_detail_cache\``);
    }

}
