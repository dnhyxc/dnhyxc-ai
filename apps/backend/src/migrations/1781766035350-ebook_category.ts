import { MigrationInterface, QueryRunner } from "typeorm";

export class EbookCategory1781766035350 implements MigrationInterface {
    name = 'EbookCategory1781766035350'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`ebook_category\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`name\` varchar(64) NOT NULL, \`sort_order\` int NOT NULL DEFAULT '0', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_ebook_category_user_sort\` (\`user_id\`, \`sort_order\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`ebook_book\` ADD \`category_id\` varchar(255) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_book\` DROP COLUMN \`category_id\``);
        await queryRunner.query(`DROP INDEX \`idx_ebook_category_user_sort\` ON \`ebook_category\``);
        await queryRunner.query(`DROP TABLE \`ebook_category\``);
    }

}
