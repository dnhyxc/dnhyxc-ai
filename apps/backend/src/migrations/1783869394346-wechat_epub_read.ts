import { MigrationInterface, QueryRunner } from "typeorm";

export class WechatEpubRead1783869394346 implements MigrationInterface {
    name = 'WechatEpubRead1783869394346'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_book\` ADD \`parse_attempt\` int NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_book\` DROP COLUMN \`parse_attempt\``);
    }

}
