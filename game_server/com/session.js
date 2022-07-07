'use strict';

const com = require('com');
const ginfo = require('com/ginfo');
const { error } = require('com/code');

const fnReward = require('functions/fnReward');
const fnLog = require('functions/fnLog');
const redis = require('db/redis');
const SESSION_MIN = 10000000;
const SESSION_MAX = 99999999;

const generate = function () {
  return _.random(SESSION_MIN, SESSION_MAX).toString();
};

exports.init = function (user_info) {
  return new Promise((resolve, reject) => {
    const session_key = com.make_redis_Key('morr', 'session', user_info.aidx);
    user_info.session = generate();

    const values = [session_key, 'session', user_info.session, 'user', JSON.stringify(user_info)];

    redis.main
      .command('del', [session_key])
      .then(() => redis.main.command('hmset', values))
      .then((reply) => redis.main.command('expire', [session_key, ginfo.session_time_out_sec]))
      .then(() => resolve(user_info))
      .catch((e) => reject(e));
  });
};

exports.set = async function (val) {
  let key = com.make_redis_Key('fmeta', 'session', val.aidx);

  let values = [];

  values.push(key);
  values.push('user');
  values.push(JSON.stringify(val.session_value.user));

  if (val.cache_all) {
    // values.push('items');
    // values.push(JSON.stringify(val.session_value.items));
    // values.push('unique_items');
    // values.push(JSON.stringify(val.session_value.unique_items));
    // values.push('avatars');
    // values.push(JSON.stringify(val.session_value.avatars));
  }

  await redis.main.command(values.length == 3 ? 'hset' : 'hmset', values);
};

exports.get = function (val, all = true) {
  if (!val.session_value) val.session_value = {};
  val.cache_all = all;

  const key = com.make_redis_Key('morr', 'session', val.aidx);

  const rc = {
    cmd: 'hmget',
    values: [key, 'session', 'user'],
  };
  if (all) {
    rc.values = [key, 'session', 'user'];
  }

  return new Promise((resolve, reject) => {
    redis.main
      .command(rc.cmd, rc.values)
      .then((reply) => {
        for (let i = 0; i < reply.length; i++) {
          const name = rc.values[i + 1];
          if (name == 'session') val.session_value[name] = reply[i];
          else val.session_value[name] = JSON.parse(reply[i]);
        }

        resolve(val.session_value);
      })
      .catch((e) => reject(e));
  });
};

exports.check = async function (val, all = true) {
  const key = com.make_redis_Key('morr', 'session', val.aidx);
  const session = val.session;
  const session_value = await this.get(val, all);

  if (!session_value) throw error.session_invalid;
  if (!session_value.user) throw error.session_invalid;
  if (session_value.session !== session) throw error.session;

  await redis.main.command('expire', [key, ginfo.session_time_out_sec]);
  val.session_value = session_value;
  val.log = fnLog.new_log(val.input.cmd, val.input.aidx);
  val.reward = fnReward.new_reward(val);
};

exports.release = function (aidx) {
  const key = com.make_redis_Key('morr', 'session', aidx);
  redis.main.command('expire', [key, 2]);
};

exports.exists = function (val) {
  return new Promise((resolve, reject) => {
    const key = com.make_redis_Key('morr', 'session', val.aidx);
    redis.main
      .command('hget', [key, 'session'])
      .then((session) => {
        if (!session) return reject(error.session_invalid);
        if (session != val.session) return reject(error.session);
        return redis.main.command('expire', [key, ginfo.session_time_out_sec]);
      })
      .then(() => resolve())
      .catch((e) => reject(e));
  });
};
