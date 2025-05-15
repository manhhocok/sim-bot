// pages/api/bot.js
import { google } from 'googleapis';

const sheetId = process.env.GOOGLE_SHEET_ID;
const botToken = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const message = req.body.message?.text?.toLowerCase();
    const chatId = req.body.message?.chat?.id;

    if (!message) return res.status(200).end();

    const match = message.match(/(\d+)\s+(.+)/);
    if (!match) {
      await sendTelegramMessage(chatId, 'Vui lòng gửi định dạng: số ngày + quốc gia (VD: 5 Nhật Bản)');
      return res.status(200).json({ ok: true });
    }

    const [_, daysStr, areaRaw] = match;
    const days = parseInt(daysStr);
    const area = areaRaw.trim();

    const rows = await fetchSheetData();
    const filtered = rows.filter(row =>
      parseInt(row[1]) === days &&
      row[2].toLowerCase().includes(area.toLowerCase())
    );

    if (filtered.length === 0) {
      await sendTelegramMessage(chatId, `Không tìm thấy gói phù hợp với "${days} ${area}"`);
      return res.status(200).json({ ok: true });
    }

    const reply = filtered.map(r => `📶 ${r[0]}: ${Number(r[3]).toLocaleString('vi-VN')}đ`).join('\n');
    await sendTelegramMessage(chatId, reply);
    res.status(200).json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  }
}

// Kết nối Google Sheets
async function fetchSheetData() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const range = 'Sheet1!A2:E'; // Sheet + range (bỏ hàng tiêu đề)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });

  return response.data.values || [];
}

// Gửi tin nhắn Telegram
async function sendTelegramMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
