'use strict';

const redis = require('redis'),
  Multi = require('redis').Multi,
  logger = require('com/log');

Multi.prototype.execute = function () {
  return new Promise((resolve, reject) => this.exec((err, replys) => (err ? reject(err) : resolve(replys))));
};

class redis_store {
  constructor(name) {
    this.pub;
    this.sub;
    this.name = name;
    this.sub_msg_function = {};
  }
  init(conf) {
    return new Promise((resolve) => {
      this.pub = redis.createClient(conf.port, conf.host);
      if (conf.password != undefined) this.pub.auth_pass = conf.password;

      this.pub.on('error', (err) => {
        logger.error(this.name, ': redis close ', err);
      });

      this.pub.on('end', (err) => {
        logger.error(this.name, ': redis end ', err);
      });

      this.pub.on('connect', () => {
        logger.info(`${this.name} : redis-connect-database = ${conf.db ? conf.db : 0} : ${conf.host}:${conf.port}`);
        if (this.pub.isInit == undefined) {
          if (conf.db) {
            this.pub.select(conf.db);
          }

          setInterval(() => {
            this.pub.ping((r) => logger.info(this.name, ': redis pong'));
          }, 1000 * 60 * 10);

          this.pub.isInit = true;
        }
        resolve();
      });

      if (conf.subscribe) {
        this.sub = redis.createClient(conf.port, conf.host);
        const sub_channel = conf.subscribe;
        this.sub.subscribe(...sub_channel);

        this.sub.on('connect', () => {
          logger.info('connect sub redis : ', sub_channel);
        });

        this.sub.on('message', (channel, msg) => {
          //logger.info(channel, ' : ', msg);
          if (this.sub_msg_function[channel]) {
            this.sub_msg_function[channel](msg);
          }
        });

        this.sub.on('error', (err) => {
          logger.error('sub error : ', err);
        });
      }
    });
  }
  command(cmd, list) {
    return new Promise((resolve, reject) => {
      this.pub.send_command(cmd, list, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  }

  multi() {
    const multi = this.pub.multi();
    return multi;
  }

  set_msg_function(channel, f) {
    this.sub_msg_function[channel] = f;
  }
}

const main = new redis_store('main');

const get_sio_redis_adapter = (host, port, key) => {
  const redisAdapter = require('socket.io-redis');
  const EventEmitter = require('events');
  const connect_event = new EventEmitter();

  // return redisAdapter({ host, port, key });

  //Exception handling added because reconnection does not work
  const pub = redis.createClient(port, host);
  const sub = pub.duplicate();

  pub.on('error', (err) => logger.error('socket.io redis pub error : ' + err.stack));
  sub.on('error', (err) => logger.error('socket.io redis sub error : ' + err.stack));
  pub.on('end', (err) => logger.error('socket.io redis pub end : ' + err));
  sub.on('end', (err) => logger.error('socket.io redis sub end : ' + err));
  pub.on('connect', (err) => connect_event.emit('pub'));
  sub.on('connect', (err) => connect_event.emit('sub'));

  const adapter = redisAdapter({ pubClient: pub, subClient: sub, key });

  // redis 접속후에 서버 바인드 되도록 처리
  return new Promise((resolve) => {
    connect_event.once('pub', (name) => {
      logger.info('socket.io redis pub connect : ' + key);
      const listner_cnt = connect_event.listenerCount('sub');
      if (listner_cnt == 0) resolve(adapter);
    });
    connect_event.once('sub', (name) => {
      logger.info('socket.io redis sub connect : ' + key);
      const listner_cnt = connect_event.listenerCount('pub');
      if (listner_cnt == 0) resolve(adapter);
    });
  });
};

module.exports = {
  main,
  get_sio_redis_adapter,
};
