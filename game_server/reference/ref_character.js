'use strict';

const com = require('com');
const mysql = require('db/mysql');
const logger = require('com/log');

let data = {};

exports.load = async function (mod) {
  const val = {};
  try {
    // await mysql.comdb_connect(val);
    // await select_data();
  } catch (e) {
    val.err = e;
  }

  mysql.release(val, val.err);

  logger.info('load character reference table ' + (val.err ? 'fail : ' + val.err : 'success !!'));

  return val.err;

  function select_data() {
    return new Promise(function (resolve, reject) {
      const temp_data = {};

      const query = 'select code, gender from ref_character;';

      val.comdb.query(query, [], function (err, results) {
        if (!err) {
          for (const info of results) {
            temp_data[info.code] = info;
          }
        }

        if (err) reject(err);
        else {
          data = temp_data;
          resolve();
        }
      });
    });
  }
};

exports.get = function (reward_code) {
  return data[reward_code];
};

exports.get_all = function () {
  return data;
};
