const fs = require('fs');
const path = require('path');

// Files that use Tailwind CDN
const files = [
  'public/app.html',
  'public/login.html',
  'public/demo.html',
  'public/auth-improved.html',
  'public/auth.html'
];

// Replace Tailwind CDN with production CSS
files.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace Tailwind CDN script tag
    content = content.replace(
      /<script\s+src="https:\/\/cdn\.tailwindcss\.com"><\/script>/g,
      '<link rel="stylesheet" href="/css/production.css">'
    );
    
    // Also handle any variants with different formatting
    content = content.replace(
      /<script\s+src=["']https:\/\/cdn\.tailwindcss\.com["'].*?><\/script>/g,
      '<link rel="stylesheet" href="/css/production.css">'
    );
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated ${file}`);
  } else {
    console.log(`⚠️ File not found: ${file}`);
  }
});

console.log('\n✅ All HTML files updated to use production CSS');