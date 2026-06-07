// Telegram 通知：用 Bot API sendMessage。需要 bot token + 你的 chat_id。
export async function sendTelegram(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error('Telegram 推送失敗：HTTP ' + res.status);
}
