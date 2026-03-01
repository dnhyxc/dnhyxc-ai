import { MigrationInterface, QueryRunner } from 'typeorm';

export class Chat1772343336743 implements MigrationInterface {
	name = 'Chat1772343336743';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE \`attachments\` DROP COLUMN \`mimetype\``,
		);
		await queryRunner.query(
			`ALTER TABLE \`attachments\` ADD \`mimetype\` varchar(255) NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE \`attachments\` DROP COLUMN \`mimetype\``,
		);
		await queryRunner.query(
			`ALTER TABLE \`attachments\` ADD \`mimetype\` varchar(50) NULL`,
		);
	}
}
