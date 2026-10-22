'use strict';

const fs = require('fs');
const path = require('path');

const INITIAL_BALANCE = 1000;
const DEFAULT_FILE = path.join(__dirname, '..', '..', 'data', 'scores.json');
const CHARACTER_ID = /^[a-z][a-z0-9-]{1,30}$/;

class ScoreStore {
  constructor(filePath = process.env.SCORE_FILE || DEFAULT_FILE) {
    this.filePath = filePath;
    this.balances = new Map();
    this.load();
  }

  load() {
    let parsed = null;
    try {
      parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`读取角色资金失败：${error.message}`);
      }
      return;
    }
    const source = parsed && typeof parsed === 'object' && parsed.scores
      ? parsed.scores
      : parsed;
    if (!source || typeof source !== 'object') return;
    for (const [characterId, value] of Object.entries(source)) {
      if (!CHARACTER_ID.test(characterId)) continue;
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      this.balances.set(characterId, Math.round(value));
    }
  }

  get(characterId) {
    return this.balances.has(characterId) ? this.balances.get(characterId) : INITIAL_BALANCE;
  }

  set(characterId, value) {
    if (!CHARACTER_ID.test(characterId)) return;
    if (typeof value !== 'number' || !Number.isFinite(value)) return;
    this.balances.set(characterId, Math.round(value));
  }

  all(characterIds) {
    return Object.fromEntries(characterIds.map((id) => [id, this.get(id)]));
  }

  save() {
    const payload = JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      scores: Object.fromEntries(this.balances),
    }, null, 2);
    const tempFile = `${this.filePath}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(tempFile, payload);
      fs.renameSync(tempFile, this.filePath);
      return true;
    } catch (error) {
      console.error(`保存角色资金失败：${error.message}`);
      try {
        fs.rmSync(tempFile, { force: true });
      } catch (ignored) {
        // Nothing else to clean up.
      }
      return false;
    }
  }
}

module.exports = { ScoreStore, INITIAL_BALANCE };
