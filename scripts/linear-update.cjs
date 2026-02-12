/**
 * Update Linear Task Status - CommonJS version
 * Usage: node scripts/linear-update.cjs UNI-XXX "Done"
 */
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.LINEAR_API_KEY || 'lin_api_8M0bmmAHL6ovhBsZKIpYVWz23RVGDSE9HSZdgAtD';
const taskId = process.argv[2];
const targetState = process.argv[3] || 'Done';

if (!taskId) {
  console.error('Usage: node scripts/linear-update.cjs UNI-XXX [State]');
  console.error('States: Todo, In Progress, Done, Canceled');
  process.exit(1);
}

function graphqlRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    const options = {
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
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

async function updateTaskStatus() {
  try {
    // Get the issue and team states
    const issueQuery = `
      query GetIssue($identifier: String!) {
        issue(id: $identifier) {
          id
          identifier
          title
          state { id name }
          team {
            id
            states { nodes { id name type } }
          }
        }
      }
    `;

    const issueResult = await graphqlRequest(issueQuery, { identifier: taskId });

    if (issueResult.errors) {
      console.error('Error:', issueResult.errors[0].message);
      process.exit(1);
    }

    const issue = issueResult.data?.issue;
    if (!issue) {
      console.error(`Issue ${taskId} not found`);
      process.exit(1);
    }

    console.log(`Found: ${issue.identifier} - ${issue.title}`);
    console.log(`Current state: ${issue.state.name}`);

    // Find target state
    const states = issue.team.states.nodes;
    const targetStateObj = states.find(s =>
      s.name.toLowerCase() === targetState.toLowerCase()
    );

    if (!targetStateObj) {
      console.error(`State "${targetState}" not found. Available:`);
      states.forEach(s => console.log(`  - ${s.name}`));
      process.exit(1);
    }

    // Update
    const updateMutation = `
      mutation UpdateIssue($id: String!, $stateId: String!) {
        issueUpdate(id: $id, input: { stateId: $stateId }) {
          success
          issue { identifier state { name } }
        }
      }
    `;

    const updateResult = await graphqlRequest(updateMutation, {
      id: issue.id,
      stateId: targetStateObj.id
    });

    if (updateResult.errors) {
      console.error('Error:', updateResult.errors[0].message);
      process.exit(1);
    }

    if (updateResult.data?.issueUpdate?.success) {
      const updated = updateResult.data.issueUpdate.issue;
      console.log(`✅ Updated ${updated.identifier} to "${updated.state.name}"`);
    } else {
      console.error('Failed to update');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

updateTaskStatus();
