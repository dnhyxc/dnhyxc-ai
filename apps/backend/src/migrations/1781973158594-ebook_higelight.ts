import { MigrationInterface, QueryRunner } from "typeorm";

export class EbookHigelight1781973158594 implements MigrationInterface {
    name = 'EbookHigelight1781973158594'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`ebook_highlight\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`book_id\` varchar(255) NOT NULL, \`cfi_range\` text NOT NULL, \`quote\` text NOT NULL, \`style\` varchar(16) NOT NULL, \`color\` varchar(16) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_ebook_highlight_user_book\` (\`user_id\`, \`book_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`idx_ebook_highlight_user_book\` ON \`ebook_highlight\``);
        await queryRunner.query(`DROP TABLE \`ebook_highlight\``);
    }

}
