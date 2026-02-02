/**
 * List Linear Tasks
 * Quick utility to view pending Linear tasks
 */

require('dotenv').config({ path: '.env.local' });

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

async function listTasks() {
  const query = `
    query {
      issues(
        filter: {
          state: { type: { nin: ["completed", "canceled"] } }
          team: { key: { eq: "UNI" } }
        }
        first: 15
        orderBy: updatedAt
      ) {
        nodes {
          identifier
          title
          priority
          state { name }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();

    if (data.errors) {
      console.error('Linear API Error:', data.errors);
      return;
    }

    const issues = data.data?.issues?.nodes || [];

    console.log('\n📋 Linear Priority Tasks');
    console.log('='.repeat(60));

    if (issues.length === 0) {
      console.log('No pending tasks found!');
      return;
    }

    issues.forEach((issue, i) => {
      const priorityLabel = {
        0: '🔴 Urgent',
        1: '🟠 High',
        2: '🟡 Medium',
        3: '🟢 Low',
        4: '⚪ None',
      }[issue.priority] || '⚪';

      console.log(`${i + 1}. [${issue.state.name}] ${issue.identifier}: ${issue.title}`);
      console.log(`   Priority: ${priorityLabel}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log(`Total: ${issues.length} pending tasks`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

listTasks();
