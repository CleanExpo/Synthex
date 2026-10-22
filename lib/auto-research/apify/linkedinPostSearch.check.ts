import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  OPTIONAL_LINKEDIN_POST_SEARCH_ACTOR,
  linkedInPostSearchCall,
  linkedInSearchPosts,
} from './linkedinPostSearch.ts';

const current = {
  actorId: 'apify/linkedin-post-search-scraper',
  buildInput: ({
    limit,
    query,
  }: {
    limit: number;
    query?: string[];
  }) => ({
    searchQuery: (query ?? ['marketing automation', 'content strategy'])[0],
    resultsLimit: limit,
  }),
};

describe('linkedIn post search adapter', () => {
  it('keeps the default actor input when the env value does not match', () => {
    const call = linkedInPostSearchCall(undefined, { limit: 50 }, current);
    assert.equal(call.optional, false);
    assert.equal(call.actorId, 'apify/linkedin-post-search-scraper');
    assert.deepEqual(call.input, {
      searchQuery: 'marketing automation',
      resultsLimit: 50,
    });
    const rows = [{ searchQuery: 'kept' }];
    assert.equal(linkedInSearchPosts(rows, false), rows);
  });

  it('sends a keyword body and maps post rows when the optional actor is selected', () => {
    const call = linkedInPostSearchCall(
      OPTIONAL_LINKEDIN_POST_SEARCH_ACTOR,
      {
        limit: 2000,
        query: ['field service software'],
      },
      current
    );
    assert.equal(call.optional, true);
    assert.equal(call.actorId, OPTIONAL_LINKEDIN_POST_SEARCH_ACTOR);
    assert.deepEqual(call.input, {
      keywords: ['field service software'],
      maxPostsPerKeyword: 1000,
    });

    const posts = linkedInSearchPosts(
      [
        {
          result_type: 'post',
          text: 'Example post',
          postUrl: 'https://www.linkedin.com/feed/update/example',
          authorName: 'Example Author',
          datePosted: '2026-10-01',
          numLikes: 4,
          numComments: 1,
        },
        { result_type: 'error', text: 'skip me', postUrl: 'https://example.invalid/err' },
      ],
      true
    );
    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0], {
      platform: 'linkedin',
      url: 'https://www.linkedin.com/feed/update/example',
      content: 'Example post',
      engagementCount: 5,
      likesCount: 4,
      commentsCount: 1,
      timestamp: '2026-10-01',
      authorHandle: 'Example Author',
    });
  });
});
