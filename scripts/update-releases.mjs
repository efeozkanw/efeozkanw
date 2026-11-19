import { readFile, writeFile } from 'node:fs/promises';

const user = process.env.GITHUB_USER ?? 'efeozkanw';
const token = process.env.GITHUB_TOKEN;
const limit = 5;
const section = /(### Recent releases\n\n)[\s\S]*?(\n\n### )/;

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': user,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status} for ${path}`);
  }
  return response.json();
}

const repos = await github(`/users/${user}/repos?type=owner&per_page=100`);
const releases = [];

for (const repo of repos) {
  if (repo.fork || repo.private || repo.archived || repo.name === user) {
    continue;
  }
  for (const release of await github(`/repos/${repo.full_name}/releases?per_page=${limit}`)) {
    if (!release.draft && !release.prerelease) {
      releases.push({
        name: `${repo.name} ${release.tag_name}`,
        url: release.html_url,
        date: release.published_at.slice(0, 10),
      });
    }
  }
}

releases.sort((a, b) => b.date.localeCompare(a.date));

const list = releases
  .slice(0, limit)
  .map((release) => `- [${release.name}](${release.url}), ${release.date}`)
  .join('\n');

const readme = await readFile('README.md', 'utf8');
if (!section.test(readme)) {
  throw new Error('README.md has no "Recent releases" section followed by another heading');
}

const updated = readme.replace(section, `$1${list || 'Nothing released yet.'}$2`);
if (updated !== readme) {
  await writeFile('README.md', updated);
  console.log('README.md updated');
}
