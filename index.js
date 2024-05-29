const fs = require('fs');
const JavaScriptObfuscator = require('javascript-obfuscator');

// Baca isi file JavaScript yang ingin diobfuskasi
const inputCode = fs.readFileSync('script.js', 'utf8');

// Konfigurasi opsi obfuskasi
const obfuscationOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 1,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 1,
    debugProtection: false,
    debugProtectionInterval: false,
    disableConsoleOutput: true,
    rotateStringArray: true,
    selfDefending: true,
    stringArray: true,
    stringArrayEncoding: 'base64',
    stringArrayThreshold: 0.75,
};

// Obfuskasi kode JavaScript
const obfuscatedCode = JavaScriptObfuscator.obfuscate(inputCode, obfuscationOptions).getObfuscatedCode();

// Simpan kode obfuskasi ke dalam file output
fs.writeFileSync('output-obfuscated.js', obfuscatedCode);
console.log('Obfuscation complete!');
