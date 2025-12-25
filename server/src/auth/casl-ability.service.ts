import {
	AbilityBuilder,
	createMongoAbility,
	ExtractSubjectType,
	Subject,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { Logs } from '../logs/logs.entity';

@Injectable()
export class CaslAbilityService {
	forRoot() {
		const { can, build } = new AbilityBuilder(createMongoAbility);

		can('read', Logs);
		can('update', Logs);

		const ability = build({
			detectSubjectType: (object) =>
				object.constructor as ExtractSubjectType<Subject>,
		});

		return ability;
	}
}
