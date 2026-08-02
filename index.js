/**
 * =======================================================
 *               ☕ CodeStudio ☕
 *         Multi-File Java Compiler & Builder
 * =======================================================
 * Created with passion for Java lovers!
 */

// 🚀 Self-Ping Mekanizmasını Başlat (Render'ın uykuya geçmesini engeller)
require('./ping.js');

const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing ve Statik klasör yapılandırması
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Geçici derleme dizini
const TEMP_DIR = path.join(__dirname, 'temp_builds');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Konsol Kahve Logu
console.log(`
  (  )   (   )  )
   ) (   )  (  (
  ( )  (    ) )
  _____________
 |             |___
 |  CodeStudio     |   |  ☕ CodeStudio Compiler
 |             |___|  🚀 Engine Powered & Ready!
 |_____________|
`);

/**
 * API: /api/compile
 * POST Body: 
 * {
 *   files: [
 *     { fileName: "Main.java", content: "public class Main { ... }" },
 *     { fileName: "Helper.java", content: "public class Helper { ... }" }
 *   ]
 * }
 */
app.post('/api/compile', (req, res) => {
    const { files } = req.body;

    // Doğrulama
    if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({
            success: false,
            provider: 'CodeStudio',
            error: 'Lütfen en az bir adet .java dosyası gönderin ☕'
        });
    }

    // Her derleme oturumu için benzersiz kimlik (Session ID)
    const sessionId = crypto.randomBytes(8).toString('hex');
    const sessionDir = path.join(TEMP_DIR, sessionId);

    try {
        fs.mkdirSync(sessionDir, { recursive: true });

        // 1. Tüm Java dosyalarını diske yaz
        for (const file of files) {
            // Path traversal ve dosya adı güvenliği
            const safeFileName = path.basename(file.fileName);
            
            if (!safeFileName.endsWith('.java')) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
                return res.status(400).json({
                    success: false,
                    provider: 'CodeStudio',
                    error: `Geçersiz dosya uzantısı: ${safeFileName}. Sadece .java kabul edilir!`
                });
            }

            const filePath = path.join(sessionDir, safeFileName);
            fs.writeFileSync(filePath, file.content || '', 'utf8');
        }

        // 2. Tüm .java dosyalarını javac ile derle
        // Exec parametresinde cwd (current working directory) veriyoruz ki klasör içi rahat derlensin
        exec('javac *.java', { cwd: sessionDir, timeout: 15000 }, (error, stdout, stderr) => {
            if (error) {
                // Derleme Hatası! Klasörü temizle ve hatayı fırlat
                fs.rmSync(sessionDir, { recursive: true, force: true });
                return res.status(400).json({
                    success: false,
                    provider: 'CodeStudio',
                    status: 'COMPILATION_FAILED',
                    error: stderr || error.message || 'Bilinmeyen bir Java derleme hatası oluştu.'
                });
            }

            // 3. Derleme başarılı! Oluşan .class dosyalarını tara
            const compiledFiles = fs.readdirSync(sessionDir)
                .filter(file => file.endsWith('.class'))
                .map(className => ({
                    className: className,
                    downloadUrl: `/api/download/${sessionId}/${className}`
                }));

            return res.json({
                success: true,
                provider: 'CodeStudio',
                message: '☕ Kahveniz tazeleşti, Java kodlarınız başarıyla derlendi!',
                sessionId: sessionId,
                compiledFiles: compiledFiles
            });
        });

    } catch (err) {
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
        return res.status(500).json({
            success: false,
            provider: 'CodeStudio',
            error: 'Sunucu içi bir hata oluştu: ' + err.message
        });
    }
});

/**
 * API: /api/download/:sessionId/:fileName
 * Derlenmiş .class dosyalarını indirme endpoint'i
 */
app.get('/api/download/:sessionId/:fileName', (req, res) => {
    const { sessionId, fileName } = req.params;
    
    // Güvenlik önlemleri
    const safeSessionId = path.basename(sessionId);
    const safeFileName = path.basename(fileName);

    const filePath = path.join(TEMP_DIR, safeSessionId, safeFileName);

    if (fs.existsSync(filePath) && safeFileName.endsWith('.class')) {
        res.setHeader('X-Powered-By', 'CodeStudio');
        res.download(filePath, safeFileName, (err) => {
            if (err) {
                console.error('İndirme hatası:', err);
            }
        });
    } else {
        res.status(404).json({
            success: false,
            provider: 'CodeStudio',
            error: 'Derlenmiş .class dosyası bulunamadı veya süresi doldu.'
        });
    }
});

// 🧹 Periyodik Temizlik: 15 dakikadan eski temp klasörlerini siler (Render diski dolmasın)
setInterval(() => {
    if (!fs.existsSync(TEMP_DIR)) return;
    
    const now = Date.now();
    const sessions = fs.readdirSync(TEMP_DIR);

    sessions.forEach(session => {
        const sessionPath = path.join(TEMP_DIR, session);
        const stats = fs.statSync(sessionPath);
        
        // 15 dakikayı geçmişse sil (15 * 60 * 1000 ms)
        if (now - stats.mtimeMs > 15 * 60 * 1000) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`[CodeStudio] Eski oturum temizlendi: ${session}`);
        }
    });
}, 5 * 60 * 1000); // 5 dakikada bir kontrol et

// Sunucuyu Başlat
app.listen(PORT, () => {
    console.log(`[CodeStudio] Sunucu http://localhost:${PORT} üzerinde aktif! ☕`);
});