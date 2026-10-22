/**
 * lib/indexnow — IndexNow URL submission for client sites (kit K1).
 *
 * @see lib/indexnow/README.md
 */
export {
  INDEXNOW_KEY_NAMESPACE,
  buildIndexNowKeyFileArtefact,
  deriveIndexNowKey,
  hostOf,
  isValidIndexNowKey,
  type IndexNowKeyFileArtefact,
  type IndexNowKeyInput,
} from './key';

export {
  INDEXNOW_ENDPOINT,
  INDEXNOW_MAX_URLS_PER_REQUEST,
  buildIndexNowRequests,
  classifyIndexNowStatus,
  submitToIndexNow,
  type IndexNowBatchResult,
  type IndexNowBody,
  type IndexNowClassification,
  type IndexNowOutcome,
  type IndexNowRequestInput,
  type IndexNowSubmission,
} from './client';

export {
  notifyIndexNowOnPublish,
  type ClientSitePublishEvent,
} from './on-publish';
