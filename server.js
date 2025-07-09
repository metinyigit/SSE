// server.js

const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

// JSON body parser'ı etkinleştir
app.use(express.json());

// Bağlı istemcileri tutmak için bir Set
const clients = new Set();

// Node.js Process Memory Usage'ı loglamak için
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  console.log(`[${new Date().toLocaleTimeString()}] Node.js Process Memory Usage:`);
  console.log(`  RSS (Total Allocated): ${ (memoryUsage.rss / 1024 / 1024).toFixed(2) } MB`);
  console.log(`  Heap Total (V8 Heap): ${ (memoryUsage.heapTotal / 1024 / 1024).toFixed(2) } MB`);
  console.log(`  Heap Used (Used by V8): ${ (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) } MB`);
  console.log(`  External (C++ Objects): ${ (memoryUsage.external / 1024 / 1024).toFixed(2) } MB`);
}, 10000);

// Kök dizin için basit bir HTML sayfası sunar (GET isteği)
app.get('/', (req, res) => {
  const clientInfo = {
    method: 'GET',
    path: '/',
    ip: req.ip || req.connection.remoteAddress, // İstemci IP adresi
    timestamp: new Date().toLocaleTimeString()
  };
  console.log(`[${clientInfo.timestamp}] GET isteği alındı: ${clientInfo.path} - İstemci IP: ${clientInfo.ip}`);
  
  // Tüm bağlı SSE istemcilerine bu olayı bildir
  sendEventToClients({ type: 'http_request', data: clientInfo }, 'message');

  res.sendFile(__dirname + '/index.html');
});

// Kök dizine yapılan POST isteklerini işler
app.post('/', (req, res) => {
  const clientInfo = {
    method: 'POST',
    path: '/',
    ip: req.ip || req.connection.remoteAddress, // İstemci IP adresi
    body: req.body, // Python istemcisinden gelen veri
    timestamp: new Date().toLocaleTimeString()
  };
  console.log(`[${clientInfo.timestamp}] POST isteği alındı: ${clientInfo.path} - İstemci IP: ${clientInfo.ip}`);
  console.log('Alınan POST verisi:', clientInfo.body);

  // Tüm bağlı SSE istemcilerine bu olayı bildir
  sendEventToClients({ type: 'http_request', data: clientInfo }, 'message');
  
  res.status(200).json({ status: 'success', message: 'POST isteği alındı!', data: req.body });
});

// SSE endpoint'i
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); 

  req.socket.setTimeout(0); 
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true, 120000);

  clients.add(res);
  console.log(`[${new Date().toLocaleTimeString()}] Yeni SSE istemcisi bağlandı. Toplam istemci: ${clients.size}`);

  req.on('close', () => {
    clients.delete(res);
    console.log(`[${new Date().toLocaleTimeString()}] SSE istemcisi bağlantısı kesildi. Toplam istemci: ${clients.size}`);
  });

  res.write('data: Welcome to SSE stream!\n\n');
});

// Periyodik olarak tüm bağlı istemcilere veri gönderen fonksiyon
function sendEventToClients(data, eventType = 'message') {
  clients.forEach(res => {
    try {
      if (eventType === 'message') {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } else if (eventType === 'heartbeat') {
        res.write(':\n\n');
      }
    } catch (error) {
      console.error(`İstemciye veri gönderirken hata: ${error.message}`);
    }
  });
}

// Her 5 saniyede bir örnek veri gönder
setInterval(() => {
  const data = {
    type: 'server_update',
    timestamp: new Date().toLocaleTimeString(),
    message: `Sunucu güncellemesi! Aktif istemciler: ${clients.size}`
  };
  sendEventToClients(data, 'message');
}, 5000);

// Her 3 saniyede bir heartbeat (boş yorum satırı) gönder
setInterval(() => {
  sendEventToClients(null, 'heartbeat');
}, 3000);

app.listen(port, () => {
  console.log(`[${new Date().toLocaleTimeString()}] SSE Sunucusu çalışıyor: http://localhost:${port}`);
});
