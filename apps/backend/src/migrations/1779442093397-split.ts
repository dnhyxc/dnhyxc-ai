import { MigrationInterface, QueryRunner } from "typeorm";

export class Split1779442093397 implements MigrationInterface {
    name = 'Split1779442093397'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_pack_item\` ADD \`segmentation\` varchar(500) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_library_item\` ADD \`segmentation\` varchar(500) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_favorite\` ADD \`segmentation\` varchar(500) NOT NULL DEFAULT ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_favorite\` DROP COLUMN \`segmentation\``);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_library_item\` DROP COLUMN \`segmentation\``);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_pack_item\` DROP COLUMN \`segmentation\``);
    }

}
