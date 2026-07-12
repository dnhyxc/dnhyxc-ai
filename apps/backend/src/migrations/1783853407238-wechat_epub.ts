import { MigrationInterface, QueryRunner } from "typeorm";

export class WechatEpub1783853407238 implements MigrationInterface {
    name = 'WechatEpub1783853407238'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`ebook_chapter\` (\`id\` varchar(36) NOT NULL, \`book_id\` varchar(255) NOT NULL, \`chapter_index\` int NOT NULL, \`href\` varchar(512) NOT NULL, \`title\` varchar(512) NOT NULL DEFAULT '', \`level\` int NOT NULL DEFAULT '0', \`html\` mediumtext NOT NULL, \`word_count\` int NOT NULL DEFAULT '0', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`idx_ebook_chapter_book_index\` (\`book_id\`, \`chapter_index\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`ebook_book\` CHANGE \`parse_status\` \`parse_status\` varchar(16) NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE \`ebook_book\` CHANGE \`parse_status\` \`parse_status\` varchar(16) NULL DEFAULT 'pending'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_book\` CHANGE \`parse_status\` \`parse_status\` varchar(16) NULL`);
        await queryRunner.query(`ALTER TABLE \`ebook_book\` CHANGE \`parse_status\` \`parse_status\` varchar(16) NULL`);
        await queryRunner.query(`DROP INDEX \`idx_ebook_chapter_book_index\` ON \`ebook_chapter\``);
        await queryRunner.query(`DROP TABLE \`ebook_chapter\``);
    }

}
