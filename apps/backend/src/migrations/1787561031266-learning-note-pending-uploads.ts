import { MigrationInterface, QueryRunner } from "typeorm";

export class LearningNotePendingUploads1787561031266 implements MigrationInterface {
    name = 'LearningNotePendingUploads1787561031266'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_learning_note_pending_upload\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`session_id\` varchar(36) NOT NULL, \`cos_key\` varchar(512) NOT NULL, \`url\` varchar(1024) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_elnpu_created\` (\`created_at\`), INDEX \`IDX_elnpu_user_session\` (\`user_id\`, \`session_id\`), UNIQUE INDEX \`UQ_elnpu_session_key\` (\`session_id\`, \`cos_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_elnpu_session_key\` ON \`english_learning_note_pending_upload\``);
        await queryRunner.query(`DROP INDEX \`IDX_elnpu_user_session\` ON \`english_learning_note_pending_upload\``);
        await queryRunner.query(`DROP INDEX \`IDX_elnpu_created\` ON \`english_learning_note_pending_upload\``);
        await queryRunner.query(`DROP TABLE \`english_learning_note_pending_upload\``);
    }

}
