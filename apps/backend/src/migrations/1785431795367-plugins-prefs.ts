import { MigrationInterface, QueryRunner } from "typeorm";

export class PluginsPrefs1785431795367 implements MigrationInterface {
    name = 'PluginsPrefs1785431795367'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`plugin_user_prefs\` (\`user_id\` int NOT NULL, \`enabled_ids\` json NOT NULL, \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`user_id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`plugin_user_prefs\``);
    }

}
