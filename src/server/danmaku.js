'use strict';

const PHRASES = {
  lobby: ['快开局吧', '快拉人', '还有人吗', '人齐就开', '准备好了！'],
  game: ['等到花都谢了', '快出牌呀', '打得漂亮', '这牌有点难', '好运快来！'],
};

class Danmaku {
  constructor() {
    this.sent = new WeakMap();
    this.sequence = 0;
  }

  send(room, clientId, phrase, now = Date.now()) {
    const seat = room.seatOfClient(clientId);
    const player = room.seats[seat];
    if (!player || !player.connected) throw new Error('你不在房间里');
    const category = room.game && room.game.phase !== 'ended' ? 'game' : 'lobby';
    if (!PHRASES[category].includes(phrase)) throw new Error('请选择当前页面的快捷弹幕');
    let timestamps = this.sent.get(room);
    if (!timestamps) {
      timestamps = new Map();
      this.sent.set(room, timestamps);
    }
    const last = timestamps.get(clientId);
    if (last !== undefined && now - last < 3000) throw new Error('请稍等 3 秒再发弹幕');
    timestamps.set(clientId, now);
    room.touch();
    return { id: ++this.sequence, code: room.code, name: player.name, avatar: player.avatar, phrase };
  }
}

module.exports = { Danmaku, PHRASES };
