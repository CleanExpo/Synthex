/**
 * Import v1.5 tasks to Linear
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const LINEAR_API_KEY = process.env.LINEAR_API_KEY || 'lin_api_8M0bmmAHL6ovhBsZKIpYVWz23RVGDSE9HSZdgAtD';
const TEAM_KEY = 'UNI';

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
  i++;

  while (i < chars.length) {
    const row = [];
    for (let fieldNum = 0; fieldNum < 5 && i < chars.length; fieldNum++) {
      let field = '';
      if (chars[i] === '"') {
        i++;
        while (i < chars.length) {
          if (chars[i] === '"' && chars[i + 1] === '"') {
            field += '"';
            i += 2;
          } else if (chars[i] === '"') {
            i++;
            break;
          } else {
            field += chars[i];
            i++;
          }
        }
      } else {
        while (i < chars.length && chars[i] !== ',' && chars[i] !== '\n' && chars[i] !== '\r') {
          field += chars[i];
          i++;
        }
      }
      row.push(field.trim());
      if (chars[i] === ',') i++;
      else if (chars[i] === '\r') i++;
    }
    while (i < chars.length && chars[i] !== '\n') i++;
    i++;

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

async function getTeamId() {
  const query = `{
    teams { nodes { id key name } }
  }`;
  const result = await makeRequest(query);
  const team = result.data?.teams?.nodes?.find(t => t.key === TEAM_KEY);
  if (!team) throw new Error(`Team ${TEAM_KEY} not found`);
  return team.id;
}

async function createIssue(teamId, issue) {
  const mutation = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier title }
      }
    }
  `;

  const variables = {
    input: {
      teamId,
      title: issue.title.substring(0, 200),
      description: issue.description.substring(0, 10000),
      priority: PRIORITY_MAP[issue.priority] || 3
    }
  };

  return makeRequest(mutation, variables);
}

async function main() {
  const csvPath = path.join(__dirname, '..', 'specs', 'v1.5-tasks.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const issues = parseCSV(content);

  console.log(`\n📋 Importing ${issues.length} v1.5 tasks to Linear\n`);
  console.log('='.repeat(60));

  const teamId = await getTeamId();
  console.log(`Team ID: ${teamId}\n`);

  let success = 0;
  let failed = 0;

  for (const issue of issues) {
    try {
      const result = await createIssue(teamId, issue);
      if (result.data?.issueCreate?.success) {
        const created = result.data.issueCreate.issue;
        console.log(`✓ ${created.identifier}: ${created.title.substring(0, 50)}...`);
        success++;
      } else {
        console.log(`✗ Failed: ${issue.title.substring(0, 40)}...`);
        if (result.errors) console.log(`  Error: ${result.errors[0]?.message}`);
        failed++;
      }
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.log(`✗ Error: ${issue.title.substring(0, 40)}... - ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Import Complete`);
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}`);
}

main().catch(console.error);
