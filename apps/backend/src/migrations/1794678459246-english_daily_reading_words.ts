import { MigrationInterface, QueryRunner } from "typeorm";

export class EnglishDailyReadingWords1794678459246 implements MigrationInterface {
    name = 'EnglishDailyReadingWords1794678459246'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_daily_reading_words\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`word_key\` varchar(80) NOT NULL, \`word\` varchar(200) NOT NULL, \`zh\` varchar(500) NOT NULL DEFAULT '', \`zh_edited\` tinyint NOT NULL DEFAULT 0, \`sources\` json NOT NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_edrw_user_updated\` (\`user_id\`, \`updated_at\`), UNIQUE INDEX \`UQ_edrw_user_word_key\` (\`user_id\`, \`word_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_edrw_user_word_key\` ON \`english_daily_reading_words\``);
        await queryRunner.query(`DROP INDEX \`IDX_edrw_user_updated\` ON \`english_daily_reading_words\``);
        await queryRunner.query(`DROP TABLE \`english_daily_reading_words\``);
    }

}
