'use strict';

const cluster = require('cluster');
const com = require('com');
const logger = require('com/log');

const redis = require('db/redis');
let svrIndex;

exports.init = function (index) {
  svrIndex = index;
};
const map = {};

class CallData {
  constructor(cmd, key) {
    this.cmd = cmd;
    this.key = key;
    this.call = 0;
    this.total = 0;
    this.max = 0;
    this.min = 0;
    this.average = 0;
  }

  add(time) {
    time /= 1000;
    ++this.call;
    this.total += time;
    this.max = Math.max(this.max, time);
    this.min = Math.min(this.min, time);
    this.average = this.total / this.call;
  }
}

exports.add = function (cmd, key, time) {
  if (!map[cmd]) {
    map[cmd] = new CallData(cmd, key);
  }
  map[cmd].add(time);
};

exports.report = function () {
  if (!Object.keys(map).length) {
    return 'packet status not recorded yet.';
  }
  return JSON.stringify(map);
};

exports.report_write = function (name) {
  const that = this;
  write_redis();
  setInterval(write_redis, 1000 * 60 * 5); // every 5 min

  function write_redis() {
    let key;
    if (cluster.isMaster) {
      logger.info('packet status : ' + that.report());
      key = com.make_redis_Key('packet', 'status', name);
    }

    if (cluster.isWorker) {
      logger.info('packet status cluster[' + cluster.worker.id + '] : ' + that.report());
      key = com.make_redis_Key('packet', 'status', name, cluster.worker.id);
    }

    redis.main.command('set', [key, that.report()]);
  }
};
