import { MigrationInterface, QueryRunner } from "typeorm";

export class EnglishVocabDetailRegen1794398252308 implements MigrationInterface {
    name = 'EnglishVocabDetailRegen1794398252308'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_vocab_detail_regen\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`lemma\` varchar(120) NOT NULL, \`schema_version\` varchar(16) NOT NULL, \`detail\` json NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`UQ_evdr_user_lemma\` (\`user_id\`, \`lemma\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_evdr_user_lemma\` ON \`english_vocab_detail_regen\``);
        await queryRunner.query(`DROP TABLE \`english_vocab_detail_regen\``);
    }

}
