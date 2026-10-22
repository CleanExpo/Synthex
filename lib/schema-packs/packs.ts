/**
 * Business-type packs: one @graph per site, assembled from the builders.
 *
 *   courseProviderPack  - a training business (CARSI)
 *   softwareProductPack - a software product (RestoreAssist)
 *
 * Local-service businesses already have a builder in
 * lib/site-generator/jsonld.ts (LocalBusiness + Service + FAQPage).
 */
import { assertNoAccreditationClaims } from './claim-guard';
import { buildCourse, COURSE_RETIRED, type CourseFacts } from './course';
import { buildOrganization } from './organization';
import {
  buildSoftwareApplication,
  type SoftwareApplicationFacts,
} from './software-application';
import {
  SCHEMA_CONTEXT,
  type OrganizationFacts,
  type PackOutput,
} from './types';

export function courseProviderPack(input: {
  organization: OrganizationFacts;
  courses: CourseFacts[];
}): PackOutput {
  assertNoAccreditationClaims({
    'organization.name': input.organization.name,
    'organization.legalName': input.organization.legalName,
    'organization.description': input.organization.description,
  });
  const org = buildOrganization(input.organization, {
    type: 'EducationalOrganization',
  });
  const courses = input.courses.map(course => buildCourse(course, org).jsonLd);
  return {
    jsonLd: { '@context': SCHEMA_CONTEXT, '@graph': [org, ...courses] },
    googleRichResult: { eligible: false, missing: [], reason: COURSE_RETIRED },
  };
}

export function softwareProductPack(input: {
  organization: OrganizationFacts;
  application: SoftwareApplicationFacts;
}): PackOutput {
  const org = buildOrganization(input.organization);
  const app = buildSoftwareApplication(input.application, org['@id'] as string);
  return {
    jsonLd: { '@context': SCHEMA_CONTEXT, '@graph': [org, app.jsonLd] },
    googleRichResult: app.googleRichResult,
  };
}
