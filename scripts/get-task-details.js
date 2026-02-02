#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql';
const API_KEY = process.env.LINEAR_API_KEY;

async function getTaskDetails(identifier) {
  const query = `
    query {
      issueSearch(filter: { identifier: { eq: "${identifier}" } }) {
        nodes {
          id
          identifier
          title
          description
          priority
          state { name }
          children {
            nodes {
              identifier
              title
              state { name }
              priority
            }
          }
        }
      }
    }
  `;

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': API_KEY
    },
    body: JSON.stringify({ query })
  });

  const data = await response.json();
  const issue = data.data?.issueSearch?.nodes?.[0];

  if (issue) {
    console.log('\n📌 Task: ' + issue.identifier + ' - ' + issue.title);
    console.log('Status: ' + (issue.state?.name || 'Unknown'));
    console.log('Priority: ' + issue.priority);
    console.log('\nDescription:\n' + (issue.description || '(none)'));

    if (issue.children?.nodes?.length > 0) {
      console.log('\nSub-tasks (' + issue.children.nodes.length + '):');
      issue.children.nodes.forEach(function(child, i) {
        console.log('  ' + (i+1) + '. [' + (child.state?.name || '') + '] ' + child.identifier + ': ' + child.title);
      });
    } else {
      console.log('\nNo sub-tasks found.');
    }
  } else {
    console.log('Task not found');
  }
}

const taskId = process.argv[2] || 'UNI-435';
getTaskDetails(taskId);
