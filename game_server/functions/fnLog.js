'use strict';
const com = require('com');
const mysql = require('db/mysql');
const logger = require('com/log');

class log_data {
  constructor(cmd, aidx) {
    this.aidx = aidx != undefined ? aidx : 0;
    this.cmd = cmd;
    this.log_list = [];
  }
  add(table, data) {
    this.log_list.push({
      table: table,
      data: data,
      reg_dt: com.get_date_string(),
    });
  }
  get() {
    let query_list = [];

    for (let i = 0; i < this.log_list.length; i++) {
      const l = this.log_list[i];
      // log table is (idx, packet, aidx, .... reg_dt) include
      const query = com.make_query(['(null, ?, ?, ?, ?)'], [this.cmd, this.aidx, l.data, l.reg_dt]);

      query_list.push({ table: l.table, values: query });
    }

    return query_list;
  }
  removeAll() {
    this.log_list = [];
  }
}

exports.new_log = function (cmd, aidx) {
  return new log_data(cmd, aidx);
};

exports.log_query_queue = [];

exports.insert_log_queue = function (log_query_list) {
  if (log_query_list.length) this.log_query_queue = this.log_query_queue.concat(log_query_list);
};

exports.log_insert_timer_run = function () {
  const delay = 2000;
  const that = this;

  setTimeout(async function timer_task() {
    const log_querys = Array.prototype.slice.call(that.log_query_queue);
    that.log_query_queue = [];

    const val = {};
    try {
      if (log_querys.length) {
        let logdb = await mysql.logdb_connect(val);
        await mysql.logdb_transaction(val);

        let tmp = {};
        for (let i = 0; i < log_querys.length; i++) {
          const l = log_querys[i];
          if (tmp[l.table] == undefined) {
            tmp[l.table] = `insert into log_${l.table} values ${l.values}`;
          } else {
            tmp[l.table] = tmp[l.table].concat(',' + l.values);
          }
        }

        for (const i in tmp) {
          await mysql.query(logdb, tmp[i], []);
        }
      }
    } catch (e) {
      val.err = e;
    }

    mysql.release(val, val.err);

    setTimeout(timer_task, delay);
  }, delay);
};
