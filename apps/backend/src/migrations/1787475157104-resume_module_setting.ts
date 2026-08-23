import { MigrationInterface, QueryRunner } from "typeorm";

export class ResumeModuleSetting1787475157104 implements MigrationInterface {
    name = 'ResumeModuleSetting1787475157104'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_learning_resume_module_setting\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`module_key\` varchar(32) NOT NULL, \`enabled\` tinyint NOT NULL DEFAULT 0, \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_elrms_user_module\` (\`user_id\`, \`module_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_elrms_user_module\` ON \`english_learning_resume_module_setting\``);
        await queryRunner.query(`DROP TABLE \`english_learning_resume_module_setting\``);
    }

}
