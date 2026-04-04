/**
 * Create Linear Task
 * Usage: node scripts/create-linear-task.js "Title" "Description" [priority]
 * Priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error('Error: LINEAR_API_KEY not found in environment');
  process.exit(1);
}

const title = process.argv[2];
const description = process.argv[3] || '';
const priority = parseInt(process.argv[4]) || 3; // Default to Medium

if (!title) {
  console.error('Usage: node scripts/create-linear-task.js "Title" "Description" [priority]');
  console.error('Priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low');
  process.exit(1);
}

async function graphqlRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });

    const options = {
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Failed to parse response'));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function createTask() {
  try {
    // First, get the team ID
    const teamsQuery = `
      query {
        teams {
          nodes {
            id
            name
            key
          }
        }
      }
    `;

    const teamsResult = await graphqlRequest(teamsQuery);

    if (teamsResult.errors) {
      console.error('Error fetching teams:', teamsResult.errors[0].message);
      process.exit(1);
    }

    const teams = teamsResult.data?.teams?.nodes;
    if (!teams || teams.length === 0) {
      console.error('No teams found');
      process.exit(1);
    }

    // Use the first team (or find UNI team)
    const team = teams.find(t => t.key === 'UNI') || teams[0];
    console.log(`Using team: ${team.name} (${team.key})`);

    // Get the "Done" state for marking as completed
    const statesQuery = `
      query GetStates($teamId: String!) {
        team(id: $teamId) {
          states {
            nodes {
              id
              name
              type
            }
          }
        }
      }
    `;

    const statesResult = await graphqlRequest(statesQuery, { teamId: team.id });
    const states = statesResult.data?.team?.states?.nodes || [];
    const doneState = states.find(s => s.name.toLowerCase() === 'done' || s.type === 'completed');

    // Create the issue
    const createMutation = `
      mutation CreateIssue($teamId: String!, $title: String!, $description: String, $priority: Int, $stateId: String) {
        issueCreate(input: {
          teamId: $teamId,
          title: $title,
          description: $description,
          priority: $priority,
          stateId: $stateId
        }) {
          success
          issue {
            id
            identifier
            title
            url
            state {
              name
            }
          }
        }
      }
    `;

    const createResult = await graphqlRequest(createMutation, {
      teamId: team.id,
      title: title,
      description: description,
      priority: priority,
      stateId: doneState?.id // Set to Done state if found
    });

    if (createResult.errors) {
      console.error('Error creating issue:', createResult.errors[0].message);
      process.exit(1);
    }

    if (createResult.data?.issueCreate?.success) {
      const issue = createResult.data.issueCreate.issue;
      console.log(`\n✅ Created task: ${issue.identifier}`);
      console.log(`   Title: ${issue.title}`);
      console.log(`   Status: ${issue.state.name}`);
      console.log(`   URL: ${issue.url}`);
    } else {
      console.error('Failed to create issue');
      process.exit(1);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createTask();
