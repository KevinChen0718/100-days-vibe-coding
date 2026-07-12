#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    process.stdin.on('data', (chunk) => {
      input += chunk.toString();
    });
    process.stdin.on('end', () => resolve(input));
  });
}

function slugTitle(filePath) {
  return path.basename(filePath, path.extname(filePath))
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim() || '未命名筆記';
}

function appendUnique(filePath, line) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (current.includes(line)) return;
  fs.appendFileSync(filePath, `${line}\n`, 'utf8');
}

async function main() {
  await readStdin();

  if (process.argv.includes('--fail')) {
    console.error('fake agent planned failure');
    process.exit(42);
    return;
  }

  const sourceRelative = process.env.INBOX_DISTILLER_FILE;
  const knowledge = process.env.INBOX_DISTILLER_KNOWLEDGE;
  const indexName = process.env.INBOX_DISTILLER_INDEX;
  const journalName = process.env.INBOX_DISTILLER_JOURNAL;

  if (!sourceRelative || !knowledge || !indexName || !journalName) {
    console.error('fake agent missing env');
    process.exit(2);
    return;
  }

  const sourcePath = path.resolve(process.cwd(), sourceRelative);
  const knowledgeDir = path.resolve(process.cwd(), knowledge);
  const indexPath = path.resolve(process.cwd(), indexName);
  const journalPath = path.resolve(process.cwd(), journalName);
  const title = slugTitle(sourceRelative);
  const notePath = path.join(knowledgeDir, `${title}.md`);
  const content = fs.readFileSync(sourcePath, 'utf8');
  const date = new Date().toISOString().slice(0, 10);

  fs.mkdirSync(knowledgeDir, { recursive: true });
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.mkdirSync(path.dirname(journalPath), { recursive: true });
  fs.writeFileSync(notePath, [
    `# ${title}`,
    '',
    `來源：[[${title}]]`,
    '',
    '## 摘要',
    content.trim() || '空白內容',
    '',
    '## 連結',
    `- [[${indexName.replace(/\.md$/i, '')}]]`,
    '',
  ].join('\n'), 'utf8');

  appendUnique(indexPath, `[[${title}]] — fake agent 蒸餾摘要`);
  fs.appendFileSync(journalPath, `## ${date} 匯入 | ${path.basename(sourceRelative)}\n- [[${title}]]\n`, 'utf8');

  console.log(`NOTE: ${knowledge}/${title}.md`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
