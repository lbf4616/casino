const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
const shareFunction = source.slice(source.indexOf('async function shareInvite()'), source.indexOf('async function copyInviteLink()'));

for (const scenario of [
  { name: 'copies before launching WeChat', copied: true, wechat: false, launch: true },
  { name: 'does not launch after copy failure', copied: false, wechat: false, launch: false },
  { name: 'does not relaunch inside WeChat', copied: true, wechat: true, launch: false },
  { name: 'keeps fallback when navigation is blocked', copied: true, wechat: false, launch: true, blocked: true },
]) {
  test(scenario.name, async () => {
    const events = [];
    const location = {};
    Object.defineProperty(location, 'href', { set(value) {
      events.push(value);
      if (scenario.blocked) throw new Error('blocked');
    } });
    const context = vm.createContext({
      state: { room: { code: '1234' } },
      effectiveName: () => '家里人',
      buildInviteUrl: () => 'https://example.test/?from=test',
      copyText: async (text) => {
        assert.equal(text, '家里人邀请你加入麻将对局，一起摸两圈！点击链接，马上入座：\nhttps://example.test/?from=test');
        events.push('copy');
        return scenario.copied;
      },
      isWeChatBrowser: () => scenario.wechat,
      renderModal: () => events.push('modal'),
      showToast: () => {},
      window: { location },
    });
    await vm.runInContext(`${shareFunction}\nshareInvite()`, context);
    assert.equal(events[0], 'copy');
    assert.equal(events.includes('weixin://'), scenario.launch);
    assert.equal(context.state.modal.copied, scenario.copied);
    assert.equal(context.state.modal.wechat, scenario.wechat);
    assert.equal(context.state.modal.url, 'https://example.test/?from=test');
    assert.ok(events.includes('modal'));
  });
}

test('does nothing outside a room', async () => {
  const context = vm.createContext({ state: {} });
  await vm.runInContext(`${shareFunction}\nshareInvite()`, context);
  assert.equal(context.state.modal, undefined);
});
