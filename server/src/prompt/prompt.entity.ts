import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ConfigEnum } from '../enum/config.enum';
import { getEnvConfig } from '../utils';

const config = getEnvConfig();

@Entity({ schema: config[ConfigEnum.DB_DB1_NAME] })
export class Prompt {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@Column()
	prompt: string;
}
