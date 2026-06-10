import { MigrationInterface, QueryRunner } from "typeorm";

export class Key1781115737011 implements MigrationInterface {
    name = 'Key1781115737011'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`llm_runtime_config\` (\`user_id\` int NOT NULL, \`enabled\` tinyint NOT NULL DEFAULT 0, \`base_url\` varchar(512) NOT NULL DEFAULT '', \`model_name\` varchar(256) NOT NULL DEFAULT '', \`api_key_enc\` text NULL, \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`user_id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`llm_runtime_config\``);
    }

}
