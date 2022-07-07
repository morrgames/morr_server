'use strict';

const fnUser = require('functions/fnUser');
const fnLog = require('functions/fnLog');
const conf = require('game/config');
const com = require('com');
const session = require('com/session');
const { error } = require('com/code');
const mysql = require('db/mysql');
const ginfo = require('com/ginfo');
const redis = require('db/redis');

module.exports = async function (input, callback) {
  const ret = {};
  const val = {};

  com.packet_start(ret, val, input, error.none);

  // main process
  try {
    const comdb = await mysql.comdb_connect(val);

    if (input.login_type == ginfo.login_type.guest) {
      login_id = 'gst_'.concat(input.login_id);
    } else throw error.login_type;

    let user_info = await fnUser.get_userinfo_by_id(comdb, login_id);

    const aidx = user_info.aidx;

    val.session_value = {};
    val.session_value.user = await session.init(user_info);

    // val.log = fnLog.new_log(input.cmd, aidx);
    // val.log.add('login', [login_id]);

    ret.data.user_info = user_info;
    ret.data.api_token = com.generate_token(val.session_value.user, conf.jwt.access_token_expire);
    ret.data.api_token_expire = conf.jwt.access_token_expire;
  } catch (e) {
    val.err = e;
  }

  // packet end
  com.packet_end(ret, val, val.err, callback);
};
