import { MigrationInterface, QueryRunner } from "typeorm";

export class EnglishVocabLibraryItemLemma1794414166786 implements MigrationInterface {
    name = 'EnglishVocabLibraryItemLemma1794414166786'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_library_item\` ADD \`lemma\` varchar(120) NOT NULL DEFAULT ''`);
        await queryRunner.query(`CREATE INDEX \`idx_evli_lemma_library\` ON \`english_vocabulary_library_item\` (\`lemma\`, \`library_id\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`idx_evli_lemma_library\` ON \`english_vocabulary_library_item\``);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_library_item\` DROP COLUMN \`lemma\``);
    }

}
