import { LegalDocPage } from './LegalDocPage';
import { getUserAgreementSections } from './legalDocuments';

const UserAgreementPage = () => (
	<LegalDocPage
		titleKey="legal.userAgreement.title"
		getSections={getUserAgreementSections}
	/>
);

export default UserAgreementPage;
