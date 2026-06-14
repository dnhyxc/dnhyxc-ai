import { MigrationInterface, QueryRunner } from "typeorm";

export class Book1781430626699 implements MigrationInterface {
    name = 'Book1781430626699'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`ebook_progress\` (\`book_id\` varchar(255) NOT NULL, \`user_id\` int NOT NULL, \`epub_cfi\` text NULL, \`pdf_page\` int NULL, \`percent\` float NULL, \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_ebook_progress_user\` (\`user_id\`), PRIMARY KEY (\`book_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`ebook_book\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`fmt\` varchar(8) NOT NULL, \`title\` varchar(512) NOT NULL, \`author\` varchar(255) NULL, \`src_kind\` varchar(16) NOT NULL, \`local_path\` varchar(1024) NULL, \`file_path\` varchar(512) NULL, \`size\` bigint NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_ebook_book_user_added\` (\`user_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`idx_ebook_book_user_added\` ON \`ebook_book\``);
        await queryRunner.query(`DROP TABLE \`ebook_book\``);
        await queryRunner.query(`DROP INDEX \`idx_ebook_progress_user\` ON \`ebook_progress\``);
        await queryRunner.query(`DROP TABLE \`ebook_progress\``);
    }

}
