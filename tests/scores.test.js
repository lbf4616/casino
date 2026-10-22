'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ScoreStore, INITIAL_BALANCE } = require('../src/server/scores');
const { RoomManager } = require('../src/server/room');

function tempStoreFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'heyuan-scores-'));
  return { dir, file: path.join(dir, 'scores.json') };
}

function managerWithStore(file) {
  const manager = new RoomManager({ sockets: { sockets: new Map() } });
  manager.balances = new ScoreStore(file);
  return manager;
}

function addHumans(room, profiles) {
  profiles.forEach((profile, index) => {
    room.addHuman(`client-${index + 2}`, profile, { id: `socket-${index + 2}` });
  });
}

test('角色资金默认 1000，保存后可以从文件读回', () => {
  const { dir, file } = tempStoreFile();
  try {
    const store = new ScoreStore(file);
    assert.equal(store.get('horse'), INITIAL_BALANCE);
    store.set('horse', 1240);
    store.set('monkey', 870);
    assert.equal(store.save(), true);

    const reloaded = new ScoreStore(file);
    assert.equal(reloaded.get('horse'), 1240);
    assert.equal(reloaded.get('monkey'), 870);
    assert.equal(reloaded.get('snake'), INITIAL_BALANCE);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('损坏或不合法的资金记录会被忽略，回落到初始资金', () => {
  const { dir, file } = tempStoreFile();
  try {
    fs.writeFileSync(file, JSON.stringify({
      version: 1,
      scores: { horse: '很多', monkey: null, 'bad key': 300, snake: 1010 },
    }));
    const store = new ScoreStore(file);
    assert.equal(store.get('horse'), INITIAL_BALANCE);
    assert.equal(store.get('monkey'), INITIAL_BALANCE);
    assert.equal(store.get('bad key'), INITIAL_BALANCE);
    assert.equal(store.get('snake'), 1010);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('入座时使用角色保存的资金，开局沿用座位资金', () => {
  const { dir, file } = tempStoreFile();
  try {
    const seeded = new ScoreStore(file);
    seeded.set('horse', 1150);
    seeded.save();

    const manager = managerWithStore(file);
    const room = manager.createRoom('client-1', { name: '妈妈', avatar: 'horse' }, { id: 'socket-1' });
    assert.equal(room.seats[0].score, 1150);

    addHumans(room, [
      { name: '爸爸', avatar: 'monkey' },
      { name: '姐姐', avatar: 'snake' },
    ]);
    assert.equal(room.seats[1].score, INITIAL_BALANCE);
    room.startGame('client-1');
    assert.deepEqual(room.game.scores, [1150, 1000, 1000, INITIAL_BALANCE]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('四家都是真人时，结算后把资金存回各自角色', () => {
  const { dir, file } = tempStoreFile();
  try {
    const manager = managerWithStore(file);
    const room = manager.createRoom('client-1', { name: '妈妈', avatar: 'horse' }, { id: 'socket-1' });
    addHumans(room, [
      { name: '爸爸', avatar: 'monkey' },
      { name: '姐姐', avatar: 'snake' },
      { name: '姐夫', avatar: 'rabbit' },
    ]);
    room.startGame('client-1');
    room.game.phase = 'ended';
    room.game.scores = [1140, 920, 1030, 910];

    assert.equal(room.persistScores(), true);
    const reloaded = new ScoreStore(file);
    assert.equal(reloaded.get('horse'), 1140);
    assert.equal(reloaded.get('monkey'), 920);
    assert.equal(reloaded.get('snake'), 1030);
    assert.equal(reloaded.get('rabbit'), 910);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('有 AI 参战时不写入角色资金', () => {
  const { dir, file } = tempStoreFile();
  try {
    const manager = managerWithStore(file);
    const room = manager.createRoom('client-1', { name: '博凡', avatar: 'pig' }, { id: 'socket-1' });
    room.startGame('client-1');
    room.game.phase = 'ended';
    room.game.scores = [1260, 900, 880, 960];

    assert.equal(room.persistScores(), false);
    assert.equal(new ScoreStore(file).get('pig'), INITIAL_BALANCE);
    assert.equal(fs.existsSync(file), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
