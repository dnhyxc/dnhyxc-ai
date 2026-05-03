import { LegalDocPage } from './LegalDocPage';
import { getServicePolicySections } from './legalDocuments';
import { LEGAL_PAGE_PATHS } from './legalPageUrls';

const ServicePolicyPage = () => (
	<LegalDocPage
		titleKey="legal.servicePolicy.title"
		getSections={getServicePolicySections}
		pathname={LEGAL_PAGE_PATHS.servicePolicy}
	/>
);

export default ServicePolicyPage;
