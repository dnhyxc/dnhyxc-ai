import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnglishAnnotateSourceTask1789671600000
	implements MigrationInterface
{
	name = 'EnglishAnnotateSourceTask1789671600000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS english_annotate_source_task (
				id varchar(36) NOT NULL,
				user_id int NOT NULL,
				source varchar(16) NOT NULL,
				library_id varchar(64) NULL,
				stream_id varchar(128) NULL,
				title varchar(200) NOT NULL,
				status varchar(16) NOT NULL,
				progress json NULL,
				error_message text NULL,
				started_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
				updated_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
				finished_at timestamp(6) NULL,
				PRIMARY KEY (id),
				INDEX IDX_east_user_updated (user_id, updated_at),
				INDEX IDX_east_user_source_lib (user_id, source, library_id),
				INDEX IDX_east_user_source_stream (user_id, source, stream_id)
			) ENGINE=InnoDB
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP TABLE IF EXISTS english_annotate_source_task`,
		);
	}
}
