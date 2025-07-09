// server.js (Glitch projenizdeki ana dosya)

const express = require('express');
const app = express();
const port = process.env.PORT || 10000; // Glitch portu otomatik olarak ayarlar

// Bağlı istemcileri tutmak için bir Set (benzersiz ve hızlı erişim)
const clients = new Set();

// Kök dizin için basit bir HTML sayfası sunar
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// SSE endpoint'i
app.get('/events', (req, res) => {
  // Gerekli HTTP başlıklarını ayarla
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx/Proxy buffer'lamayı kapatmak için

  // Bağlantıyı hemen sonlandırmamasını sağlamak için.
  // Tarayıcılar genellikle bağlantıyı açık tutmaya çalışır ancak
  // bu, Node.js'in altında çalışan HTTP modülünün varsayılan davranışını değiştirebilir.
  req.socket.setTimeout(0); 
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true, 120000); // Bağlantıyı 2 dakika canlı tut (opsiyonel)

  // Yeni istemciyi listeye ekle
  clients.add(res);
  console.log(`[${new Date().toLocaleTimeString()}] New SSE client connected. Total clients: ${clients.size}`);

  // Bağlantı kesildiğinde istemciyi listeden çıkar
  req.on('close', () => {
    clients.delete(res);
    console.log(`[${new Date().toLocaleTimeString()}] SSE client disconnected. Total clients: ${clients.size}`);
  });

  // İlk bağlantıda bir hoş geldin mesajı gönderebiliriz
  res.write('data: Welcome to SSE stream!\n\n');
});

// Periyodik olarak tüm bağlı istemcilere veri gönderen fonksiyon
function sendEventToClients(data, eventType = 'message') {
  clients.forEach(res => {
    try {
      if (eventType === 'message') {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } else if (eventType === 'heartbeat') {
        res.write(':\n\n'); // SSE yorum satırı, genellikle heartbeat için kullanılır
      }
    } catch (error) {
      console.error(`Error sending data to client: ${error.message}`);
      // Hata durumunda istemciyi listeden çıkarmayı düşünebilirsiniz
      // clients.delete(res);
    }
  });
}

// Her 5 saniyede bir örnek veri gönder
setInterval(() => {
  const data = {
    timestamp: new Date().toLocaleTimeString(),
    message: `Server update! Active clients: ${clients.size}`
  };
  sendEventToClients(data, 'message');
}, 5000);

// Her 3 saniyede bir heartbeat (boş yorum satırı) gönder
// Bu, bağlantının canlı kalmasını sağlamak içindir.
setInterval(() => {
  sendEventToClients(null, 'heartbeat');
}, 3000);

// Sunucuyu dinlemeye başla
app.listen(port, () => {
  console.log(`[${new Date().toLocaleTimeString()}] SSE Server listening at http://localhost:${port}`);
});
