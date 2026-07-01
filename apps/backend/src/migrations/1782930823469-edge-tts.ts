import { MigrationInterface, QueryRunner } from "typeorm";

export class EdgeTts1782930823469 implements MigrationInterface {
    name = 'EdgeTts1782930823469'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`knowledge_trash\` DROP COLUMN \`local_bindings_json\``);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` ADD \`edge_voice_id\` varchar(128) NOT NULL DEFAULT 'zh-CN-XiaoxiaoNeural'`);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` ADD \`xfyun_speed\` double NOT NULL DEFAULT '50'`);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` ADD \`xfyun_volume\` double NOT NULL DEFAULT '50'`);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` ADD \`xfyun_pitch\` int NOT NULL DEFAULT '50'`);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` ADD \`edge_speed\` double NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` ADD \`edge_vol\` double NOT NULL DEFAULT '5'`);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` ADD \`edge_pitch\` int NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` CHANGE \`model\` \`model\` varchar(64) NOT NULL DEFAULT 'speech-2.8-turbo'`);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` CHANGE \`model\` \`model\` varchar(64) NOT NULL DEFAULT 'speech-2.8-turbo'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` CHANGE \`model\` \`model\` varchar(64) NOT NULL DEFAULT 'speech-2.8-hd'`);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` CHANGE \`model\` \`model\` varchar(64) NOT NULL DEFAULT 'speech-2.8-hd'`);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` DROP COLUMN \`edge_pitch\``);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` DROP COLUMN \`edge_vol\``);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` DROP COLUMN \`edge_speed\``);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` DROP COLUMN \`xfyun_pitch\``);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` DROP COLUMN \`xfyun_volume\``);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` DROP COLUMN \`xfyun_speed\``);
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` DROP COLUMN \`edge_voice_id\``);
        await queryRunner.query(`ALTER TABLE \`knowledge_trash\` ADD \`local_bindings_json\` json NULL`);
    }

}
