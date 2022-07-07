'use strict';

const ref = require('reference');
const mysql = require('db/mysql');
const com = require('com');
const ginfo = require('com/ginfo');
const { error } = require('com/code');

class reward {
  constructor(val) {
    this.session_value = val.session_value;
    this.log = val.log;
    this.modify = false;
    this.add_list = [];
    this.use_list = [];
    this.sort_no = 0;
    this.money_update = false;
    this.modify_items = {};
  }

  add_reward_data(reward_code) {
    const ret = ref.reward.get_reward(reward_code);
    for (let i = 0; i < ret.length; i++) {
      const code = ret[i].item_code;
      const cnt = ret[i].item_cnt;

      const err = this.add(code, cnt);
      if (err) return err;
    }

    return null;
  }

  add_unique(code, durability, enchant) {
    if (code == 0) return null;
    if (durability == 0 && enchant == 0) return this.add(code, 1);

    const item_obj = ref.item.get(code);
    if (!item_obj) return error.not_found_ref_item_code;
    if (item_obj.basic) return error.cannot_reward_basic_item;
    if (item_obj.nft) return error.cannot_reward_nft_item;
    if (item_obj.overlap == 1) return error.not_unique_item;

    const add_object = {
      sort_no: this.sort_no++,
      code,
      prev_cnt: 0,
      cur_cnt: 1,
      type: 'UI',
      durability,
      enchant,
    };

    this.add_list.push(add_object);
    this.modify = true;
  }

  add(code, count, iidx = 0) {
    if (code == 0) return null;
    if (count < 1) return null;

    let prev_cnt = 0;
    let type = '';
    const item_obj = ref.item.get(code);
    if (!item_obj) return error.not_found_ref_item_code;
    if (item_obj.basic) return error.cannot_reward_basic_item;
    if (item_obj.nft) return error.cannot_reward_nft_item;

    let merge_obj = {};

    // 자동으로 열리는 박스
    if (item_obj.type == ginfo.item_type.box_a_random || item_obj.type == ginfo.item_type.box_a_all) {
      for (let i = 0; i < count; i++) {
        this.add_reward_data(item_obj.reward_code);
      }
      return null;
    } else if (item_obj.code == ginfo.money_code.gold) {
      // add gold
      prev_cnt = this.session_value.user.money.gold;
      this.session_value.user.money.gold += count;
      this.money_update = true;
      type = 'G';
    } else if (item_obj.code == ginfo.money_code.free_cubic) {
      // add free_cubic
      prev_cnt = this.session_value.user.money.free_cubic;
      this.session_value.user.money.free_cubic += count;
      this.money_update = true;
      type = 'FC';
    } else if (item_obj.code == ginfo.money_code.paid_cubic) {
      // add paid_cubic
      prev_cnt = this.session_value.user.money.paid_cubic;
      this.session_value.user.money.paid_cubic += count;
      this.money_update = true;
      type = 'PC';
    } else if (item_obj.code == ginfo.money_code.wcoin) {
      // add paid_cubic
      prev_cnt = this.session_value.user.money.wcoin;
      this.session_value.user.money.wcoin += count;
      this.money_update = true;
      type = 'WC';
    } else if (item_obj.overlap == 1) {
      // item
      prev_cnt = this.session_value.items[code] == undefined ? 0 : this.session_value.items[code].cnt;
      this.session_value.items[code] = { code, cnt: prev_cnt };
      this.session_value.items[code].cnt += count;
      this.modify_items[code] = this.session_value.items[code].cnt;
      type = 'I';
    } else if (item_obj.overlap == 0) {
      prev_cnt = 0;
      count = 1;
      merge_obj = {
        durability: item_obj.durability,
        enchant: 0,
      };
      type = 'UI';
    } else return error.unknown;

    const cur_cnt = prev_cnt + count;

    const add_object = _.merge({ sort_no: this.sort_no++, code, prev_cnt, cur_cnt, add: count, type }, merge_obj);
    if (type == 'UI') {
      add_object['iidx'] = iidx;
    }

    this.add_list.push(add_object);
    this.modify = true;

    return null;
  }

  use(code, value) {
    // unique item 의 경우 value = item idx , 이외에는 count
    if (value < 1) return null;
    let prev_cnt = 0;
    let cur_cnt = 0;
    let type = '';

    const item_obj = ref.item.get(code);
    if (!item_obj) return error.not_found_ref_item_code;
    if (item_obj.basic) return error.cannot_reward_basic_item;
    if (item_obj.nft) return error.cannot_reward_nft_item;

    if (item_obj.code == ginfo.money_code.gold) {
      // use gold
      prev_cnt = this.session_value.user.money.gold;
      cur_cnt = prev_cnt - value;
      if (cur_cnt < 0) return error.enough_gold;
      this.session_value.user.money.gold -= value;
      this.money_update = true;
      type = 'G';
    } else if (item_obj.code == ginfo.money_code.free_cubic) {
      // use free_cubic : 유료 보석으로 우선 구매후 모자라는 분만큼 무료 보석 사용
      const paid_cubic = this.session_value.user.money.paid_cubic;
      if (paid_cubic >= value) {
        return this.use(ginfo.money_code.paid_cubic, value);
      } else {
        this.use(ginfo.money_code.paid_cubic, paid_cubic);
        value -= paid_cubic;
        prev_cnt = this.session_value.user.money.free_cubic;
        cur_cnt = prev_cnt - value;
        if (cur_cnt < 0) return error.enough_cubic;
        this.session_value.user.money.free_cubic -= value;
        this.money_update = true;
        type = 'FC';
      }
    } else if (item_obj.code == ginfo.money_code.paid_cubic) {
      // use paid_cubic : 유로 보석만으로 구매
      prev_cnt = this.session_value.user.money.paid_cubic;
      cur_cnt = prev_cnt - value;
      if (cur_cnt < 0) return error.enough_cubic;
      this.session_value.user.money.paid_cubic -= value;
      this.money_update = true;
      type = 'PC';
    } else if (item_obj.code == ginfo.money_code.wcoin) {
      prev_cnt = this.session_value.user.money.wcoin;
      cur_cnt = prev_cnt - value;
      if (cur_cnt < 0) return error.enough_wcoin;
      this.session_value.user.money.wcoin -= value;
      this.money_update = true;
      type = 'WC';
    } else if (item_obj.overlap == 1) {
      // item
      prev_cnt = this.session_value.items[code] == undefined ? 0 : this.session_value.items[code].cnt;
      cur_cnt = prev_cnt - value;
      if (cur_cnt < 0) return error.enough_item;
      if (cur_cnt == 0) _.unset(this.session_value.items, code);
      else this.session_value.items[code].cnt = cur_cnt;

      this.modify_items[code] = cur_cnt;

      type = 'I';
    } else if (item_obj.overlap == 0) {
      prev_cnt = this.session_value.unique_items[value] == undefined ? 0 : 1;
      if (prev_cnt == 0) return error.enough_item;
      if (this.session_value.unique_items[value].equip) return error.unknown;

      _.unset(this.session_value.unique_items, value);
      type = 'UI';
    }

    const use_object = { sort_no: this.sort_no++, code, prev_cnt, cur_cnt, sub: value, type };
    this.use_list.push(use_object);
    this.modify = true;

    return null;
  }

  get() {
    return {
      add_list: this.add_list.length ? this.add_list : undefined,
      use_list: this.use_list.length ? this.use_list : undefined,
    };
  }
}

exports.new_reward = function (session_value) {
  return new reward(session_value);
};

exports.set_reward = async function (val, reward) {
  const userdb = await mysql.userdb_connect(val);
  await mysql.userdb_transaction(val);
  if (reward.money_update == true) {
    await set_money(val.session_value.user.money);
  }

  for (const code in reward.modify_items) {
    const cnt = reward.modify_items[code];
    if (cnt == 0) await del_item(code);
    else await set_item(code, cnt);
  }

  for (let i = 0; i < reward.add_list.length; i++) {
    const obj = reward.add_list[i];
    switch (obj.type) {
      case 'G':
        reward.log.add('add_gold', [obj.cur_cnt, obj.add]);
        break;
      case 'FC':
        reward.log.add('add_free_cubic', [obj.cur_cnt, obj.add]);
        break;
      case 'PC':
        reward.log.add('add_paid_cubic', [obj.cur_cnt, obj.add]);
        break;
      case 'WC':
        reward.log.add('add_wcoin', [obj.cur_cnt, obj.add]);
        break;
      case 'I':
        reward.log.add('add_item', [obj.code, obj.cur_cnt, obj.add]);
        break;
      case 'UI':
        const iidx = await set_unique_item(obj, obj.iidx, obj.durability, obj.enchant);
        reward.log.add('add_item_unique', [obj.code, iidx]);
        break;
    }
  }

  for (let i = 0; i < reward.use_list.length; i++) {
    const obj = reward.use_list[i];
    switch (obj.type) {
      case 'G':
        reward.log.add('use_gold', [obj.cur_cnt, obj.sub]);
        break;
      case 'FC':
        reward.log.add('use_free_cubic', [obj.cur_cnt, obj.sub]);
        break;
      case 'PC':
        reward.log.add('use_paid_cubic', [obj.cur_cnt, obj.sub]);
        break;
      case 'WC':
        reward.log.add('use_wcoin', [obj.cur_cnt, obj.sub]);
        break;
      case 'I':
        reward.log.add('use_item', [obj.code, obj.cur_cnt, obj.sub]);
        break;
      case 'UI':
        await delete_unique_item(obj.sub);
        reward.log.add('use_item_unique', [obj.code, obj.sub]);
        break;
    }
  }

  function set_money({ gold, free_cubic, paid_cubic, wcoin }) {
    const query = com.make_query(
      [`update dat_money set gold = ?, free_cubic = ?, paid_cubic = ?, wcoin = ? where aidx = ?;`],
      [gold, free_cubic, paid_cubic, wcoin, val.aidx]
    );
    return mysql.query(userdb, query);
  }

  async function set_item(code, cur_cnt) {
    const exist = await select(code);
    if (exist) await update(code, cur_cnt);
    else await insert(code, cur_cnt);

    function select() {
      return new Promise((resolve, reject) => {
        const query = 'select idx from dat_item where aidx = ? and item_code = ?;';
        mysql
          .query(userdb, query, [val.aidx, code])
          .then((results) => resolve(results.length))
          .catch((e) => reject(e));
      });
    }

    function insert() {
      const query = com.make_query(
        ['insert into dat_item(idx, aidx, item_code, cnt) ', 'values(null, ?, ?, ?);'],
        [val.aidx, code, cur_cnt]
      );
      return mysql.query(userdb, query);
    }

    function update() {
      const query = com.make_query(
        ['update dat_item set cnt = ? where aidx = ? and item_code = ?;'],
        [cur_cnt, val.aidx, code]
      );
      return mysql.query(userdb, query);
    }
  }

  function set_unique_item(obj, iidx, durability, enchant) {
    let query;
    if (iidx) {
      query = com.make_query(
        ['insert into dat_item_unique(idx, aidx, item_code, durability, enchant, equip) values (?, ?, ?, ?, ?, 0);'],
        [iidx, val.aidx, obj.code, durability, enchant]
      );
    } else {
      query = com.make_query(
        ['insert into dat_item_unique(idx, aidx, item_code, durability, enchant, equip) values (null, ?, ?, ?, ?, 0);'],
        [val.aidx, obj.code, durability, enchant]
      );
    }

    return new Promise(function (resolve, reject) {
      mysql
        .query(userdb, query)
        .then((results) => {
          const iidx = results.insertId;
          obj.add = iidx;
          _.unset(obj, 'iidx');
          val.session_value.unique_items[iidx] = { idx: iidx, code: obj.code, durability, enchant, equip: 0 };
          resolve(results.insertId);
        })
        .catch((e) => reject(e));
    });
  }

  function del_item(code) {
    const query = com.make_query(['delete from dat_item where aidx = ? and item_code = ?; '], [val.aidx, code]);
    return mysql.query(userdb, query);
  }

  function delete_unique_item(iidx) {
    const query = com.make_query(['delete from dat_item_unique where idx = ?; '], [iidx]);
    return mysql.query(userdb, query);
  }
};
