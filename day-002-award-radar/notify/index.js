// 可插拔通知總管：.env 設了哪個管道就推哪個，沒設就跳過。
// 想加新管道（LINE / Slack / Email）只要在這裡多接一段即可。
import { sendDiscord } from './discord.js';
import { sendTelegram } from './telegram.js';

export async function notify(text) {
  const sent = [];
  const { DISCORD_WEBHOOK_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

  if (DISCORD_WEBHOOK_URL) {
    try { await sendDiscord(DISCORD_WEBHOOK_URL, text); sent.push('Discord'); }
    catch (e) { console.error('  ✗ Discord：', e.message); }
  }
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    try { await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, text); sent.push('Telegram'); }
    catch (e) { console.error('  ✗ Telegram：', e.message); }
  }
  return sent;
}

export function notifyEnabled() {
  const { DISCORD_WEBHOOK_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  return !!(DISCORD_WEBHOOK_URL || (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID));
}
