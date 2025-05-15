export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
  
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const webAppUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  
    try {
      const message = req.body.message?.text?.toLowerCase();
      const chatId = req.body.message?.chat?.id;
  
      if (!message) return res.status(200).end();
  
      const match = message.match(/(\d+)\s+(.+)/);
      if (!match) {
        await sendTelegramMessage(botToken, chatId, 'Vui lòng gửi định dạng: số ngày + quốc gia (VD: 5 Nhật Bản)');
        return res.status(200).json({ ok: true });
      }
  
      const [_, daysStr, areaRaw] = match;
      const keyword = `${daysStr} ${areaRaw.trim()}`;
      const url = `${webAppUrl}?keyword=${encodeURIComponent(keyword)}`;
  
      const response = await fetch(url);
      const data = await response.json();
  
      if (!data.result || data.result.length === 0) {
        await sendTelegramMessage(botToken, chatId, `Không tìm thấy gói phù hợp với "${keyword}"`);
        return res.status(200).json({ ok: true });
      }
  
      const reply = data.result.map(r =>
        `📶 ${r.product}: ${Number(r.price).toLocaleString('vi-VN')}đ`
      ).join('\n');
  
      await sendTelegramMessage(botToken, chatId, reply);
      res.status(200).json({ ok: true });
  
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal error' });
    }
  }
  
  // Hàm gửi tin nhắn đến Telegram
  async function sendTelegramMessage(botToken, chatId, text) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }
  