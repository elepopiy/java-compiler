/**
 * =======================================================
 *               ☕ CodeStudio ☕
 *   Multi-File Java / C / C++ Compiler & Builder
 * =======================================================
 * Created with passion for Java, C and C++ lovers!
 */

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

/**
 * =======================================================
 * DİL YAPILANDIRMASI
 * =======================================================
 */
const LANG_CONFIG = {
    java: {
        ext: '.java',
        provider: 'CodeStudio · Java',
        buildCommand: () => 'javac *.java',
        collectOutputs: (sessionDir) =>
            fs.readdirSync(sessionDir)
                .filter((f) => f.endsWith('.class'))
                .map((className) => ({ className, type: 'class' })),
        resolveEntryPoint: (files) => {
            const mainFile = files.find((f) => /public\s+static\s+void\s+main\s*\(/.test(f.content || ''));
            if (!mainFile) return null;
            const classMatch = (mainFile.content || '').match(/public\s+class\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
            return classMatch ? classMatch[1] : mainFile.fileName.replace('.java', '');
        },
        runnableOnServer: true,
        runCommand: (entryPoint) => `java ${entryPoint}`,
    },
    c: {
        ext: '.c',
        provider: 'CodeStudio · C (Windows .exe)',
        // mingw-w64 ile CROSS-COMPILE: sunucu Linux olsa da gerçek bir
        // Windows PE32+ .exe üretir (eskiden gcc ile Linux ELF üretiliyordu,
        // bu da Windows'ta çalıştırılamıyordu). -static ile mingw runtime
        // DLL'lerine ihtiyaç kalmadan tek başına çalışan bir .exe çıkar.
        buildCommand: () => 'x86_64-w64-mingw32-gcc -Wall -O2 -static -o app.exe *.c',
        collectOutputs: () => [{ className: 'app.exe', type: 'binary' }],
        resolveEntryPoint: (files) => (files.some((f) => /int\s+main\s*\(/.test(f.content || '')) ? 'app.exe' : null),
        runnableOnServer: false, // Windows .exe, Linux sunucuda çalıştırılamaz
        runCommand: () => null,
    },
    cpp: {
        ext: '.cpp',
        provider: 'CodeStudio · C++ (Windows .exe)',
        buildCommand: () => 'x86_64-w64-mingw32-g++ -std=c++17 -Wall -O2 -static -o app.exe *.cpp',
        collectOutputs: () => [{ className: 'app.exe', type: 'binary' }],
        resolveEntryPoint: (files) => (files.some((f) => /int\s+main\s*\(/.test(f.content || '')) ? 'app.exe' : null),
        runnableOnServer: false,
        runCommand: () => null,
    },
};

function resolveLang(language) {
    return LANG_CONFIG[language] || null;
}

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

            const compiledFiles = lang
                .collectOutputs(sessionDir)
                .map((f) => ({
                    className: f.className,
                    downloadUrl: `/api/download/${sessionId}/${f.className}`,
                }));

            const entryPoint = lang.resolveEntryPoint(files);
            const hasEntryPoint = Boolean(entryPoint);
            const runnableOnServer = lang.runnableOnServer !== false;

            return res.json({
                success: true,
                provider: lang.provider,
                message: `☕ Kahveniz tazeleşti, ${lang.provider} kodlarınız başarıyla derlendi!`,
                sessionId,
                language,
                entryPoint,
                hasEntryPoint,
                runnableOnServer,
                // canRun = sunucu tarafında gerçekten çalıştırılabilir mi
                // (Java evet; C/C++ artık Windows .exe olduğu için hayır)
                canRun: hasEntryPoint && runnableOnServer,
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

    if (lang.runnableOnServer === false) {
        return res.status(400).json({
            success: false,
            error: 'Bu bir Windows (.exe) çalıştırılabilir dosyasıdır ve Linux sunucuda çalıştırılamaz. Dosyayı indirip kendi bilgisayarınızda çalıştırın.',
        });
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

app.get('/api/download/:sessionId/:fileName', (req, res) => {
    const { sessionId, fileName } = req.params;

    const safeSessionId = path.basename(sessionId);
    const safeFileName = path.basename(fileName);

    const filePath = path.join(TEMP_DIR, safeSessionId, safeFileName);
    const isClass = safeFileName.endsWith('.class');
    const isBinary = safeFileName === 'app';
    const isExe = safeFileName.endsWith('.exe');

    if (fs.existsSync(filePath) && (isClass || isBinary || isExe)) {
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

setInterval(() => {
    if (!fs.existsSync(TEMP_DIR)) return;

    const now = Date.now();
    const sessions = fs.readdirSync(TEMP_DIR);

    sessions.forEach((session) => {
        const sessionPath = path.join(TEMP_DIR, session);
        const stats = fs.statSync(sessionPath);

        if (now - stats.mtimeMs > 15 * 60 * 1000) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        }
    });
}, 5 * 60 * 1000);

app.listen(PORT, () => {
    console.log(`[CodeStudio] Sunucu http://localhost:${PORT} üzerinde aktif! ☕ (Java · C · C++)`);
});