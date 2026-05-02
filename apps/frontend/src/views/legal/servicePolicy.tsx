import { LegalDocPage } from './LegalDocPage';
import { getServicePolicySections } from './legalDocuments';

const ServicePolicyPage = () => (
	<LegalDocPage
		titleKey="legal.servicePolicy.title"
		getSections={getServicePolicySections}
	/>
);

export default ServicePolicyPage;
