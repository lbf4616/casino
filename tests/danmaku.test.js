'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Danmaku } = require('../src/server/danmaku');
function room() {
  return { code: 'TEST', game: null, seats: [{ name: '家人', avatar: 'ox', connected: true }], seatOfClient: id => id === 'member' ? 0 : -1, touch() {} };
}
test('弹幕按阶段限制快捷文案并使用服务端头像', () => {
  const service = new Danmaku();
  const table = room();
  const message = service.send(table, 'member', '快开局吧', 0);
  assert.equal(message.avatar, 'ox');
  assert.equal(message.code, 'TEST');
  assert.throws(() => service.send(table, 'outsider', '快拉人', 5000));
  assert.throws(() => service.send(table, 'member', '<script>', 5000));
  table.game = { phase: 'discard' };
  assert.throws(() => service.send(table, 'member', '快拉人', 5000));
  assert.equal(service.send(table, 'member', '等到花都谢了', 5000).phrase, '等到花都谢了');
});
test('弹幕每人每房间三秒限流，断线不能发送', () => {
  const service = new Danmaku();
  const table = room();
  service.send(table, 'member', '快拉人', 0);
  assert.throws(() => service.send(table, 'member', '快拉人', 2999));
  service.send(table, 'member', '快拉人', 3000);
  table.seats[0].connected = false;
  assert.throws(() => service.send(table, 'member', '快拉人', 6000));
});
