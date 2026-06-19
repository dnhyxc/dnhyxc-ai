import { MigrationInterface, QueryRunner } from "typeorm";

export class EbookThought1781803529705 implements MigrationInterface {
    name = 'EbookThought1781803529705'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`idx_ebook_thought_user_book\` ON \`ebook_thought\``);
        await queryRunner.query(`ALTER TABLE \`ebook_thought\` DROP COLUMN \`book_id\``);
        await queryRunner.query(`ALTER TABLE \`ebook_thought\` ADD \`book_id\` varchar(255) NOT NULL`);
        await queryRunner.query(`CREATE INDEX \`idx_ebook_thought_user_book\` ON \`ebook_thought\` (\`user_id\`, \`book_id\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`idx_ebook_thought_user_book\` ON \`ebook_thought\``);
        await queryRunner.query(`ALTER TABLE \`ebook_thought\` DROP COLUMN \`book_id\``);
        await queryRunner.query(`ALTER TABLE \`ebook_thought\` ADD \`book_id\` varchar(36) NOT NULL`);
        await queryRunner.query(`CREATE INDEX \`idx_ebook_thought_user_book\` ON \`ebook_thought\` (\`user_id\`, \`book_id\`)`);
    }

}
