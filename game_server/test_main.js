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
const match_module = require('match/match_module');
const stat = require('server/status');

let handler_list = fs.readdirSync('game/handlers');
const match_handler_list = fs.readdirSync('match/handlers');
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
    await redis.sub.init(conf.redis.sub);
    await redis.msg.init(conf.redis.msg);

    await mysql.init(conf.mysql, process.pid, conf.log.level.console);
    await com.dbtime_sync();
    await ref.load();

    const folders = fs.readdirSync('game/handlers');
    _.pull(folders, '.svn');

    handler_list = _.reduce(
      folders,
      (r, folder) => {
        const files = fs.readdirSync(`game/handlers/${folder}`);
        _.pull(files, '.svn');

        _.forEach(files, (file) => {
          r.push({ folder, file });
        });

        return r;
      },
      []
    );

    _.pull(match_handler_list, '.svn');
    _.forEach(match_handler_list, (str) => {
      const handler_name = path.basename(str, '.js');
      console.log('handler name : ', handler_name);
      const handler_module = require(`match/handlers/${handler_name}`);

      router.service.set_handler(handler_name, handler_module);
    });

    await delete_packet_status();
    redis.sub.set_msg_function(subscrib_function);

    await start_server();

    //await match_module.init_server_from_redis();
    //match_module.room_clear_timer_run();

    // schedule run
    //const schedule_play_world = require('match/schedule/play_world_update');
    //await schedule_play_world.init();

    const senario = require('test_logic/test_senario2');
    await senario.run();

    console.log('종료!!');

    //await com.TelegramMessage('freemeta game server start success !!');
  } catch (err) {
    const errmsg =
      '>>>>>>>>>>>>>>> fail to start freemeta test game server(port = ' + conf.server.port + ', err = ' + err + ')';
    logger.error(errmsg);
    await com.TelegramMessage(errmsg);
  }
})();

function start_server() {
  return new Promise(function (resolve, reject) {
    const svr = new Server(conf.server.port, router, match_view_router);
    svr.doStart(function (err) {
      if (err) {
        reject(err);
      } else {
        const successmsg =
          'try to start [freemeta game test mode server] : http://' + conf.server.domain + ':' + conf.server.port;
        logger.info(successmsg);
        resolve();
        stat.report_write('game');
        fnLog.log_insert_timer_run();
      }
    });
  });
}

function match_view_router(req, res) {
  let html = '';
  const set_html = (h) => {
    html = html.concat(h);
  };
  if (conf.debug_match_status == 1) {
    set_html('<html lang="ko-kr"><head><meta charset="utf-8"/></head><body>');
    set_html('<h4> servers </h4><pre>');
    set_html(`${JSON.stringify(match_module.servers, null, 2)}</pre>`);
    set_html('<h4> lives </h4><pre>');
    set_html(`${JSON.stringify(match_module.lives, null, 2)}</pre>`);
    set_html('</body></html>');
  }

  res.write(html);
  res.end();
}

async function delete_packet_status() {
  const pattern = com.make_redis_Key('packet', 'status', '*');
  const key_list = await com.get_redis_keys(pattern, 'main');
  await com.del_redis_keys(key_list, 'main');
}

function subscrib_function(msg) {
  if (msg == 'ref_table_reload') {
    ref
      .load()
      .then(() => logger.info('ref table reload success'))
      .catch((e) => logger.debug('ref table reload fail : ', e));
  }
}
