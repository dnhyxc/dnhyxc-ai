import { AnyMongoAbility, InferSubjects } from '@casl/ability';
import { SetMetadata } from '@nestjs/common';
import { Action } from '../enum/action.enum';

export enum CHECK_POLICIES_KEY {
	HANDLER = 'CHECK_POLICIES_HANDLER',
	CAN = 'CHECK_POLICIES_CAN',
	CANNOT = 'CHECK_POLICIES_CANNOT',
}

/**
 * GUARD -> routes meta -> @CheckPolicies @Can @Cannot
 * @CheckPolicies -> handle -> ability => boolean
 * @Can -> Action, Subject, Condition
 * @Cannot -> Action, Subject, Condition
 */

export type PolicyHandlerCallback = (ability: AnyMongoAbility) => boolean;

export type CaslHandlerType = PolicyHandlerCallback | PolicyHandlerCallback[];

// GUARD -> routes meta -> @CheckPolicies @Can @Cannot
export const CheckPolicies = (...handlers: PolicyHandlerCallback[]) =>
	SetMetadata(CHECK_POLICIES_KEY.HANDLER, handlers);

// @Can -> Action, Subject, Condition
export const Can = (
	action: Action,
	subject: InferSubjects<any>,
	conditions?: any,
) =>
	SetMetadata(CHECK_POLICIES_KEY.CAN, (ability: AnyMongoAbility) =>
		ability.can(action, subject, conditions),
	);

// @Cannot -> Action, Subject, Condition
export const Cannot = (
	action: Action,
	subject: InferSubjects<any>,
	conditions?: any,
) =>
	SetMetadata(CHECK_POLICIES_KEY.CANNOT, (ability: AnyMongoAbility) =>
		ability.cannot(action, subject, conditions),
	);
