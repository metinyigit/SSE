// server.js

const express = require('express');
const app = express();
const port = process.env.PORT || 10000; // Render, PORT ortam değişkenini atayacak

// JSON body parser'ı etkinleştir
// Bu, POST istekleriyle gönderilen JSON verilerini req.body içinde ayrıştırmanı sağlar.
app.use(express.json()); 

// Bağlı istemcileri tutmak için bir Set (benzersiz ve hızlı erişim)
const clients = new Set();

// Node.js Process Memory Usage'ı loglamak için (Render panelinde görünür)
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  console.log(`[${new Date().toLocaleTimeString()}] Node.js Process Memory Usage:`);
  console.log(`  RSS (Total Allocated): ${ (memoryUsage.rss / 1024 / 1024).toFixed(2) } MB`);
  console.log(`  Heap Total (V8 Heap): ${ (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) } MB`);
  console.log(`  Heap Used (Used by V8): ${ (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) } MB`);
  console.log(`  External (C++ Objects): ${ (memoryUsage.external / 1024 / 1024).toFixed(2) } MB`);
}, 10000); // Her 10 saniyede bir logla

// Kök dizin için basit bir HTML sayfası sunar (GET isteği)
// Aynı rota, POST isteklerini de işleyebilir
app.get('/', (req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] GET isteği alındı: /`);
  res.sendFile(__dirname + '/index.html');
});

// Kök dizine yapılan POST isteklerini işler
app.post('/', (req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] POST isteği alındı: /`);
  console.log('Alınan POST verisi:', req.body); // Python istemcisinden gelen veriyi logla

  // İstemciye basit bir başarı yanıtı gönder
  res.status(200).json({ status: 'success', message: 'POST isteği alındı!', data: req.body });
});

// SSE endpoint'i
app.get('/events', (req, res) => {
  // Gerekli HTTP başlıklarını ayarla
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx/Proxy buffer'lamayı kapatmak için

  // Bağlantıyı hemen sonlandırmamasını sağlamak için.
  req.socket.setTimeout(0); 
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true, 120000); // Bağlantıyı 2 dakika canlı tut (opsiyonel)

  // Yeni istemciyi listeye ekle
  clients.add(res);
  console.log(`[${new Date().toLocaleTimeString()}] Yeni SSE istemcisi bağlandı. Toplam istemci: ${clients.size}`);

  // Bağlantı kesildiğinde istemciyi listeden çıkar
  req.on('close', () => {
    clients.delete(res);
    console.log(`[${new Date().toLocaleTimeString()}] SSE istemcisi bağlantısı kesildi. Toplam istemci: ${clients.size}`);
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
      console.error(`İstemciye veri gönderirken hata: ${error.message}`);
      // Hata durumunda istemciyi listeden çıkarmayı düşünebilirsiniz
      // clients.delete(res);
    }
  });
}

// Her 5 saniyede bir örnek veri gönder
setInterval(() => {
  const data = {
    timestamp: new Date().toLocaleTimeString(),
    message: `Sunucu güncellemesi! Aktif istemciler: ${clients.size}`
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
  console.log(`[${new Date().toLocaleTimeString()}] SSE Sunucusu çalışıyor: http://localhost:${port}`);
});
