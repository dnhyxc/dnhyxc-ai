import { LegalDocPage } from './LegalDocPage';
import { getUserAgreementSections } from './legalDocuments';
import { LEGAL_PAGE_PATHS } from './legalPageUrls';

const UserAgreementPage = () => (
	<LegalDocPage
		titleKey="legal.userAgreement.title"
		getSections={getUserAgreementSections}
		pathname={LEGAL_PAGE_PATHS.userAgreement}
	/>
);

export default UserAgreementPage;
