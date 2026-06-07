// Discord 通知：走頻道 webhook，最簡單、不用養 bot。
export async function sendDiscord(webhookUrl, text) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text }),
  });
  if (!res.ok) throw new Error('Discord 推送失敗：HTTP ' + res.status);
}
