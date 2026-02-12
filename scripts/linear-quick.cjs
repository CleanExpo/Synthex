/**
 * Quick Linear Tasks List - CommonJS version
 */
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.LINEAR_API_KEY || 'lin_api_8M0bmmAHL6ovhBsZKIpYVWz23RVGDSE9HSZdgAtD';

const query = JSON.stringify({
  query: `{
    issues(filter: { state: { type: { nin: ["completed", "canceled"] } }, team: { key: { eq: "UNI" } } }, orderBy: updatedAt, first: 15) {
      nodes {
        identifier
        title
        priority
        priorityLabel
        state { name }
        labels { nodes { name } }
      }
    }
  }`
});

const options = {
  hostname: 'api.linear.app',
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': apiKey
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.errors) {
      console.log('Error:', json.errors[0].message);
    } else {
      console.log('\n📋 OPEN LINEAR TASKS (UNI Team)\n');
      console.log('='.repeat(70));
      const issues = json.data.issues.nodes;
      issues.forEach((i, idx) => {
        const labels = i.labels.nodes.map(l => l.name).join(', ') || '-';
        console.log(`${idx+1}. [${i.state.name}] ${i.identifier}: ${i.title}`);
        console.log(`   Priority: ${i.priorityLabel || 'None'} | Labels: ${labels}\n`);
      });
      console.log('='.repeat(70));
      console.log(`Total: ${issues.length} open tasks`);
    }
  });
});
req.on('error', e => console.error('Error:', e.message));
req.write(query);
req.end();
