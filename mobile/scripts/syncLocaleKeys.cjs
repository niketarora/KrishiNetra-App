const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/i18n/locales');
const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'));

const keysToSync = [
  'liveTitle',
  'startLive',
  'endLive',
  'listening',
  'thinking',
  'speaking',
  'connecting',
  'connected',
  'switchCamera',
  'defaultGreeting',
];

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json' && f !== 'hi.json');

for (const file of files) {
  const filePath = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!data.visualAssistant) data.visualAssistant = {};
  for (const k of keysToSync) {
    if (!data.visualAssistant[k]) {
      data.visualAssistant[k] = en.visualAssistant[k];
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

console.log(`Synced ${files.length} locale files.`);
