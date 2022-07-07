'use strict';
const { addPath } = require('app-module-path');
addPath(__dirname);
global._ = require('lodash');

const cluster = require('cluster');

let clusteridx;
if (cluster.isMaster) {
  clusteridx = 0;
  console.log('master cluster');
}

if (cluster.isWorker) {
  clusteridx = cluster.worker.id;
  console.log('worker cluster[' + cluster.worker.id + ']');
}
const com = require('com');
const logger = require('com/log');

const conf = require('game/config');
const redis = require('db/redis');
const mysql = require('db/mysql');
const Server = require('server');
const fnLog = require('functions/fnLog');
const fs = require('fs');
const path = require('path');
const ref = require('reference');
const stat = require('server/status');

const folders = fs.readdirSync('game/handlers');
const handler_list = _.reduce(
  folders,
  (r, folder) => {
    const files = fs.readdirSync(`game/handlers/${folder}`);
    _.forEach(files, (file) => {
      r.push({ folder, file });
    });

    return r;
  },
  []
);

const router = require('server/router');

process.on('uncaughtException', (err) => {
  if (err.stack) {
    err = err.stack;
  }
  logger.error(err);
  com.TelegramMessage(`freemeta game uncaughtException : ${err}`);
});

// ------ server start ----------
(async function () {
  try {
    logger.init('PID_' + process.pid, conf);

    stat.init(clusteridx);
    await redis.main.init(conf.redis.main);

    await mysql.init(conf.mysql, process.pid, conf.log.level.console);
    await com.dbtime_sync();
    await ref.load();

    _.forEach(handler_list, (d) => {
      const handler_name = path.basename(d.file, '.js');
      const handler_module = require(`game/handlers/${d.folder}/${handler_name}`);

      router.service.set_handler(handler_name, handler_module);
    });

    await start_server();
  } catch (err) {
    const errmsg = '>>>>>>>>>>>>>>> fail to start morr game server(port = ' + conf.server.port + ', err = ' + err + ')';
    logger.error(errmsg);
  }
})();

function start_server() {
  return new Promise(function (resolve, reject) {
    const svr = new Server(conf.server.port, router);
    svr.doStart(function (err) {
      if (err) {
        reject(err);
      } else {
        const successmsg = 'try to start [morr game server] : http://' + conf.server.domain + ':' + conf.server.port;
        logger.info(successmsg);
        resolve();
        stat.report_write('game');
        fnLog.log_insert_timer_run();

        if (conf.test_mode) {
          for (const senario of conf.test_mode.senarios) {
            require(`test_logic/${senario}`).run();
          }
        }
      }
    });
  });
}
