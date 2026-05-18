import { MigrationInterface, QueryRunner } from "typeorm";

export class Vac1779045368588 implements MigrationInterface {
    name = 'Vac1779045368588'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_vocabulary\` CHANGE \`items\` \`item_count\` json NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`english_classic_quotes\` CHANGE \`items\` \`item_count\` json NOT NULL`);
        await queryRunner.query(`CREATE TABLE \`english_vocabulary_pack_session\` (\`stream_id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`topic\` varchar(500) NOT NULL, \`target_count\` int NOT NULL, \`item_count\` int NOT NULL DEFAULT '0', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_evps_user_updated\` (\`user_id\`, \`updated_at\`), PRIMARY KEY (\`stream_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`english_vocabulary_pack_item\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`stream_id\` varchar(36) NOT NULL, \`round\` int NOT NULL, \`sort_order\` int NOT NULL, \`batch_id\` varchar(36) NULL, \`word\` varchar(500) NOT NULL, \`ipa\` varchar(2000) NOT NULL DEFAULT '', \`pos\` varchar(64) NOT NULL DEFAULT '', \`translation_zh\` text NOT NULL, \`example\` text NOT NULL, INDEX \`idx_evpi_stream_sort\` (\`stream_id\`, \`sort_order\`), INDEX \`idx_evpi_user_stream_sort\` (\`user_id\`, \`stream_id\`, \`sort_order\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`english_classic_quotes_pack_session\` (\`stream_id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`topic\` varchar(500) NOT NULL, \`target_count\` int NOT NULL, \`item_count\` int NOT NULL DEFAULT '0', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_ecqps_user_updated\` (\`user_id\`, \`updated_at\`), PRIMARY KEY (\`stream_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`english_classic_quotes_pack_item\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`stream_id\` varchar(36) NOT NULL, \`round\` int NOT NULL, \`sort_order\` int NOT NULL, \`batch_id\` varchar(36) NULL, \`english\` text NOT NULL, \`translation_zh\` text NOT NULL, \`source\` varchar(2000) NOT NULL DEFAULT '', \`note_zh\` text NOT NULL, INDEX \`idx_ecqpi_stream_sort\` (\`stream_id\`, \`sort_order\`), INDEX \`idx_ecqpi_user_stream_sort\` (\`user_id\`, \`stream_id\`, \`sort_order\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary\` DROP COLUMN \`item_count\``);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary\` ADD \`item_count\` int NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`english_classic_quotes\` DROP COLUMN \`item_count\``);
        await queryRunner.query(`ALTER TABLE \`english_classic_quotes\` ADD \`item_count\` int NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_classic_quotes\` DROP COLUMN \`item_count\``);
        await queryRunner.query(`ALTER TABLE \`english_classic_quotes\` ADD \`item_count\` json NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary\` DROP COLUMN \`item_count\``);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary\` ADD \`item_count\` json NOT NULL`);
        await queryRunner.query(`DROP INDEX \`idx_ecqpi_user_stream_sort\` ON \`english_classic_quotes_pack_item\``);
        await queryRunner.query(`DROP INDEX \`idx_ecqpi_stream_sort\` ON \`english_classic_quotes_pack_item\``);
        await queryRunner.query(`DROP TABLE \`english_classic_quotes_pack_item\``);
        await queryRunner.query(`DROP INDEX \`idx_ecqps_user_updated\` ON \`english_classic_quotes_pack_session\``);
        await queryRunner.query(`DROP TABLE \`english_classic_quotes_pack_session\``);
        await queryRunner.query(`DROP INDEX \`idx_evpi_user_stream_sort\` ON \`english_vocabulary_pack_item\``);
        await queryRunner.query(`DROP INDEX \`idx_evpi_stream_sort\` ON \`english_vocabulary_pack_item\``);
        await queryRunner.query(`DROP TABLE \`english_vocabulary_pack_item\``);
        await queryRunner.query(`DROP INDEX \`idx_evps_user_updated\` ON \`english_vocabulary_pack_session\``);
        await queryRunner.query(`DROP TABLE \`english_vocabulary_pack_session\``);
        await queryRunner.query(`ALTER TABLE \`english_classic_quotes\` CHANGE \`item_count\` \`items\` json NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary\` CHANGE \`item_count\` \`items\` json NOT NULL`);
    }

}
