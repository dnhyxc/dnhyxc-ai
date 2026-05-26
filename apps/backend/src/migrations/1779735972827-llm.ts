import { MigrationInterface, QueryRunner } from "typeorm";

export class Llm1779735972827 implements MigrationInterface {
    name = 'Llm1779735972827'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`llm_runtime_config\` (\`id\` int NOT NULL DEFAULT '1', \`enabled\` tinyint NOT NULL DEFAULT 0, \`base_url\` varchar(512) NOT NULL DEFAULT '', \`model_name\` varchar(256) NOT NULL DEFAULT '', \`api_key_enc\` text NULL, \`updated_by\` int NULL, \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`llm_runtime_config\``);
    }

}
