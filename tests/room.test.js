'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RoomManager } = require('../src/server/room');

function setup(t) {
  const manager = new RoomManager({ sockets: { sockets: new Map() } });
  t.after(() => {
    clearInterval(manager.sweeper);
    for (const room of manager.rooms.values()) room.close('test');
  });
  return manager;
}

function enter(manager, id, code) {
  const avatars = { one: 'horse', two: 'monkey', three: 'snake', four: 'rabbit', five: 'pig', six: 'ox' };
  return manager.joinRoom(id, code, { avatar: avatars[id] }, { id: `socket-${id}` });
}

test('所有入口都进入同一桌，自动落座，满四人后拒绝新玩家', (t) => {
  const manager = setup(t);
  const room = enter(manager, 'one');
  assert.equal(enter(manager, 'two', 'ABCD'), room);
  assert.equal(manager.createRoom('three', { avatar: 'snake' }, { id: 'socket-three' }), room);
  assert.equal(enter(manager, 'four', 'WXYZ'), room);
  assert.deepEqual(room.seats.map((player) => player.clientId), ['one', 'two', 'three', 'four']);
  assert.throws(() => enter(manager, 'five'), /坐满/);
  assert.throws(() => manager.createRoom('six', { avatar: 'ox' }, { id: 'socket-six' }), /坐满/);
  assert.equal(manager.rooms.size, 1);
  assert.equal(manager.getRoomForClient('five'), null);
});

test('满桌时原玩家重连不增加座位，也不受旧房间号影响', (t) => {
  const manager = setup(t);
  const room = enter(manager, 'one');
  for (const id of ['two', 'three', 'four']) enter(manager, id);
  manager.disconnect({ id: 'socket-one' }, 'one');
  assert.equal(manager.resume('one', 'OLD1', { id: 'new-socket' }), room);
  assert.equal(room.seats[0].socketId, 'new-socket');
  assert.equal(room.seats[0].connected, true);
  assert.equal(enter(manager, 'one'), room);
  assert.equal(room.humanSeats().length, 4);
  assert.throws(() => manager.resume('stranger', room.code, { id: 'other' }), /关闭/);
});

test('开局前离桌释放席位，所有人离桌后仍只有一桌', (t) => {
  const manager = setup(t);
  const room = enter(manager, 'one');
  enter(manager, 'two');
  manager.leave('one');
  assert.equal(enter(manager, 'three'), room);
  assert.equal(room.seats[0].clientId, 'three');
  manager.leave('two');
  manager.leave('three');
  assert.equal(manager.rooms.size, 0);
  const next = enter(manager, 'four', 'OLD1');
  assert.equal(manager.rooms.size, 1);
  assert.equal(next.seats[0].clientId, 'four');
});

test('同角色新设备接管原座位并让旧设备退出，满桌和开局后也可接管', (t) => {
  const manager = setup(t);
  const room = enter(manager, 'one');
  const events = [];
  const oldSocket = {
    id: 'socket-one', data: {},
    emit: (event) => events.push(event),
    disconnect: () => manager.disconnect({ id: 'socket-one' }, 'one'),
  };
  manager.io.sockets.sockets.set(oldSocket.id, oldSocket);
  for (const id of ['two', 'three', 'four']) enter(manager, id);
  room.startGame('one');
  const game = room.game;
  const takeover = manager.joinRoom('new-device', null, { avatar: 'horse' }, { id: 'new-socket' });
  assert.equal(takeover, room);
  assert.equal(room.game, game);
  assert.equal(room.humanSeats().length, 4);
  assert.equal(room.seats[0].clientId, 'new-device');
  assert.equal(room.seats[0].connected, true);
  assert.equal(oldSocket.data.replaced, true);
  assert.ok(events.includes('session:replaced'));
  assert.equal(manager.getRoomForClient('one'), null);
  manager.leave('one');
  assert.equal(room.seats[0].clientId, 'new-device');
  assert.throws(() => manager.resume('one', null, { id: 'old-return' }), /关闭/);
});

test('同一浏览器身份的新连接会踢掉旧连接且旧断线不影响新连接', (t) => {
  const manager = setup(t);
  const room = enter(manager, 'one');
  const oldSocket = {
    id: 'socket-one', data: {}, emit() {},
    disconnect: () => manager.disconnect({ id: 'socket-one' }, 'one'),
  };
  manager.io.sockets.sockets.set(oldSocket.id, oldSocket);
  manager.resume('one', null, { id: 'new-socket' });
  assert.equal(oldSocket.data.replaced, true);
  assert.equal(room.seats[0].socketId, 'new-socket');
  assert.equal(room.seats[0].connected, true);
});

test('开局后拒绝新玩家，但保留原玩家重连', (t) => {
  const manager = setup(t);
  const room = enter(manager, 'one');
  room.startGame('one');
  assert.throws(() => enter(manager, 'two'), /坐满/);
  assert.equal(manager.resume('one', null, { id: 'reconnected' }), room);
  assert.equal(manager.rooms.size, 1);
});
