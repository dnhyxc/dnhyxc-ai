import { MigrationInterface, QueryRunner } from "typeorm";

export class Juzi1778342003819 implements MigrationInterface {
    name = 'Juzi1778342003819'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_classic_quotes\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`stream_id\` varchar(36) NOT NULL, \`round\` int NOT NULL, \`topic\` varchar(500) NOT NULL, \`target_count\` int NOT NULL, \`level\` varchar(32) NULL, \`items\` json NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_ecq_pack_batch_user_stream_round\` (\`user_id\`, \`stream_id\`, \`round\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`idx_ecq_pack_batch_user_stream_round\` ON \`english_classic_quotes\``);
        await queryRunner.query(`DROP TABLE \`english_classic_quotes\``);
    }

}
