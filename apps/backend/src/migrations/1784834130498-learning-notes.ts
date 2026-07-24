import { MigrationInterface, QueryRunner } from "typeorm";

export class LearningNotes1784834130498 implements MigrationInterface {
    name = 'LearningNotes1784834130498'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_learning_note\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`title\` varchar(200) NULL, \`content\` longtext NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_eln_user_updated\` (\`user_id\`, \`updated_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_eln_user_updated\` ON \`english_learning_note\``);
        await queryRunner.query(`DROP TABLE \`english_learning_note\``);
    }

}
