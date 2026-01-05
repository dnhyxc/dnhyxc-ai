import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Prompt {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@Column()
	prompt: string;
}
