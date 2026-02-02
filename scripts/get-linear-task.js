#!/usr/bin/env node
/**
 * Get Linear task details
 */
const https = require('https');
const apiKey = process.env.LINEAR_API_KEY || 'lin_api_8M0bmmAHL6ovhBsZKIpYVWz23RVGDSE9HSZdgAtD';
const taskId = process.argv[2];

if (!taskId) {
  console.error('Usage: node get-linear-task.js <task-id>');
  process.exit(1);
}

const query = JSON.stringify({
  query: `{ issue(id: "${taskId}") { identifier title description priority priorityLabel state { name } labels { nodes { name } } } }`
});

const options = {
  hostname: 'api.linear.app',
  path: '/graphql',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': apiKey }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.data && json.data.issue) {
      const i = json.data.issue;
      console.log('═'.repeat(60));
      console.log(`Task: ${i.identifier}`);
      console.log(`Title: ${i.title}`);
      console.log(`Priority: ${i.priorityLabel || i.priority}`);
      console.log(`State: ${i.state.name}`);
      console.log('─'.repeat(60));
      console.log('Description:');
      console.log(i.description || 'No description provided');
      console.log('═'.repeat(60));
    } else {
      console.log('Task not found or error:', JSON.stringify(json, null, 2));
    }
  });
});
req.write(query);
req.end();
