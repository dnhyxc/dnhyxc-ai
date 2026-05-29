import { MigrationInterface, QueryRunner } from "typeorm";

export class Lin1779993527351 implements MigrationInterface {
    name = 'Lin1779993527351'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_classic_quote_mistake\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`content_key\` char(64) NOT NULL, \`english\` text NOT NULL, \`translation_zh\` text NOT NULL, \`source\` varchar(2000) NOT NULL DEFAULT '', \`note_zh\` text NOT NULL, \`last_user_input\` varchar(12000) NOT NULL DEFAULT '', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_ecqm_user_content\` (\`user_id\`, \`content_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_ecqm_user_content\` ON \`english_classic_quote_mistake\``);
        await queryRunner.query(`DROP TABLE \`english_classic_quote_mistake\``);
    }

}
