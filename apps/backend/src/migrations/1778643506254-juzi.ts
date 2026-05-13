import { MigrationInterface, QueryRunner } from "typeorm";

export class Juzi1778643506254 implements MigrationInterface {
    name = 'Juzi1778643506254'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_pack_web_search\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`stream_id\` varchar(36) NOT NULL, \`pack_kind\` varchar(32) NOT NULL, \`search_rounds\` json NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_epws_user_stream\` (\`user_id\`, \`stream_id\`), UNIQUE INDEX \`uq_epws_user_stream_kind\` (\`user_id\`, \`stream_id\`, \`pack_kind\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`uq_epws_user_stream_kind\` ON \`english_pack_web_search\``);
        await queryRunner.query(`DROP INDEX \`idx_epws_user_stream\` ON \`english_pack_web_search\``);
        await queryRunner.query(`DROP TABLE \`english_pack_web_search\``);
    }

}
