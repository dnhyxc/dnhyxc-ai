import { MigrationInterface, QueryRunner } from "typeorm";

export class Tts1781065975059 implements MigrationInterface {
    name = 'Tts1781065975059'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_vocabulary_mistake\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`word_key\` varchar(200) NOT NULL, \`word\` varchar(500) NOT NULL, \`ipa\` varchar(500) NOT NULL DEFAULT '', \`pos\` varchar(32) NOT NULL DEFAULT '', \`segmentation\` varchar(500) NOT NULL DEFAULT '', \`translation_zh\` text NOT NULL, \`example\` text NOT NULL, \`last_user_input\` varchar(500) NOT NULL DEFAULT '', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_evm_user_word_key\` (\`user_id\`, \`word_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`english_practice_review_state\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`content_kind\` varchar(16) NOT NULL, \`item_key\` varchar(200) NOT NULL, \`next_review_at\` timestamp NOT NULL, \`interval_days\` int NOT NULL DEFAULT '0', \`repetitions\` int NOT NULL DEFAULT '0', \`ease_factor\` decimal(4,2) NOT NULL DEFAULT '2.50', \`last_result\` varchar(16) NOT NULL DEFAULT 'wrong', \`last_practiced_at\` timestamp NULL, INDEX \`IDX_eprs_user_kind_due\` (\`user_id\`, \`content_kind\`, \`next_review_at\`), UNIQUE INDEX \`UQ_eprs_user_kind_key\` (\`user_id\`, \`content_kind\`, \`item_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`english_daily_memorize_record\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`word_key\` varchar(200) NOT NULL, \`word\` varchar(500) NOT NULL, \`ipa\` varchar(500) NOT NULL DEFAULT '', \`pos\` varchar(32) NOT NULL DEFAULT '', \`segmentation\` varchar(500) NOT NULL DEFAULT '', \`translation_zh\` text NOT NULL, \`example\` text NOT NULL, \`last_correct\` tinyint NOT NULL DEFAULT 0, \`practiced_at\` timestamp NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_edmr_user_practiced\` (\`user_id\`, \`practiced_at\`), UNIQUE INDEX \`UQ_edmr_user_word_key\` (\`user_id\`, \`word_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_edmr_user_word_key\` ON \`english_daily_memorize_record\``);
        await queryRunner.query(`DROP INDEX \`IDX_edmr_user_practiced\` ON \`english_daily_memorize_record\``);
        await queryRunner.query(`DROP TABLE \`english_daily_memorize_record\``);
        await queryRunner.query(`DROP INDEX \`UQ_eprs_user_kind_key\` ON \`english_practice_review_state\``);
        await queryRunner.query(`DROP INDEX \`IDX_eprs_user_kind_due\` ON \`english_practice_review_state\``);
        await queryRunner.query(`DROP TABLE \`english_practice_review_state\``);
        await queryRunner.query(`DROP INDEX \`UQ_evm_user_word_key\` ON \`english_vocabulary_mistake\``);
        await queryRunner.query(`DROP TABLE \`english_vocabulary_mistake\``);
    }

}
