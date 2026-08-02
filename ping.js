const https = require('https');
const http = require('http');

// Render'da servisinin canlı URL'sini buraya yaz
// Environment variable tanımladıysan RENDER_EXTERNAL_URL otomatik çekilir
const URL = process.env.RENDER_EXTERNAL_URL || 'https://java-compiler.onrender.com';

// 10 dakikada bir (600,000 ms) ping atacak
const INTERVAL = 10 * 60 * 1000;

function keepAlive() {
  console.log(`[PING] (${new Date().toISOString()}) Servis uyandırılıyor: ${URL}`);
  
  const client = URL.startsWith('https') ? https : http;

  client.get(URL, (res) => {
    console.log(`[PING SUCCESS] Yanıt kodu: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`[PING ERROR] Hata oluştu: ${err.message}`);
  });
}

// İlk çalışmada hemen bir kere at, sonra her 10 dakikada bir tekrarla
keepAlive();
setInterval(keepAlive, INTERVAL);