import { MigrationInterface, QueryRunner } from "typeorm";

export class EbookShare1782981927397 implements MigrationInterface {
    name = 'EbookShare1782981927397'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_book\` ADD \`is_public\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`ebook_book\` ADD \`source_book_id\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`ebook_book\` ADD \`public_at\` timestamp NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_book\` DROP COLUMN \`public_at\``);
        await queryRunner.query(`ALTER TABLE \`ebook_book\` DROP COLUMN \`source_book_id\``);
        await queryRunner.query(`ALTER TABLE \`ebook_book\` DROP COLUMN \`is_public\``);
    }

}
