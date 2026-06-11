import { MigrationInterface, QueryRunner } from "typeorm";

export class TtsType1781147319793 implements MigrationInterface {
    name = 'TtsType1781147319793'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` ADD \`playback_source\` varchar(16) NOT NULL DEFAULT 'cloud'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` DROP COLUMN \`playback_source\``);
    }

}
