import { MigrationInterface, QueryRunner } from "typeorm";

export class EbookAuth1782989407674 implements MigrationInterface {
    name = 'EbookAuth1782989407674'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_thought\` ADD \`is_public\` tinyint NOT NULL DEFAULT 1`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_thought\` DROP COLUMN \`is_public\``);
    }

}
