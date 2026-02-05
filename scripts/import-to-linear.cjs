/**
 * Import audit issues to Linear
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const LINEAR_API_KEY = 'lin_api_8M0bmmAHL6ovhBsZKIpYVWz23RVGDSE9HSZdgAtD';
const TEAM_ID = 'ab9c7810-4dd6-4ce2-8e8f-e1fc94c6b88b';
const PROJECT_ID = '3125c6e4-b729-48d4-a718-400a2b83ddc5';

// Priority mapping
const PRIORITY_MAP = {
  'Urgent': 1,
  'High': 2,
  'Medium': 3,
  'Low': 4
};

function makeRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    const options = {
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY
      }
    };
    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function parseCSV(content) {
  const issues = [];
  let i = 0;
  const chars = content.split('');

  // Skip header line
  while (i < chars.length && chars[i] !== '\n') i++;
  i++; // skip newline

  while (i < chars.length) {
    const row = [];

    // Parse each field
    for (let fieldNum = 0; fieldNum < 5 && i < chars.length; fieldNum++) {
      let field = '';

      // Check if field starts with quote
      if (chars[i] === '"') {
        i++; // skip opening quote
        while (i < chars.length) {
          if (chars[i] === '"' && chars[i + 1] === '"') {
            // Escaped quote
            field += '"';
            i += 2;
          } else if (chars[i] === '"') {
            // End of quoted field
            i++; // skip closing quote
            break;
          } else {
            field += chars[i];
            i++;
          }
        }
      } else {
        // Unquoted field
        while (i < chars.length && chars[i] !== ',' && chars[i] !== '\n' && chars[i] !== '\r') {
          field += chars[i];
          i++;
        }
      }

      row.push(field.trim());

      // Skip comma or newline
      if (chars[i] === ',') i++;
      else if (chars[i] === '\r') i++;
    }

    // Skip to next line
    while (i < chars.length && chars[i] !== '\n') i++;
    i++; // skip newline

    if (row[0] && row[0].length > 0) {
      issues.push({
        title: row[0],
        description: row[1] || '',
        priority: row[2] || 'Medium',
        status: row[3] || 'Backlog',
        labels: row[4] || ''
      });
    }
  }

  return issues;
}

async function createIssue(issue) {
  const mutation = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
        }
      }
    }
  `;

  const variables = {
    input: {
      teamId: TEAM_ID,
      projectId: PROJECT_ID,
      title: issue.title.substring(0, 200),
      description: issue.description.substring(0, 10000),
      priority: PRIORITY_MAP[issue.priority] || 3
    }
  };

  return makeRequest(mutation, variables);
}

async function main() {
  const csvPath = path.join(__dirname, '..', 'specs', 'linear-import.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const issues = parseCSV(content);

  console.log(`Found ${issues.length} issues to import\n`);

  let success = 0;
  let failed = 0;

  for (const issue of issues) {
    try {
      const result = await createIssue(issue);
      if (result.data?.issueCreate?.success) {
        const created = result.data.issueCreate.issue;
        console.log(`✓ ${created.identifier}: ${created.title.substring(0, 60)}...`);
        success++;
      } else {
        console.log(`✗ Failed: ${issue.title.substring(0, 50)}...`);
        if (result.errors) console.log(`  Error: ${result.errors[0]?.message || 'Unknown'}`);
        failed++;
      }
      // Rate limit delay
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.log(`✗ Error: ${issue.title.substring(0, 50)}... - ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
