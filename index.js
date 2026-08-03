/**
 * =======================================================
 *               ☕ CodeStudio ☕
 *   Multi-File Java / C / C++ Compiler & Builder
 * =======================================================
 * Created with passion for Java, C and C++ lovers!
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
 |             |___|  🚀 Java · C · C++ Engine Ready!
 |_____________|
`);

/**
 * =======================================================
 * DİL YAPILANDIRMASI
 * Her dil için: kabul edilen uzantı, derleme komutu ve
 * çalıştırma komutunu üreten fonksiyonlar burada tanımlı.
 * =======================================================
 */
const LANG_CONFIG = {
    java: {
        ext: '.java',
        provider: 'CodeStudio · Java',
        // javac tüm .java dosyalarını sessionDir içinde derler
        buildCommand: () => 'javac *.java',
        // Derlenen .class dosyalarını tara
        collectOutputs: (sessionDir) =>
            fs.readdirSync(sessionDir)
                .filter((f) => f.endsWith('.class'))
                .map((className) => ({ className, type: 'class' })),
        // Çalıştırılabilir ana sınıfı, "public static void main" içeren dosyadan bul
        resolveEntryPoint: (files) => {
            const mainFile = files.find((f) => /public\s+static\s+void\s+main\s*\(/.test(f.content || ''));
            if (!mainFile) return null;
            const classMatch = (mainFile.content || '').match(/public\s+class\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
            return classMatch ? classMatch[1] : mainFile.fileName.replace('.java', '');
        },
        runCommand: (entryPoint) => `java ${entryPoint}`,
    },
    c: {
        ext: '.c',
        provider: 'CodeStudio · C',
        buildCommand: () => 'gcc -Wall -O2 -o app *.c',
        collectOutputs: () => [{ className: 'app', type: 'binary' }],
        resolveEntryPoint: (files) => (files.some((f) => /int\s+main\s*\(/.test(f.content || '')) ? 'app' : null),
        runCommand: () => './app',
    },
    cpp: {
        ext: '.cpp',
        provider: 'CodeStudio · C++',
        buildCommand: () => 'g++ -std=c++17 -Wall -O2 -o app *.cpp',
        collectOutputs: () => [{ className: 'app', type: 'binary' }],
        resolveEntryPoint: (files) => (files.some((f) => /int\s+main\s*\(/.test(f.content || '')) ? 'app' : null),
        runCommand: () => './app',
    },
};

function resolveLang(language) {
    return LANG_CONFIG[language] || null;
}

/**
 * API: /api/compile
 * POST Body:
 * {
 *   language: "java" | "c" | "cpp",
 *   files: [
 *     { fileName: "Main.java", content: "public class Main { ... }" }
 *   ]
 * }
 */
app.post('/api/compile', (req, res) => {
    const { files, language } = req.body;

    const lang = resolveLang(language);
    if (!lang) {
        return res.status(400).json({
            success: false,
            provider: 'CodeStudio',
            error: `Desteklenmeyen dil: '${language}'. Geçerli değerler: java, c, cpp.`,
        });
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({
            success: false,
            provider: lang.provider,
            error: `Lütfen en az bir adet ${lang.ext} dosyası gönderin ☕`,
        });
    }

    const sessionId = crypto.randomBytes(8).toString('hex');
    const sessionDir = path.join(TEMP_DIR, sessionId);

    try {
        fs.mkdirSync(sessionDir, { recursive: true });

        // 1. Tüm kaynak dosyaları diske yaz
        for (const file of files) {
            const safeFileName = path.basename(file.fileName || '');

            if (!safeFileName.endsWith(lang.ext)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
                return res.status(400).json({
                    success: false,
                    provider: lang.provider,
                    error: `Geçersiz dosya uzantısı: ${safeFileName}. Sadece ${lang.ext} kabul edilir!`,
                });
            }

            const filePath = path.join(sessionDir, safeFileName);
            fs.writeFileSync(filePath, file.content || '', 'utf8');
        }

        // 2. Dile özgü derleyiciyi çalıştır (javac / gcc / g++)
        const buildCmd = lang.buildCommand();
        exec(buildCmd, { cwd: sessionDir, timeout: 20000 }, (error, stdout, stderr) => {
            if (error) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
                return res.status(400).json({
                    success: false,
                    provider: lang.provider,
                    status: 'COMPILATION_FAILED',
                    error: stderr || error.message || `Bilinmeyen bir ${lang.provider} derleme hatası oluştu.`,
                });
            }

            // 3. Derleme başarılı! Çıktıları topla
            const compiledFiles = lang
                .collectOutputs(sessionDir)
                .map((f) => ({
                    className: f.className,
                    downloadUrl: `/api/download/${sessionId}/${f.className}`,
                }));

            const entryPoint = lang.resolveEntryPoint(files);

            return res.json({
                success: true,
                provider: lang.provider,
                message: `☕ Kahveniz tazeleşti, ${lang.provider} kodlarınız başarıyla derlendi!`,
                sessionId,
                language,
                entryPoint,
                canRun: Boolean(entryPoint),
                compiledFiles,
            });
        });
    } catch (err) {
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
        return res.status(500).json({
            success: false,
            provider: lang.provider,
            error: 'Sunucu içi bir hata oluştu: ' + err.message,
        });
    }
});

/**
 * API: /api/run
 * POST Body: { sessionId, language, entryPoint }
 * Derlenmiş projeyi (javac ile .class, ya da gcc/g++ ile üretilen "app"
 * binary'sini) daha önce oluşturulan session klasöründe çalıştırır ve
 * konsol çıktısını (stdout/stderr) döner. Sadece /api/compile ile
 * oluşturulmuş geçerli bir sessionId kabul edilir.
 */
app.post('/api/run', (req, res) => {
    const { sessionId, language, entryPoint } = req.body;

    const lang = resolveLang(language);
    if (!lang) {
        return res.status(400).json({ success: false, error: `Desteklenmeyen dil: '${language}'.` });
    }
    if (!sessionId || !entryPoint) {
        return res.status(400).json({ success: false, error: 'sessionId ve entryPoint zorunludur.' });
    }

    const safeSessionId = path.basename(sessionId);
    const sessionDir = path.join(TEMP_DIR, safeSessionId);

    if (!fs.existsSync(sessionDir)) {
        return res.status(404).json({ success: false, error: 'Oturum bulunamadı veya süresi doldu. Lütfen tekrar derleyin.' });
    }

    const runCmd = lang.runCommand(entryPoint);
    exec(runCmd, { cwd: sessionDir, timeout: 8000 }, (error, stdout, stderr) => {
        if (error && error.killed) {
            return res.status(408).json({ success: false, error: 'Program zaman aşımına uğradı (8sn) — sonsuz döngü olabilir.' });
        }
        return res.json({
            success: true,
            exitCode: error ? error.code : 0,
            stdout: stdout || '',
            stderr: stderr || '',
        });
    });
});

/**
 * API: /api/download/:sessionId/:fileName
 * Derlenmiş .class dosyalarını veya native binary'yi indirme endpoint'i
 */
app.get('/api/download/:sessionId/:fileName', (req, res) => {
    const { sessionId, fileName } = req.params;

    const safeSessionId = path.basename(sessionId);
    const safeFileName = path.basename(fileName);

    const filePath = path.join(TEMP_DIR, safeSessionId, safeFileName);
    const isClass = safeFileName.endsWith('.class');
    const isBinary = safeFileName === 'app';

    if (fs.existsSync(filePath) && (isClass || isBinary)) {
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
            error: 'Derlenmiş çıktı bulunamadı veya süresi doldu.',
        });
    }
});

// 🧹 Periyodik Temizlik: 15 dakikadan eski temp klasörlerini siler (Render diski dolmasın)
setInterval(() => {
    if (!fs.existsSync(TEMP_DIR)) return;

    const now = Date.now();
    const sessions = fs.readdirSync(TEMP_DIR);

    sessions.forEach((session) => {
        const sessionPath = path.join(TEMP_DIR, session);
        const stats = fs.statSync(sessionPath);

        if (now - stats.mtimeMs > 15 * 60 * 1000) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`[CodeStudio] Eski oturum temizlendi: ${session}`);
        }
    });
}, 5 * 60 * 1000);

// Sunucuyu Başlat
app.listen(PORT, () => {
    console.log(`[CodeStudio] Sunucu http://localhost:${PORT} üzerinde aktif! ☕ (Java · C · C++)`);
});