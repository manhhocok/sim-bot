export default async function handler(req, res) {
  console.log('Request method:', req.method);
  console.log('Request body:', JSON.stringify(req.body));

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }


  console.log('Request method:', req.method);

  // Check webhook status bằng GET
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'Webhook is running' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).end('Method Not Allowed');
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webAppUrl = process.env.GOOGLE_APPS_SCRIPT_URL;

  if (!botToken || !webAppUrl) {
    console.error('Missing environment variables:', { botToken, webAppUrl });
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  try {
    const message = req.body.message?.text?.toLowerCase();
    const chatId = req.body.message?.chat?.id;
    console.log('Received message:', message, 'chatId:', chatId);

    if (!message || !chatId) {
      console.warn('Invalid message or chat ID');
      return res.status(200).end();
    }

    const match = message.match(/(\d+)\s+(.+)/);
    if (!match) {
      await safeSendTelegramMessage(botToken, chatId, 'Vui lòng gửi định dạng: số ngày + quốc gia (VD: 5 Nhật Bản)');
      return res.status(200).json({ ok: true });
    }

    const [_, daysStr, areaRaw] = match;
    const keyword = `${daysStr} ${areaRaw.trim()}`;
    const url = `${webAppUrl}?keyword=${encodeURIComponent(keyword)}`;

    console.log('Fetching data from URL:', url);

    let response;
    try {
      response = await fetch(url);
    } catch (fetchErr) {
      console.error('Error calling Google Apps Script:', fetchErr.message);
      await safeSendTelegramMessage(botToken, chatId, 'Lỗi kết nối đến hệ thống. Vui lòng thử lại sau.');
      return res.status(200).json({ ok: false });
    }

    // Kiểm tra content-type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Invalid response (not JSON):', text);
      await safeSendTelegramMessage(botToken, chatId, 'Phản hồi không hợp lệ từ hệ thống.');
      return res.status(200).json({ ok: false });
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonErr) {
      console.error('Error parsing JSON response:', jsonErr.message);
      await safeSendTelegramMessage(botToken, chatId, 'Phản hồi không hợp lệ từ hệ thống.');
      return res.status(200).json({ ok: false });
    }

    console.log('Data from Apps Script:', data);

    if (!data.result || data.result.length === 0) {
      await safeSendTelegramMessage(botToken, chatId, `Không tìm thấy gói phù hợp với "${keyword}"`);
      return res.status(200).json({ ok: true });
    }

    const reply = data.result.map(r =>
      `📶 ${r.product}: ${Number(r.price).toLocaleString('vi-VN')}đ`
    ).join('\n');

    await safeSendTelegramMessage(botToken, chatId, reply);
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Unhandled error:', err.message, err.stack);
    return res.status(500).json({ error: 'Internal error' });
  }
}

// Hàm gửi tin nhắn với xử lý lỗi an toàn
async function safeSendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    console.log('Sending message:', text);
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error('Error sending Telegram message:', err.message);
  }
}
