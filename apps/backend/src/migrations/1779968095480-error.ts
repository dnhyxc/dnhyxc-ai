import { MigrationInterface, QueryRunner } from "typeorm";

export class Error1779968095480 implements MigrationInterface {
    name = 'Error1779968095480'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_vocabulary_mistake\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`word_key\` varchar(200) NOT NULL, \`word\` varchar(500) NOT NULL, \`ipa\` varchar(500) NOT NULL DEFAULT '', \`pos\` varchar(32) NOT NULL DEFAULT '', \`segmentation\` varchar(500) NOT NULL DEFAULT '', \`translation_zh\` text NOT NULL, \`example\` text NOT NULL, \`last_user_input\` varchar(500) NOT NULL DEFAULT '', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_evm_user_word_key\` (\`user_id\`, \`word_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_evm_user_word_key\` ON \`english_vocabulary_mistake\``);
        await queryRunner.query(`DROP TABLE \`english_vocabulary_mistake\``);
    }

}
