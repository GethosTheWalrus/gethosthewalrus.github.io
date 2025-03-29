const fs = require('fs');
const path = require('path');

const posts = require('./blog-posts.json');

const template = (post) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${post.title}</title>
  <meta property="og:title" content="${post.title}" />
  <meta property="og:description" content="${post.description}" />
  <meta property="og:image" content="${post.image}" />
  <meta property="og:url" content="https://miketoscano.com/blog/${post.slug}.html" />
  <meta http-equiv="refresh" content="0; url=/blog/?post=${post.slug}" />
</head>
<body>
  <p>Redirecting to blog...</p>
</body>
</html>
`;

const outputDir = path.join(__dirname, 'blog');

fs.mkdirSync(outputDir, { recursive: true });

for (const post of posts) {
  const filePath = path.join(outputDir, `${post.slug}.html`);
  fs.writeFileSync(filePath, template(post));
  console.log(`✅ Created ${filePath}`);
}
