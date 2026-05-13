import { MigrationInterface, QueryRunner } from "typeorm";

export class Collect1778694228608 implements MigrationInterface {
    name = 'Collect1778694228608'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_vocabulary_favorite\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`word_key\` varchar(200) NOT NULL, \`word\` varchar(500) NOT NULL, \`ipa\` varchar(500) NOT NULL DEFAULT '', \`translation_zh\` text NOT NULL, \`example\` text NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_evf_user_word_key\` (\`user_id\`, \`word_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`english_classic_quote_favorite\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`content_key\` char(64) NOT NULL, \`english\` text NOT NULL, \`translation_zh\` text NOT NULL, \`source\` varchar(2000) NOT NULL DEFAULT '', \`note_zh\` text NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_ecqf_user_content\` (\`user_id\`, \`content_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_ecqf_user_content\` ON \`english_classic_quote_favorite\``);
        await queryRunner.query(`DROP TABLE \`english_classic_quote_favorite\``);
        await queryRunner.query(`DROP INDEX \`UQ_evf_user_word_key\` ON \`english_vocabulary_favorite\``);
        await queryRunner.query(`DROP TABLE \`english_vocabulary_favorite\``);
    }

}
