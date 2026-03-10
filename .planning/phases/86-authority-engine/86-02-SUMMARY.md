# 86-02 Summary: Source Connectors

## Completed
- Created lib/authority/source-connectors/semantic-scholar.ts — queries Semantic Scholar API (214M papers)
- Created lib/authority/source-connectors/gov-au.ts — queries data.gov.au Australian Government APIs
- Created lib/authority/source-connectors/industry-registry.ts — static IICRC/NCC + dynamic ASIC lookup
- Created lib/authority/source-connectors/claude-web-search.ts — Claude API web_search with domain filtering
- Created lib/authority/source-connectors/index.ts — registry with parallel search, dedup, availability check

## Commits
- feat(86-02): add Semantic Scholar and Australian Government source connectors
- feat(86-02): add industry registry and Claude web search source connectors
- feat(86-02): add source connector registry with parallel search and deduplication

## Notes
- All connectors handle errors gracefully (empty results, no throws)
- claude-web-search enabled only when ANTHROPIC_API_KEY is set
- searchAllConnectors runs in parallel via Promise.allSettled
