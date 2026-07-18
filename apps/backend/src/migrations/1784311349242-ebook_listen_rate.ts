import { MigrationInterface, QueryRunner } from "typeorm";

export class EbookListenRate1784311349242 implements MigrationInterface {
    name = 'EbookListenRate1784311349242'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`ebook_user_prefs\` (\`user_id\` int NOT NULL, \`listen_rate\` float NOT NULL DEFAULT '1', \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`user_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`ebook_progress\` ADD \`listen_rate\` float NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ebook_progress\` DROP COLUMN \`listen_rate\``);
        await queryRunner.query(`DROP TABLE \`ebook_user_prefs\``);
    }

}
