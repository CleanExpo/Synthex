const https = require('https');
const apiKey = process.env.LINEAR_API_KEY || 'lin_api_8M0bmmAHL6ovhBsZKIpYVWz23RVGDSE9HSZdgAtD';

const query = JSON.stringify({
  query: `{
    issues(filter: { state: { type: { nin: ["completed", "canceled"] } } }, orderBy: updatedAt, first: 20) {
      nodes {
        identifier
        title
        priority
        priorityLabel
        state { name type }
        labels { nodes { name } }
        assignee { name }
        project { name }
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
    try {
      const json = JSON.parse(data);
      if (json.errors) {
        console.log('Errors:', JSON.stringify(json.errors, null, 2));
      } else {
        const issues = json.data.issues.nodes;
        console.log('=== OPEN LINEAR ISSUES ===\n');

        // Sort by priority (1=Urgent, 2=High, 3=Medium, 4=Low, 0=None)
        const sorted = issues.sort((a, b) => {
          const pa = a.priority === 0 ? 5 : a.priority;
          const pb = b.priority === 0 ? 5 : b.priority;
          return pa - pb;
        });

        sorted.forEach(i => {
          const labels = i.labels.nodes.map(l => l.name).join(', ') || 'none';
          const project = i.project ? i.project.name : 'No project';
          const assignee = i.assignee ? i.assignee.name : 'Unassigned';
          console.log(`[${i.identifier}] ${i.priorityLabel || 'No priority'}`);
          console.log(`  Title: ${i.title}`);
          console.log(`  Status: ${i.state.name} | Project: ${project}`);
          console.log(`  Assignee: ${assignee} | Labels: ${labels}`);
          console.log('');
        });
      }
    } catch(e) {
      console.log('Parse error:', e.message);
      console.log('Raw data:', data);
    }
  });
});
req.on('error', e => console.error('Error:', e.message));
req.write(query);
req.end();
