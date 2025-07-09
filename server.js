const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;
countGET=0
countPOST=0
app.use(cors()); // CORS'u aktif ediyoruz

let counter = 0; // Global sayaç
let latestData = { message: "Hello from server", counter }; // En güncel veri burada
setInterval(() => {
    const activeHandles = process._getActiveHandles();

    console.log(`🧵 Aktif Handle Sayısı: ${activeHandles.length}`);
    activeHandles.forEach((handle, i) => {
        console.log(`🔍 [${i}] Handle Tipi: ${handle.constructor.name}`);
    });
}, 5000);
let previous = Date.now();
setInterval(() => {
  const now = Date.now();
  const drift = now - previous;
  previous = now;
  console.log(`⏱ Drift: ${drift}ms`);
}, 1000);
// GET endpoint
app.get('/payload', (req, res) => {
  countGET++
    console.log("get: "+countGET)
    res.json({ status: 'ok', timestamp: Date.now() });
});

// POST endpoint
app.post('/payload', (req, res) => {
  
  countPOST++
    console.log(countPOST)
    res.json({ status: 'received', timestamp: Date.now() });
});

app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    counter++;
    console.log('🔗 Yeni bağlantı açıldı, veri gönderimi başlıyor...'+counter);
    
    const intervalId = setInterval(() => {
        if (res.writableEnded) {
            
            counter--;
            console.log('❌ Client bağlantısı kapandı.'+counter);
            clearInterval(intervalId);
            return;
        }
 // Global sayacı artır
        latestData = { message: "Hello from server", counter };

        res.write(`data: ${JSON.stringify(latestData)}\n\n`);
        //console.log('📤 Gönderilen veri:', latestData);
    }, 1000);

    req.on('close', () => {
        clearInterval(intervalId);
        counter--;
        console.log('📴 Bağlantı client tarafından sonlandırıldı.'+counter);
    });
});
app.get('/test', (req, res) => {
    res.sendFile(__dirname + '/test.html');
});

app.listen(port, () => {
    console.log(`🚀 Sunucu çalışıyor: http://localhost:${port}`);
});
