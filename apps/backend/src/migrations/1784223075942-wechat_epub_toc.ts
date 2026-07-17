import { MigrationInterface, QueryRunner } from "typeorm";

export class WechatEpubToc1784223075942 implements MigrationInterface {
    name = 'WechatEpubToc1784223075942'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_book\` ADD \`toc_json\` mediumtext NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_book\` DROP COLUMN \`toc_json\``);
    }

}
