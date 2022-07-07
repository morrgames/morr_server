'use strict';

const ginfo = require('com/ginfo');
const session = require('com/session');
const logger = require('com/log');
const { error } = require('com/code');

const zlib = require('zlib');
const gzip = zlib.createGzip();
const crypto = require('crypto');
const sqlstr = require('sqlstring');
const dateFormat = require('dateformat');
const fnReward = require('functions/fnReward');
const fnLog = require('functions/fnLog');
const redis = require('db/redis');
const mysql = require('db/mysql');
const jwt = require('jsonwebtoken');
const conf = require('game/config');

const request = require('request');
const sprintf = require('sprintf');

const keyset = 'abcdefghijklmnopqrstuvwxyz@))$!!)@=ABCDEFGHIJKLMNOPQRSTUVWXYZ@))$!!)@=';

const iv = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const make_key = function () {
  const len = keyset.length - 1;

  let key = '';
  let AesKey = '';
  for (let i = 0; i < 4; i++) {
    const rand = _.random(len - 1);
    key = key.concat(keyset.charAt(rand));
  }

  AesKey = _.repeat(key, 8);

  return { key: key, AesKey: AesKey };
};

exports.zlib = zlib;

exports.gzip_uncompress = function (data) {
  let ret;
  try {
    const buf = Buffer.from(data, 'base64');
    const dec = zlib.unzipSync(buf);
    ret = dec.toString();
  } catch (err) {
    if (err) {
      logger.error('gzip_uncompress error(err=' + err + ')');
    }
  }

  return ret;
};
exports.gzip_compress = function (data) {
  let ret;
  try {
    const buf = zlib.deflateSync(data);
    ret = buf.toString('base64');
  } catch (err) {
    if (err) {
      logger.error('gzip_compress error(err=' + err + ')');
    }
  }

  return ret;
};

exports.gzip_compress_crypt = function (data) {
  let ret;
  try {
    let key = make_key();
    const buf = zlib.deflateSync(data);
    const cipher = crypto.createCipheriv('aes-256-cbc', key.AesKey, Buffer.from(iv));
    let crypted = cipher.update(buf, 'utf8', 'base64');
    crypted += cipher.final('base64');

    ret = key.key.concat(crypted);
  } catch (err) {
    if (err) {
      console.log('gzip_compress_crypt error(err=' + err + ')');
    }
  }

  return ret;
};

exports.gzip_uncompress_crypt = function (data) {
  let ret;
  try {
    let key = data.slice(0, 4);
    const crypted = data.slice(4, data.length);

    for (let i = 0; i < 3; i++) {
      key = key.concat(key);
    }

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv));
    const start = decipher.update(crypted, 'base64');
    const end = decipher.final();
    const decrypted = Buffer.concat([start, end]);
    const dec = zlib.unzipSync(decrypted);
    ret = dec.toString();
  } catch (err) {
    if (err) {
      console.log('gzip_uncompress_crypt error : ' + err + ')');
    }
  }

  return ret;
};

exports.make_redis_Key = function (...args) {
  return _.join(args, ':');
};

exports.make_query = function (strlist, inputlist) {
  const query = typeof strlist === 'string' ? strlist : _.join(strlist, ' ');
  return sqlstr.format(query, inputlist);
};

exports.input_check = function (...arg) {
  const undef = _.includes(arg, undefined);
  if (undef) throw error.parameter;
};

exports.get_time = function () {
  const now = new Date();
  const time = Math.floor(now.valueOf() / 1000);

  if (dbtime_diff) return time - dbtime_diff;
  else return time;
};

exports.get_time_ms = function () {
  const now = new Date();
  const time = now.valueOf();

  if (dbtime_diff) return time - dbtime_diff * 1000;
  else return time;
};

exports.get_date = function () {
  const now = new Date(this.get_time() * 1000);
  return now;
};

exports.get_week = function () {
  const now = new Date(this.get_time() * 1000);
  const day = now.getDay() - 1;
  return day >= 0 ? day : 6;
};

exports.get_date_string = function (add_day) {
  let dt = this.get_date();
  if (add_day) {
    dt.setDate(dt.getDate() + add_day);
  }
  return dateFormat(dt, 'yyyy-mm-dd HH:MM:ss');
};

exports.get_date_string_from_dbunix = function (unix_time) {
  const now = new Date(unix_time * 1000);
  return dateFormat(now, 'yyyy-mm-dd HH:MM:ss');
};

exports.get_date_string_ymd = function (add_day) {
  let dt = this.get_date();
  if (add_day) {
    dt.setDate(dt.getDate() + add_day);
  }

  return dateFormat(dt, 'yyyymmdd');
};

exports.get_date_ymd = function (add_day) {
  return Number(this.get_date_string_ymd(add_day));
};

// not use -> lodash _.shuffle
exports.shuffle = function (list, loop = 1) {
  for (let l = 0; l < loop; l++) {
    for (let i = list.length - 1; i >= 0; i--) {
      const randomIndex = _.random(i);
      const itemAtIndex = list[randomIndex];
      list[randomIndex] = list[i];
      list[i] = itemAtIndex;
    }
  }
  return;
};

exports.get_week_by_unixtime = function (unix_time) {
  const date = new Date(unix_time * 1000);
  const day = date.getDay() - 1;
  return day >= 0 ? day : 6;
};

exports.diffMinute = function (little_unix_time, bigger_unix_time) {
  let ret = 0;
  const gap = bigger_unix_time - little_unix_time;
  if (gap <= 0) {
    ret = 0;
  } else {
    ret = Math.floor(gap / 60);
  }

  return ret;
};

exports.getType = function (obj) {
  const objectName = Object.prototype.toString.call(obj);
  const match = /\[object (\w+)\]/.exec(objectName);
  return match[1].toLowerCase();
};

Date.prototype.get_week_of_year = function () {
  //yeer of week
  const date = new Date(this.getTime());
  date.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year.
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  // January 4 is always in week 1.
  const week1 = new Date(date.getFullYear(), 0, 4);
  // Adjust to Thursday in week 1 and count number of weeks from date to week1.
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
};

Date.prototype.get_day_of_year = function () {
  //yeer of week
  const date = new Date(this.getTime());
  return Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
};

exports.array_division = function (arr, n) {
  const tmp = [];
  const len = arr.length;
  if (len == 0) return tmp;
  let cnt = Math.floor(len / n) + (Math.floor(len % n) > 0 ? 1 : 0);
  for (let i = 0; i < cnt; i++) {
    tmp.push(arr.splice(0, n));
  }

  return tmp;
};

exports.packet_start = function (ret, val, input, err) {
  ret.data = {};
  val.comdb;
  val.userdb;
  val.logdb;
  val.input = input;
  val.aidx = input.aidx;
  val.session = input.session;
  ret.cmd = input.cmd + 1;
  ret.status = err;
  val.ret = ret;

  logger.debug(JSON.stringify(input));
};

exports.packet_end = function (ret, val, err, callback) {
  const err_return = () => {
    if (typeof err == 'number') ret.status = err;
    else {
      if (err.stack && !err.sqlMessage) {
        err = err.stack;
        this.TelegramMessage('freemeta game critical error : cmd : ' + val.input.cmd + '(err:' + err + ')');
      }
      logger.error('error cmd : ', val.input.cmd, ' , err: ', err);
      ret.data = {};
      ret.status = err = error.unknown;
    }

    logger.error(JSON.stringify(val.input));
    logger.error(JSON.stringify(ret));

    mysql.release(val, err);
  };

  const success_return = () => {
    logger.debug(JSON.stringify(ret));
    mysql.release(val);
  };

  if (err) {
    err_return();
    callback(err, ret);
  } else {
    (async () => {
      try {
        if (val.reward && val.reward.modify) {
          await fnReward.set_reward(val, val.reward);
          ret.data.reward = val.reward.get();
          val.cache_set = true;
        }

        if (val.session_value && val.cache_set) {
          await session.set(val);
        }

        if (val.log) {
          const log_query_list = val.log.get();
          fnLog.insert_log_queue(log_query_list);
        }

        success_return();
        callback(null, ret);
      } catch (e) {
        err = e;
        err_return();
        callback(err, ret);
      }
    })();
  }
};

let dbtime_diff;

exports.dbtime_sync = function () {
  return new Promise((resolve, reject) => {
    const val = {};
    mysql
      .comdb_connect(val)
      .then((comdb) => mysql.query(comdb, 'select unix_timestamp(now()) as dbtime;'))
      .then(([{ dbtime }]) => {
        const now = new Date();
        const time = Math.floor(now.valueOf() / 1000);
        dbtime_diff = time - dbtime;
        resolve();
      })
      .catch((e) => reject(e))
      .finally(() => {
        mysql.release(val);
      });
  });
};

exports.getDayOfYear = function (date) {
  return Math.round((date.setHours(23) - new Date(date.getYear() + 1900, 0, 1, 0, 0, 0)) / 1000 / 60 / 60 / 24);
};

exports.check_server_condition = function (comdb, os_type) {
  return new Promise((resolve, reject) => {
    const query = this.make_query(
      [
        'SELECT version, inspect, account, login, ',
        'notice_page, inspect_page, help_page ',
        'FROM _ser_management where os_type = ?',
      ],
      [os_type]
    );

    comdb.query(query, [], (err, results) => {
      let obj;

      if (!err && results.length == 1) {
        const now = this.get_date();
        obj = _.merge(results[0], {
          time: Math.floor(now.valueOf() / 1000),
          timezone_offset: now.getTimezoneOffset() * 60,
        });
      } else err = error.parameter;

      if (err) reject(err);
      else resolve(obj);
    });
  });
};

exports.check_version = function (ser_version, cli_version) {
  if (ser_version != cli_version) {
    const sv = ser_version.split('.');
    const cv = cli_version.split('.');

    if (cv.length != 3) return false;

    if (sv[0] != cv[0]) return false;
    if (sv[1] != cv[1]) return false;
  }
  return true;
};

exports.getJSON = function (str) {
  try {
    const json = JSON.parse(str);
    return json;
  } catch (e) {
    return null;
  }
};

exports.isJSON = function (str) {
  try {
    const json = JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

exports.redis_key_exists = function (key, name) {
  return redis[name].command('exists', [key]);
};

exports.get_redis_keys = async function (pattern, name) {
  let cursor = '0';
  let key_list = [];
  while (1) {
    let reply = await redis[name].command('scan', [cursor, 'match', pattern, 'count', 1000]);

    cursor = reply[0];
    if (reply[1].length == 0) break;

    for (let i = 0; i < reply[1].length; i++) key_list.push(reply[1][i]);

    if (cursor == '0') break;
  }

  return key_list;
};

exports.get_redis_hscan = async function (key, name) {
  let cursor = '0';
  let datas = [];
  while (1) {
    let reply = await redis[name].command('hscan', [key, cursor, 'count', 100]);
    if (!reply) break;
    if (reply.length < 2) break;
    cursor = reply[0];
    const list = reply[1];

    for (let i = 0; i < list.length; i += 2) {
      const key = list[i];
      const data = list[i + 1];
      datas.push({ key, data: JSON.parse(data) });
    }

    if (cursor == '0') break;
  }

  return datas;
};

exports.get_redis_hscan_limit = async function (key, name, limit, init_cursor = '0') {
  let cursor = init_cursor;
  let datas = [];

  while (1) {
    let reply = await redis[name].command('hscan', [key, cursor, 'count', 100]);
    if (!reply) break;
    if (reply.length < 2) break;
    cursor = reply[0];
    const list = reply[1];

    for (let i = 0; i < list.length; i += 2) {
      const key = list[i];
      const data = list[i + 1];
      datas.push({ key, data: JSON.parse(data) });
    }

    if (cursor == '0') break;
    if (datas.length >= limit) break;
  }

  return { datas, cursor };
};

exports.get_redis_sscan = async function (key, name) {
  let cursor = '0';
  let datas = [];
  while (1) {
    let reply = await redis[name].command('sscan', [key, cursor, 'count', 100]);
    if (!reply) break;
    if (reply.length < 2) break;

    cursor = reply[0];
    const list = reply[1];

    datas = _.concat(datas, list);

    if (cursor == '0') break;
  }

  return datas;
};

exports.get_redis_keys_limit = async function (pattern, name, limit, init_cursor = '0') {
  let cursor = init_cursor;
  let key_list = [];
  while (1) {
    let reply = await redis[name].command('scan', [cursor, 'match', pattern, 'count', 1000]);
    cursor = reply[0];
    if (reply[1].length == 0) break;

    for (let i = 0; i < reply[1].length; i++) key_list.push(reply[1][i]);

    if (cursor == '0') break;
    if (key_list.length >= limit) break;
  }

  return { key_list, cursor };
};

exports.del_redis_keys = async function (key_list, name) {
  for (const key of key_list) {
    await redis[name].command('del', [key]);
  }
};

exports.sleep = function (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

// list object rate field include
exports.random_value = function (list_object) {
  const max = _.maxBy(list_object, (o) => o.rate);
  const rand = _.random(max.rate - 1);

  for (const o of list_object) {
    if (rand < o.rate) {
      return o;
    }
  }

  return null;
};

exports.generate_token = (user, expire) => {
  const obj = {
    aidx: user.aidx,
    login_type: user.login_type,
    os_type: user.os_type,
    user_no: user.user_no,
    grade: user.grade,
  };
  const token = jwt.sign({ data: obj }, conf.jwt.secret, {
    expiresIn: expire, //https://github.com/vercel/ms 형태
  });

  return token;
};

exports.decode_token = (token, ignore_expire = false) => {
  try {
    const decode = jwt.verify(token, conf.jwt.secret, ignore_expire ? { ignoreExpiration: true } : undefined);
    const now = this.get_time();

    const { aidx } = decode.data;
    const { exp, iat } = decode;

    // data.exp < now = 토큰 시간 만료
    logger.debug('uidx : ', aidx, ', exp : ', exp, ', iat : ', iat, ', now : ', now, ', expired : ', decode.exp < now);

    return decode.data;
  } catch (e) {
    // 인증 오류
    return { err: e.message ? e.message : 'decode fail' };
  }
};

exports.comdb_query = (query, value = []) => {
  return new Promise((resolve, reject) => {
    const val = {};
    mysql
      .comdb_connect(val)
      .then((comdb) => mysql.query(comdb, query, value))
      .then((results) => resolve(results))
      .catch((e) => reject(e))
      .finally(() => {
        mysql.release(val);
      });
  });
};

exports.msgdb_query = (query, value = []) => {
  return new Promise((resolve, reject) => {
    const val = {};
    mysql
      .msgdb_connect(val)
      .then((msgdb) => mysql.query(msgdb, query, value))
      .then((results) => resolve(results))
      .catch((e) => reject(e))
      .finally(() => {
        mysql.release(val);
      });
  });
};

exports.shuffle = function (list, loop = 1) {
  for (let l = 0; l < loop; l++) {
    for (let i = list.length - 1; i >= 0; i--) {
      const randomIndex = _.random(i);
      const itemAtIndex = list[randomIndex];
      list[randomIndex] = list[i];
      list[i] = itemAtIndex;
    }
  }
  return;
};

module.exports.TelegramMessage = function (text) {
  const options = _.cloneDeep(conf.telegram_api);
  if (!options) return Promise.reject('telegram option not found!');
  if (options.send_flg != 1) return Promise.resolve();

  options.url = sprintf(options.url, options.token);
  options.body.text += text;

  _.unset(options, 'send_flg');
  _.unset(options, 'token');

  return new Promise((resolve, reject) => {
    request.post(options, function (err, res, body) {
      if (err) reject(err);
      else resolve(body);
    });
  });
};

exports.get_login_id_hash = function (id) {
  const login_secret = conf.login_secret;
  const data = `${login_secret}${id}`;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return hash;
};

exports.inet_aton = (ip) => {
  // split into octets
  const a = ip.split('.');
  const buffer = new ArrayBuffer(4);
  const dv = new DataView(buffer);
  for (let i = 0; i < 4; i++) {
    dv.setUint8(i, a[i]);
  }
  return dv.getUint32(0);
};

// num example: 3232236033
exports.inet_ntoa = (num) => {
  const nbuffer = new ArrayBuffer(4);
  const ndv = new DataView(nbuffer);
  ndv.setUint32(0, num);

  const a = new Array();
  for (let i = 0; i < 4; i++) {
    a[i] = ndv.getUint8(i);
  }
  return a.join('.');
};
