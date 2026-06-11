import { MigrationInterface, QueryRunner } from "typeorm";

export class Ll1781124197749 implements MigrationInterface {
    name = 'Ll1781124197749'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`minimax_tts_user_config\` (\`user_id\` int NOT NULL, \`enabled\` tinyint NOT NULL DEFAULT 0, \`model\` varchar(64) NOT NULL DEFAULT 'speech-2.8-hd', \`voice_id\` varchar(128) NOT NULL DEFAULT '', \`speed\` double NOT NULL DEFAULT '1', \`vol\` double NOT NULL DEFAULT '5', \`pitch\` int NOT NULL DEFAULT '0', \`emotion\` varchar(32) NOT NULL DEFAULT '', \`format\` varchar(16) NOT NULL DEFAULT 'mp3', \`language_boost\` varchar(32) NOT NULL DEFAULT 'auto', \`sample_rate\` int NOT NULL DEFAULT '32000', \`bitrate\` int NOT NULL DEFAULT '128000', \`channel\` int NOT NULL DEFAULT '1', \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`user_id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`minimax_tts_user_config\``);
    }

}
