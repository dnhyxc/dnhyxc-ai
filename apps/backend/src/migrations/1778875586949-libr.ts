import { MigrationInterface, QueryRunner } from "typeorm";

export class Libr1778875586949 implements MigrationInterface {
    name = 'Libr1778875586949'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_vocabulary_library\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`title\` varchar(200) NOT NULL, \`items\` json NOT NULL, \`word_count\` int NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`idx_evl_user_created\` (\`user_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`idx_evl_user_created\` ON \`english_vocabulary_library\``);
        await queryRunner.query(`DROP TABLE \`english_vocabulary_library\``);
    }

}
