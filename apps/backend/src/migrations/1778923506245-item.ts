import { MigrationInterface, QueryRunner } from "typeorm";

export class Item1778923506245 implements MigrationInterface {
    name = 'Item1778923506245'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_vocabulary_library_item\` (\`id\` varchar(36) NOT NULL, \`library_id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`sort_order\` int NOT NULL, \`word\` varchar(500) NOT NULL, \`ipa\` varchar(2000) NOT NULL DEFAULT '', \`pos\` varchar(64) NOT NULL DEFAULT '', \`translation_zh\` text NOT NULL, \`example\` text NOT NULL, INDEX \`idx_evli_user_library\` (\`user_id\`, \`library_id\`), INDEX \`idx_evli_library_sort\` (\`library_id\`, \`sort_order\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_library\` DROP COLUMN \`items\``);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_library_item\` ADD CONSTRAINT \`FK_9d846d2784ff1448d837ba09a77\` FOREIGN KEY (\`library_id\`) REFERENCES \`english_vocabulary_library\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_library_item\` DROP FOREIGN KEY \`FK_9d846d2784ff1448d837ba09a77\``);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_library\` ADD \`items\` json NOT NULL`);
        await queryRunner.query(`DROP INDEX \`idx_evli_library_sort\` ON \`english_vocabulary_library_item\``);
        await queryRunner.query(`DROP INDEX \`idx_evli_user_library\` ON \`english_vocabulary_library_item\``);
        await queryRunner.query(`DROP TABLE \`english_vocabulary_library_item\``);
    }

}
