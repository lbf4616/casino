import { writeFile } from 'node:fs/promises';

const OUT = new URL('../public/assets/voice/', import.meta.url);
// 合滴读 hē dī，用「喝滴」骗过词典读音；软滴读 ruǎn dī。
const CLIPS = [
  ['hedi', '喝滴'],
  ['ruandi', '软滴'],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function synthesize(text, attempt) {
  const params = new URLSearchParams({
    tex: text,
    cuid: `baike${attempt}`,
    ctp: '1',
    lan: 'zh',
    ie: 'UTF-8',
    pdt: '301',
    vol: '9',
    rate: '32',
    per: '0',
  });
  const response = await fetch(`https://tts.baidu.com/text2audio?${params}`, {
    headers: {
      Referer: 'https://baike.baidu.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0 Safari/537.36',
    },
  });
  const type = response.headers.get('content-type') || '';
  const data = Buffer.from(await response.arrayBuffer());
  if (!response.ok || !type.startsWith('audio/')) {
    throw new Error(`${response.status} ${type} ${data.toString('utf8').slice(0, 200)}`);
  }
  return data;
}

let failed = 0;
for (const [key, text] of CLIPS) {
  let saved = false;
  for (let attempt = 1; attempt <= 15 && !saved; attempt += 1) {
    try {
      const data = await synthesize(text, attempt);
      await writeFile(new URL(`${key}.mp3`, OUT), data);
      console.log(`${key} (${text}) ok ${data.length} bytes`);
      saved = true;
    } catch (error) {
      console.log(`${key} attempt ${attempt} failed: ${error.message}`);
      await sleep(1500 + attempt * 500);
    }
  }
  if (!saved) failed += 1;
}
console.log(`FAILED=${failed}`);
if (failed) process.exitCode = 1;
