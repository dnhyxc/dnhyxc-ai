import { MigrationInterface, QueryRunner } from "typeorm";

export class EbookDel1783013927276 implements MigrationInterface {
    name = 'EbookDel1783013927276'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_thought\` ADD \`deleted_at\` timestamp NULL`);
        await queryRunner.query(`CREATE INDEX \`idx_ebook_thought_book_deleted\` ON \`ebook_thought\` (\`book_id\`, \`deleted_at\`)`);
        await queryRunner.query(`CREATE INDEX \`idx_ebook_thought_book_updated\` ON \`ebook_thought\` (\`book_id\`, \`updated_at\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`idx_ebook_thought_book_updated\` ON \`ebook_thought\``);
        await queryRunner.query(`DROP INDEX \`idx_ebook_thought_book_deleted\` ON \`ebook_thought\``);
        await queryRunner.query(`ALTER TABLE \`ebook_thought\` DROP COLUMN \`deleted_at\``);
    }

}
