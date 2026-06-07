import { MigrationInterface, QueryRunner } from "typeorm";

export class Daily1780849392278 implements MigrationInterface {
    name = 'Daily1780849392278'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`idx_eprs_user_kind_due\` ON \`english_practice_review_state\``);
        await queryRunner.query(`CREATE TABLE \`english_daily_memorize_record\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`word_key\` varchar(200) NOT NULL, \`word\` varchar(500) NOT NULL, \`ipa\` varchar(500) NOT NULL DEFAULT '', \`pos\` varchar(32) NOT NULL DEFAULT '', \`segmentation\` varchar(500) NOT NULL DEFAULT '', \`translation_zh\` text NOT NULL, \`example\` text NOT NULL, \`last_correct\` tinyint NOT NULL DEFAULT 0, \`practiced_at\` timestamp NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_edmr_user_practiced\` (\`user_id\`, \`practiced_at\`), UNIQUE INDEX \`UQ_edmr_user_word_key\` (\`user_id\`, \`word_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`english_practice_review_state\` DROP COLUMN \`created_at\``);
        await queryRunner.query(`ALTER TABLE \`english_practice_review_state\` DROP COLUMN \`updated_at\``);
        await queryRunner.query(`ALTER TABLE \`english_practice_review_state\` CHANGE \`last_result\` \`last_result\` varchar(16) NOT NULL DEFAULT 'wrong'`);
        await queryRunner.query(`ALTER TABLE \`english_practice_review_state\` CHANGE \`last_result\` \`last_result\` varchar(16) NOT NULL DEFAULT 'wrong'`);
        await queryRunner.query(`CREATE INDEX \`IDX_eprs_user_kind_due\` ON \`english_practice_review_state\` (\`user_id\`, \`content_kind\`, \`next_review_at\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_eprs_user_kind_due\` ON \`english_practice_review_state\``);
        await queryRunner.query(`ALTER TABLE \`english_practice_review_state\` CHANGE \`last_result\` \`last_result\` varchar(16) NULL`);
        await queryRunner.query(`ALTER TABLE \`english_practice_review_state\` CHANGE \`last_result\` \`last_result\` varchar(16) NULL`);
        await queryRunner.query(`ALTER TABLE \`english_practice_review_state\` ADD \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`);
        await queryRunner.query(`ALTER TABLE \`english_practice_review_state\` ADD \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`);
        await queryRunner.query(`DROP INDEX \`UQ_edmr_user_word_key\` ON \`english_daily_memorize_record\``);
        await queryRunner.query(`DROP INDEX \`IDX_edmr_user_practiced\` ON \`english_daily_memorize_record\``);
        await queryRunner.query(`DROP TABLE \`english_daily_memorize_record\``);
        await queryRunner.query(`CREATE INDEX \`idx_eprs_user_kind_due\` ON \`english_practice_review_state\` (\`user_id\`, \`content_kind\`, \`next_review_at\`)`);
    }

}
