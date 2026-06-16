import { MigrationInterface, QueryRunner } from "typeorm";

export class BookCover1781609328384 implements MigrationInterface {
    name = 'BookCover1781609328384'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_book\` CHANGE \`cover_base64\` \`cover_path\` longtext NULL`);
        await queryRunner.query(`ALTER TABLE \`ebook_book\` DROP COLUMN \`cover_path\``);
        await queryRunner.query(`ALTER TABLE \`ebook_book\` ADD \`cover_path\` varchar(512) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_book\` DROP COLUMN \`cover_path\``);
        await queryRunner.query(`ALTER TABLE \`ebook_book\` ADD \`cover_path\` longtext NULL`);
        await queryRunner.query(`ALTER TABLE \`ebook_book\` CHANGE \`cover_path\` \`cover_base64\` longtext NULL`);
    }

}
