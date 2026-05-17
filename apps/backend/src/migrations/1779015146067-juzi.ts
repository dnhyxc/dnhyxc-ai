import { MigrationInterface, QueryRunner } from "typeorm";

export class Juzi1779015146067 implements MigrationInterface {
    name = 'Juzi1779015146067'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_library_item\` DROP FOREIGN KEY \`FK_evli_library\``);
        await queryRunner.query(`CREATE TABLE \`english_classic_quotes_library_item\` (\`id\` varchar(36) NOT NULL, \`library_id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`sort_order\` int NOT NULL, \`english\` text NOT NULL, \`translation_zh\` text NOT NULL, \`source\` varchar(2000) NOT NULL DEFAULT '', \`note_zh\` text NOT NULL, INDEX \`idx_ecqli_user_library\` (\`user_id\`, \`library_id\`), INDEX \`idx_ecqli_library_sort\` (\`library_id\`, \`sort_order\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`english_classic_quotes_library\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`title\` varchar(200) NOT NULL, \`quote_count\` int NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_ecql_user_created\` (\`user_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_library_item\` ADD CONSTRAINT \`FK_9d846d2784ff1448d837ba09a77\` FOREIGN KEY (\`library_id\`) REFERENCES \`english_vocabulary_library\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`english_classic_quotes_library_item\` ADD CONSTRAINT \`FK_da1a46a4a03022b43d3cbbf69e0\` FOREIGN KEY (\`library_id\`) REFERENCES \`english_classic_quotes_library\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_classic_quotes_library_item\` DROP FOREIGN KEY \`FK_da1a46a4a03022b43d3cbbf69e0\``);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_library_item\` DROP FOREIGN KEY \`FK_9d846d2784ff1448d837ba09a77\``);
        await queryRunner.query(`DROP INDEX \`idx_ecql_user_created\` ON \`english_classic_quotes_library\``);
        await queryRunner.query(`DROP TABLE \`english_classic_quotes_library\``);
        await queryRunner.query(`DROP INDEX \`idx_ecqli_library_sort\` ON \`english_classic_quotes_library_item\``);
        await queryRunner.query(`DROP INDEX \`idx_ecqli_user_library\` ON \`english_classic_quotes_library_item\``);
        await queryRunner.query(`DROP TABLE \`english_classic_quotes_library_item\``);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_library_item\` ADD CONSTRAINT \`FK_evli_library\` FOREIGN KEY (\`library_id\`) REFERENCES \`english_vocabulary_library\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
