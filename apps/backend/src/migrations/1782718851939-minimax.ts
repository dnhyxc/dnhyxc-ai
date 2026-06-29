import { MigrationInterface, QueryRunner } from "typeorm";

export class Minimax1782718851939 implements MigrationInterface {
    name = 'Minimax1782718851939'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` ADD \`minimax_api_key\` varchar(256) NOT NULL DEFAULT ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`minimax_tts_user_config\` DROP COLUMN \`minimax_api_key\``);
    }

}
