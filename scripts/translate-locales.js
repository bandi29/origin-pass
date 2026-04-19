/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

// Configuration
const MESSAGES_DIR = path.join(__dirname, '../src/messages');
const SOURCE_LANG = 'en';
const TARGET_LANGS = ['fr', 'it'];

// Load Source
const sourcePath = path.join(MESSAGES_DIR, `${SOURCE_LANG}.json`);
const sourceContent = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

// Helper to check missing keys
function findMissingKeys(source, target, prefix = '') {
    let missing = [];
    for (const key in source) {
        const currentPath = prefix ? `${prefix}.${key}` : key;
        if (typeof source[key] === 'object' && source[key] !== null) {
            if (!target[key]) target[key] = {};
            missing = missing.concat(findMissingKeys(source[key], target[key], currentPath));
        } else {
            if (!target[key]) {
                missing.push({ path: currentPath, value: source[key] });
            }
        }
    }
    return missing;
}

// Main Logic
console.log(`\n🤖 OriginPass "Mini-i18nexus" AI Translator Script`);
console.log(`--------------------------------------------------`);
console.log(`Source Language: ${SOURCE_LANG}`);

TARGET_LANGS.forEach(lang => {
    const targetPath = path.join(MESSAGES_DIR, `${lang}.json`);
    let targetContent = {};

    if (fs.existsSync(targetPath)) {
        targetContent = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    }

    const missing = findMissingKeys(sourceContent, targetContent);

    if (missing.length === 0) {
        console.log(`✅ [${lang}] is up to date.`);
        return;
    }

    console.log(`⚠️ [${lang}] has ${missing.length} missing keys:`);
    missing.forEach(m => console.log(`   - ${m.path} ("${m.value}")`));

    // In a real implementation with an API Key, here is where we would call OpenAI:
    // const translated = await callOpenAI(m.value, lang);
    // set(targetContent, m.path, translated);

    console.log(`💡 To automate this, simple replace this log with an OpenAI API call.`);
    console.log(`   For now, please manually update ${lang}.json or implementation the API call.`);
    console.log(``);
});

console.log(`Done.`);
