'use strict';

const ref = require('reference');
const com = require('com');
const ginfo = require('com/ginfo');
const { error } = require('com/code');
const mysql = require('db/mysql');
const redis = require('db/redis');
const sprintf = require('sprintf');

// ------- 계정 생성전 체크 --------- //
exports.check_user_overlap = function (comdb, login_id) {
  return new Promise(function (resolve, reject) {
    const query = 'select idx from dat_account where login_id = ?;';
    mysql
      .query(comdb, query, [login_id])
      .then((results) => {
        return results.length == 0 ? resolve() : reject(error.regid_overlap_id);
      })
      .catch((e) => reject(e));
  });
};

// ------- 계정 생성 --------- //
exports.insert_user = async function (comdb, name, login_id) {
  const aidx = await reg_account();

  return { aidx };

  function reg_account() {
    return new Promise(function (resolve, reject) {
      const query = com.make_query(
        [
          `insert into dat_account (idx, name, login_id, login_type, uuid, login_dt, reg_dt) `,
          `values (null, ?, ?, 0, '', now(), now());`,
        ],
        [name, login_id]
      );

      mysql
        .query(comdb, query, [])
        .then((results) => resolve(results.insertId))
        .catch((e) => reject(e.code == 'ER_DUP_ENTRY' ? error.regid_overlap_id : e));
    });
  }
};

exports.insert_msg_user = async function (msgdb, aidx, name) {
  const query = 'insert into dat_user_account (idx, name, reg_dt) values (?,?,now());';
  return mysql.query(msgdb, query, [aidx, name]);
};

exports.update_msg_user_name = async function (msgdb, aidx, name) {
  const query = 'update dat_user_account set name = ? where idx = ?;';
  return mysql.query(msgdb, query, [name, aidx]);
};

exports.insert_user_userdb = async function (userdb, aidx, base_items) {
  const attendance_objs = ref.daily_attendance.get_codes();
  for (const code of attendance_objs) {
    await insert_attendance(code);
  }

  const reward = ref.reward.get_reward(ginfo.user_register.reward_code);
  for (const base_item of base_items) {
    reward.push(base_item);
  }

  await insert_option();
  await insert_money();
  await fnWorld.insert_world(userdb, aidx);
  await insert_init_item();

  function insert_attendance(code) {
    const query = com.make_query(
      [
        'insert into dat_attendance (aidx, attendance_code, reward_day, update_dt) ',
        'values (?, ?, 0,  adddate(now(), interval -1 day));',
      ],
      [aidx, code]
    );

    return mysql.query(userdb, query, []);
  }
  function insert_option() {
    const query = `insert into dat_option values (?, '');`;

    return mysql.query(userdb, query, [aidx]);
  }

  function insert_money() {
    const gold_obj = _.find(reward, ({ item_code }) => item_code == ginfo.money_code.gold);
    const gold = gold_obj ? gold_obj.item_cnt : 0;

    const paid_cubic_obj = _.find(reward, ({ item_code }) => item_code == ginfo.money_code.paid_cubic);
    const paid_cubic = paid_cubic_obj ? paid_cubic_obj.item_cnt : 0;

    const free_cubic_obj = _.find(reward, ({ item_code }) => item_code == ginfo.money_code.free_cubic);
    const free_cubic = free_cubic_obj ? free_cubic_obj.item_cnt : 0;

    const wcoin_obj = _.find(reward, ({ item_code }) => item_code == ginfo.money_code.wcoin);
    const wcoin = wcoin_obj ? wcoin_obj.item_cnt : 0;

    const query = 'insert into dat_money (aidx, gold, paid_cubic, free_cubic, wcoin) values (?, ?, ?, ?, ?);';

    return mysql.query(userdb, query, [aidx, gold, paid_cubic, free_cubic, wcoin]);
  }

  async function insert_init_item() {
    const item_values = [];
    const unique_item_values = [];
    for (let i = 0; i < reward.length; i++) {
      const { item_code: code, item_cnt: cnt } = reward[i];
      const item_obj = ref.item.get(code);
      if (!item_obj) return Promise.reject(error.unknown);
      if (item_obj.type == ginfo.item_type.resource) continue; // 재화는 다른 경로로 넣었다.
      if (item_obj.overlap == 1) {
        item_values.push(sprintf('(null,%d,%d,%d)', aidx, code, cnt));
      } else {
        unique_item_values.push(sprintf('(null,%d,%d,%d,%d)', aidx, code, item_obj.durability, 0));
      }
    }

    const item_query = `insert into dat_item(idx, aidx, item_code, cnt) values ${_.join(item_values, ',')};`;
    if (item_values.length >= 1) await mysql.query(userdb, item_query, []);

    const unique_item_query = `insert into dat_item_unique (idx, aidx, item_code, durability, enchant) values ${_.join(
      unique_item_values,
      ','
    )};`;

    if (unique_item_values.length >= 1) await mysql.query(userdb, unique_item_query, []);
  }
};

exports.get_base_items = function (comdb, aftv_user_no) {
  const query = 'select item_code, item_cnt from _ser_base_item where user_no = ?';
  return mysql.query(comdb, query, [aftv_user_no]);
};

// ------- 계정 --------- //
exports.get_userinfo_by_id = function (comdb, login_id) {
  return new Promise(function (resolve, reject) {
    const query = com.make_query(
      [
        'select idx as aidx, name, login_id, login_type, uuid, login_dt, reg_dt',
        'from dat_account where login_id = ?;',
      ],
      [login_id]
    );

    mysql
      .query(comdb, query, [])
      .then((results) => resolve(results.length ? results[0] : null))
      .catch((e) => reject(e));
  });
};

exports.get_userinfo = function (comdb, aidx) {
  return new Promise(function (resolve, reject) {
    const query = com.make_query(
      [
        'select idx as aidx, name, login_id, login_type, os_type, sel_avt_idx, avt_reg_cnt, preset_reg_cnt, world_reg_cnt, ',
        'uuid, unix_timestamp(login_dt) as login_time, unix_timestamp(block_dt) as block_time ',
        'from dat_account where aidx = ?;',
      ],
      [aidx]
    );

    mysql
      .query(comdb, query, [])
      .then((results) => {
        resolve(results.length ? results[0] : null);
      })
      .catch((e) => reject(e));
  });
};

exports.update_user_info = function (comdb, aidx, subquery) {
  const query = `update dat_account set ${subquery} where idx = ?;`;

  return mysql.query(comdb, query, [aidx]);
};

exports.update_preview_name = function (comdb, aidx, name) {
  const query = `update dat_preview set name = ? where aidx = ?;`;

  return mysql.query(comdb, query, [name, aidx]);
};

exports.update_login_id = function (comdb, aidx, modify_id, login_type) {
  return new Promise(function (resolve, reject) {
    const query = 'update dat_account set login_id = ?, login_type = ? where aidx = ?;';

    mysql
      .query(comdb, query, [modify_id, login_type, aidx])
      .then(() => resolve())
      .catch((e) => reject(e.code == 'ER_DUP_ENTRY' ? error.overlap_link_id : e));
  });
};

exports.get_user_list = function (comdb, list) {
  const query = com.make_query(
    [
      'select name, login_id, logint_type, os_type, sel_avt_idx, avt_reg_cnt, uuid, ',
      'unix_timestamp(login_dt) as login_time, unix_timestamp(block_dt) as block_time ',
      'from dat_account where aidx = in (?);',
    ],
    [list]
  );

  return mysql.query(comdb, query, [list]);
};

// ------- 출석 --------- //
exports.get_attendance = function (userdb, aidx) {
  return new Promise(function (resolve, reject) {
    const query =
      'select attendance_code, reward_day, unix_timestamp(update_dt) as update_time  from dat_attendance where aidx = ?;';

    mysql
      .query(userdb, query, [aidx])
      .then((results) => resolve(results))
      .catch((e) => reject(e));
  });
};

// ------- 재화 --------- //
exports.get_money = function (userdb, aidx) {
  return new Promise(function (resolve, reject) {
    const query = 'select gold, paid_cubic, free_cubic, wcoin from dat_money where aidx = ?;';

    mysql
      .query(userdb, query, [aidx])
      .then((results) => {
        resolve(results.length ? results[0] : null);
      })
      .catch((e) => reject(e));
  });
};

exports.update_money = function (userdb, aidx, subquery) {
  const query = `update dat_money set ${subquery} where aidx = ?;`;

  return mysql.query(userdb, query, [aidx]);
};

// ------- 아이템 --------- //
exports.get_item = function (userdb, aidx) {
  return new Promise(function (resolve, reject) {
    const query = 'select idx, item_code, cnt from dat_item where aidx = ?;';

    mysql
      .query(userdb, query, [aidx])
      .then((results) => {
        let ret = {};
        for (const item of results) {
          ret[item.item_code] = {
            code: item.item_code,
            cnt: item.cnt,
          };
        }
        resolve(ret);
      })
      .catch((e) => reject(e));
  });
};

exports.get_unique_item_list = function (userdb, aidx) {
  return new Promise(function (resolve, reject) {
    const query = 'select idx, item_code, durability, enchant, equip from dat_item_unique where aidx = ?;';

    mysql
      .query(userdb, query, [aidx])
      .then((results) => {
        let ret = {};
        for (const item of results) {
          ret[item.idx] = {
            idx: item.idx,
            code: item.item_code,
            durability: item.durability,
            enchant: item.enchant,
            equip: item.equip,
          };
        }
        resolve(ret);
      })
      .catch((e) => reject(e));
  });
};

exports.unique_item_exists = function (val, item_list) {
  for (const { code, eidx } of item_list) {
    if (code == 0 && eidx == 0) continue;

    const item = val.session_value.unique_items[eidx];
    if (!item) return error.enough_item;
    if (item.code != code) return error.parameter;
  }
  return error.none;
};

exports.item_exists = function (val, item_list) {
  for (const code of item_list) {
    if (code == 0) continue;

    const item = val.session_value.items[code];
    if (!item) return error.enough_item;
    if (item.code != code) return error.parameter;
  }
  return error.none;
};

exports.get_unique_item = function (val, item_iidx) {
  const item = _.find(val.session_value.unique_items, { idx: item_iidx });
  return item;
};

exports.update_unique_item_durability = function (userdb, idx, durability) {
  return new Promise((resolve, reject) => {
    const query = com.make_query(['update dat_item_unique set durability=? where idx=?'], [durability, idx]);
    mysql
      .query(userdb, query)
      .then(() => {
        resolve();
      })
      .catch((e) => reject(e));
  });
};

exports.update_unique_item_enchant = function (userdb, idx, enchant) {
  return new Promise((resolve, reject) => {
    const query = com.make_query(['update dat_item_unique set enchant=? where idx=?'], [enchant, idx]);
    mysql
      .query(userdb, query)
      .then(() => {
        resolve();
      })
      .catch((e) => reject(e));
  });
};

// ------- 업적 --------- //
exports.achievement_redis_list = function (aidx) {
  return new Promise((resolve, reject) => {
    const redis_key = com.make_redis_Key('fmeta', 'session', aidx);
    const hash_key = 'achievement';
    redis.main
      .command('hget', [redis_key, hash_key])
      .then((reply) => resolve(reply ? JSON.parse(reply) : null))
      .catch((e) => reject(e));
  });
};

exports.achievement_redis_set = function (aidx, achievement_list, achievement = null) {
  const redis_key = com.make_redis_Key('fmeta', 'session', aidx);
  const hash_key = 'achievement';
  if (achievement) {
    _.unset(achievement, 'insert');
    _.remove(achievement_list, { code: achievement.code });
    achievement_list.push(achievement);
  }
  return redis.main.command('hset', [redis_key, hash_key, JSON.stringify(achievement_list)]);
};

exports.achievement_list = function (userdb, aidx) {
  const query = com.make_query(
    [
      'select achievement_code as code, lv, reset_type, reward_flg, clear_flg, cnt, ',
      'unix_timestamp(update_dt) as update_time ',
      'from dat_achievement where aidx = ?; ',
    ],
    [aidx]
  );

  return mysql.query(userdb, query);
};

exports.achievement_get = function (achievement_list, code, reset_type) {
  let ret = {
    code,
    lv: 1,
    reset_type,
    reward_flg: 0,
    clear_flg: 0,
    cnt: 0,
    update_time: com.get_time(),
    insert: true,
  };
  const obj = _.find(achievement_list, (d) => d.code == code);
  if (!obj) return ret;
  else {
    ret.insert = false;
    const { reset_type, reward_flg, clear_flg, update_time } = obj;
    const now = com.get_date();
    const prev = new Date(update_time * 1000);

    const diffday = now.get_day_of_year() - prev.get_day_of_year();
    const diffweek = now.get_week_of_year() - prev.get_week_of_year();
    const diffmonth = now.getMonth() - prev.getMonth();

    if (reward_flg == clear_flg) {
      if (reset_type == ginfo.achievement.reset_type.daily && diffday != 0) return ret;
      if (reset_type == ginfo.achievement.reset_type.weekly && diffweek != 0) return ret;
      if (reset_type == ginfo.achievement.reset_type.monthly && diffmonth != 0) return ret;
    }

    ret.lv = obj.lv;
    ret.reward_flg = obj.reward_flg;
    ret.clear_flg = obj.clear_flg;
    ret.cnt = obj.cnt;

    return ret;
  }
};

exports.achievement_insert = async function (userdb, aidx, achievement) {
  const { lv, reset_type, code, reward_flg, clear_flg, cnt } = achievement;
  const query = com.make_query(
    [
      'insert into dat_achievement (idx, aidx, lv, reset_type, achievement_code, reward_flg, clear_flg, cnt, update_dt) ',
      'values (null, ?, ?, ?, ?, ?, ?, ?, now()) ',
    ],
    [aidx, lv, reset_type, code, reward_flg, clear_flg, cnt]
  );
  return mysql.query(userdb, query);
};

exports.achievement_update = async function (userdb, aidx, achievement) {
  const { lv, code, reward_flg, clear_flg, cnt } = achievement;
  const query = com.make_query(
    [
      'update dat_achievement set lv = ?, reward_flg = ?, clear_flg = ?, cnt = ? , update_dt = now() where aidx = ? and achievement_code = ?;',
    ],
    [lv, reward_flg, clear_flg, cnt, aidx, code]
  );
  return mysql.query(userdb, query);
};

// ------- 수집 --------- //
exports.collection_list = function (userdb, aidx) {
  return new Promise((resolve, reject) => {
    const query = 'select collection_code, json_str, reward_flg from dat_collection where aidx = ?; ';

    mysql
      .query(userdb, query, [aidx])
      .then((results) => {
        const collection_list = _.map(results, (obj) => ({
          code: obj.collection_code,
          reward_flg: obj.reward_flg,
          seqs: JSON.parse(obj.json_str),
        }));

        resolve(collection_list);
      })
      .catch((e) => reject(e));
  });
};

exports.collection_get = function (aidx) {
  return new Promise((resolve, reject) => {
    const redis_key = com.make_redis_Key('fmeta', 'session', aidx);
    const hash_key = 'collection';

    redis.main
      .command('hget', [redis_key, hash_key])
      .then((results) => {
        if (!results) reject(error.collection_cache_data);
        resolve(JSON.parse(results));
      })
      .catch((e) => reject(e));
  });
};

exports.collection_update = async function (userdb, aidx, collection, insert_flag = false) {
  const { code, reward_flg, seqs } = collection;
  const json_str = JSON.stringify(seqs);

  if (insert_flag) await insert();
  else await update();

  function insert() {
    const query = com.make_query(
      ['insert into dat_collection(idx, aidx, collection_code, json_str, reward_flg) ', 'values(null, ?, ?, ?, ?);'],
      [aidx, code, json_str, reward_flg]
    );
    return mysql.query(userdb, query);
  }

  function update() {
    const query = com.make_query(
      ['update dat_collection set json_str = ?, reward_flg = ? where aidx = ? and collection_code = ?;'],
      [json_str, reward_flg, aidx, code]
    );
    return mysql.query(userdb, query);
  }
};

// ------- NFT --------- //
exports.get_nft_item_list = function (aftv_login_id) {
  if (aftv_login_id.length == 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const redis_key = com.make_redis_Key('fmeta', 'nft', 'user_id');
    redis.sub
      .command('hget', [redis_key, aftv_login_id])
      .then((reply) => resolve(!reply ? [] : JSON.parse(reply)))
      .catch((e) => reject(e));
  });
};

exports.nft_item_exists = function (aidx, item_code) {
  return new Promise((resolve, reject) => {
    const redis_key = com.make_redis_Key('fmeta', 'nft', 'item');
    redis.sub
      .command('hget', [redis_key, item_code])
      .then((reply) => {
        if (!reply) resolve(false);
        else resolve(_.includes(JSON.parse(reply), aidx) ? true : false);
      })
      .catch((e) => reject(e));
  });
};

exports.nft_item_owners = function (item_code) {
  return new Promise((resolve, reject) => {
    const redis_key = com.make_redis_Key('fmeta', 'nft', 'item');
    redis.sub
      .command('hget', [redis_key, item_code])
      .then((reply) => {
        if (!reply) resolve([]);
        else resolve(JSON.parse(reply));
      })
      .catch((e) => reject(e));
  });
};

exports.nft_item_unique_owners = function (item_code) {
  return new Promise((resolve, reject) => {
    this.nft_item_owners(item_code)
      .then((list) => resolve(list.length ? list[0] : 0))
      .catch((e) => reject(e));
  });
};

// -------------- gift inven ----------------
exports.send_gift_inven = function (userdb, insert_values) {
  const query = `insert into dat_gift_inven(idx, aidx, item_code, item_cnt, item_durability, item_enchant) values ${_.join(
    insert_values,
    ','
  )};`;
  return mysql.query(userdb, query);
};

exports.gift_inven_list = function (userdb, aidx) {
  const query = 'select idx, item_code, item_cnt, item_durability, item_enchant from dat_gift_inven where aidx = ?;';

  return mysql.query(userdb, query, [aidx]);
};

exports.gift_inven_delete = function (userdb, aidx) {
  const query = 'delete from dat_gift_inven where aidx = ?;';
  return mysql.query(userdb, query, [aidx]);
};

// --------- option --------------
exports.get_option = function (userdb, aidx) {
  return new Promise(function (resolve, reject) {
    const query = 'select opt from dat_option where aidx = ?;';

    mysql
      .query(userdb, query, [aidx])
      .then((results) => {
        resolve(results.length ? results[0] : null);
      })
      .catch((e) => reject(e));
  });
};

exports.update_user_option = function (userdb, opt, aidx) {
  const query = 'update dat_option set opt = ? where aidx = ?;';
  return mysql.query(userdb, query, [opt, aidx]);
};

exports.inspect_ignore_ip = function (ip) {
  const redis_key = com.make_redis_Key('fmeta', 'ignore_inspect');
  return new Promise((resolve, reject) => {
    redis.main
      .command('hget', [redis_key, ip])
      .then((reply) => resolve(reply ? true : false))
      .catch((e) => reject(e));
  });
};

// ------------ coin inven ------------------
exports.update_coin_inven = async function (userdb, aidx, _type, param, item_cnt) {
  await insert_item(userdb, aidx, _type, param, item_cnt);

  const redis_key = com.make_redis_Key('fmeta', 'notify', 'coin');
  await redis.sub.command('hset', [redis_key, aidx, com.get_time_ms()]);

  function insert_item(userdb, aidx, _type, param, item_cnt) {
    return new Promise(function (resolve, reject) {
      const query = com.make_query(
        [
          'insert into dat_coin_inven(idx, aidx, _type, param, item_cnt)',
          'values (null, ?, ?, ?, ?)',
          'on duplicate key update item_cnt = item_cnt + ?;',
        ],
        [aidx, _type, param, item_cnt, item_cnt]
      );
      mysql
        .query(userdb, query, [])
        .then(resolve())
        .catch((e) => reject(e));
    });
  }
};

exports.coin_inven_list = function (userdb, aidx) {
  const query = com.make_query(
    ['select idx, _type as type, param, item_cnt from dat_coin_inven ', 'where aidx = ?'],
    [aidx]
  );
  return mysql.query(userdb, query, []);
};

exports.coin_inven_get = function (userdb, aidx, idx) {
  const query = 'select _type as type, param, item_cnt from dat_coin_inven where idx = ? and aidx = ?;';
  return new Promise((resolve, reject) => {
    mysql
      .query(userdb, query, [idx, aidx])
      .then((results) => (results.length ? resolve(results[0]) : reject(error.parameter)))
      .catch((e) => reject(e));
  });
};

exports.coin_inven_delete = function (userdb, idx) {
  const query = 'delete from dat_coin_inven where idx = ?;';
  return mysql.query(userdb, query, [idx]);
};
