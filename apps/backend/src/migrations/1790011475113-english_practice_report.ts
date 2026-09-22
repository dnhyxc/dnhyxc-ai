import { MigrationInterface, QueryRunner } from "typeorm";

export class EnglishPracticeReport1790011475113 implements MigrationInterface {
    name = 'EnglishPracticeReport1790011475113'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_practice_report\` (\`id\` varchar(255) NOT NULL, \`user_id\` int NOT NULL, \`content_kind\` varchar(16) NOT NULL, \`mode\` varchar(16) NOT NULL, \`source\` varchar(32) NOT NULL, \`order\` varchar(16) NOT NULL, \`count\` int NOT NULL, \`source_title\` varchar(200) NOT NULL DEFAULT '', \`title\` varchar(240) NOT NULL, \`correct_count\` int NOT NULL, \`total_count\` int NOT NULL, \`items\` json NOT NULL, \`is_retry_wrong\` tinyint NOT NULL DEFAULT 0, \`save_mode\` varchar(16) NOT NULL DEFAULT 'manual', \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_epr_user_kind_created\` (\`user_id\`, \`content_kind\`, \`created_at\`), INDEX \`IDX_epr_user_created\` (\`user_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_epr_user_created\` ON \`english_practice_report\``);
        await queryRunner.query(`DROP INDEX \`IDX_epr_user_kind_created\` ON \`english_practice_report\``);
        await queryRunner.query(`DROP TABLE \`english_practice_report\``);
    }

}
