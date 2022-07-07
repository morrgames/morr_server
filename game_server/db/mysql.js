'use strict';

const mysql = require('mysql'),
  logger = require('com/log'),
  mysql_connection = require('mysql/lib/Connection');

let log_level = 'debug';

const originalQuery = mysql_connection.prototype.query;
mysql_connection.prototype.query = function (...args) {
  const [sql, values] = args;

  if (log_level === 'debug') {
    if (typeof sql == 'object') {
      logger.debug(`[${this.config.database}]`, sql.sql);
    } else {
      logger.debug(`[${this.config.database}]`, sql, 'values :', values);
    }
  }

  return originalQuery.apply(this, args);
};

function report(name, pool) {
  logger.info(
    `[${name}] all : ${pool._allConnections.length}, wait : ${pool._connectionQueue.length}, acqu : ${pool._acquiringConnections.length}, free : ${pool._freeConnections.length}`
  );
}

let comPool, logPool, msgPool, userPool;

exports.init = async function (config, index, loglevel) {
  log_level = loglevel;
  comPool = mysql.createPool(config.com);
  logPool = mysql.createPool(config.log);
  msgPool = mysql.createPool(config.msg);
  userPool = mysql.createPool(config.user);
  logger.info(`mysql ${config.com.database} com db init : ${config.com.host}:${config.com.port}`);
  logger.info(`mysql ${config.log.database} log db init : ${config.log.host}:${config.log.port}`);
  logger.info(`mysql ${config.msg.database} msg db init : ${config.msg.host}:${config.msg.port}`);
  logger.info(`mysql ${config.user.database} user db init : ${config.user.host}:${config.user.port}`);

  setInterval(() => {
    console.log('==== srv idx  ', index, '======');
    report('game db pool', comPool);
    report('log db pool ', logPool);
    report('msg db pool ', msgPool);
    report('user db pool ', userPool);

    console.log('==============================');
  }, 1000 * 60 * 5);
};

exports.comdb_connect = function (val) {
  if (val.comdb) return Promise.resolve(val.comdb);

  return new Promise((resolve, reject) => {
    comPool.getConnection(function (err, con) {
      if (err) {
        logger.error('comdb_connect error : ', err);
        reject(err);
      } else {
        val.comdb = con;
        val.comdb.trans = false;
        resolve(con);
        logger.debug('comdb connect');
      }
    });
  });
};

exports.comdb_transaction = function (val) {
  if (val.comdb.trans) return Promise.resolve();

  return new Promise((resolve, reject) => {
    val.comdb.beginTransaction(function (err) {
      if (err) {
        logger.error('comdb_transaction error : ', err);
        reject(err);
      } else {
        val.comdb.trans = true;
        resolve();
        logger.debug('comdb transaction start');
      }
    });
  });
};

exports.logdb_connect = function (val) {
  if (val.logdb) return Promise.resolve(val.logdb);

  return new Promise((resolve, reject) => {
    logPool.getConnection(function (err, con) {
      if (err) {
        reject(err);
        logger.error('logdb_connect error : ', err);
      } else {
        val.logdb = con;
        val.logdb.trans = false;
        resolve(con);
        logger.debug('logdb connect');
      }
    });
  });
};

exports.logdb_transaction = function (val) {
  if (val.logdb.trans) return Promise.resolve();

  return new Promise((resolve, reject) => {
    val.logdb.beginTransaction(function (err) {
      if (err) {
        logger.error('logdb_transaction error : ', err);
        reject(err);
      } else {
        val.logdb.trans = true;
        logger.debug('logdb transaction start');
        resolve();
      }
    });
  });
};

exports.msgdb_connect = function (val) {
  if (val.msgdb) return Promise.resolve(val.msgdb);

  return new Promise((resolve, reject) => {
    msgPool.getConnection(function (err, con) {
      if (err) {
        logger.error('msgdb_connect error : ', err);
        reject(err);
      } else {
        val.msgdb = con;
        val.msgdb.trans = false;
        resolve(con);
        logger.debug('msgdb connect');
      }
    });
  });
};

exports.msgdb_transaction = function (val) {
  if (val.msgdb.trans) return Promise.resolve();

  return new Promise((resolve, reject) => {
    val.msgdb.beginTransaction(function (err) {
      if (err) {
        logger.error('msgdb_transaction error : ', err);
        reject(err);
      } else {
        val.msgdb.trans = true;
        resolve();
        logger.debug('msgdb transaction start');
      }
    });
  });
};

exports.userdb_connect = function (val) {
  if (val.userdb) return Promise.resolve(val.userdb);

  return new Promise((resolve, reject) => {
    userPool.getConnection(function (err, con) {
      if (err) {
        logger.error('userdb_connect error : ', err);
        reject(err);
      } else {
        val.userdb = con;
        val.userdb.trans = false;
        resolve(con);
        logger.debug('userdb connect');
      }
    });
  });
};

exports.userdb_transaction = function (val) {
  if (val.userdb.trans) return Promise.resolve();

  return new Promise((resolve, reject) => {
    val.userdb.beginTransaction(function (err) {
      if (err) {
        logger.error('userdb_transaction error : ', err);
        reject(err);
      } else {
        val.userdb.trans = true;
        resolve();
        logger.debug('userdb transaction start');
      }
    });
  });
};

exports.query = function (con, query, values = []) {
  return new Promise((resolve, reject) => {
    con.query(query, values, function (err, results) {
      if (err) {
        logger.error('db_query error : ', err);
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

exports.release = function (val, err) {
  if (err) {
    if (val.comdb && val.comdb.trans) {
      val.comdb.rollback();
      val.comdb.trans = false;
      logger.debug('comdb transaction rollback');
    }
    if (val.logdb && val.logdb.trans) {
      val.logdb.rollback();
      val.logdb.trans = false;
      logger.debug('logdb transaction rollback');
    }
    if (val.msgdb && val.msgdb.trans) {
      val.msgdb.rollback();
      val.msgdb.trans = false;
      logger.debug('msgdb transaction rollback');
    }
    if (val.userdb && val.userdb.trans) {
      val.userdb.rollback();
      val.userdb.trans = false;
      logger.debug('userdb transaction rollback');
    }
  } else {
    if (val.comdb && val.comdb.trans) {
      val.comdb.commit();
      val.comdb.trans = false;
      logger.debug('comdb transaction commit');
    }
    if (val.logdb && val.logdb.trans) {
      val.logdb.commit();
      val.logdb.trans = false;
      logger.debug('logdb transaction commit');
    }
    if (val.msgdb && val.msgdb.trans) {
      val.msgdb.commit();
      val.msgdb.trans = false;
      logger.debug('msgdb transaction commit');
    }
    if (val.userdb && val.userdb.trans) {
      val.userdb.commit();
      val.userdb.trans = false;
      logger.debug('userdb transaction commit');
    }
  }
  if (val.comdb) {
    logger.debug('comdb connect pool release');
    val.comdb.release();
  }
  if (val.logdb) {
    logger.debug('logdb connect pool release');
    val.logdb.release();
  }
  if (val.msgdb) {
    logger.debug('msgdb connect pool release');
    val.msgdb.release();
  }
  if (val.userdb) {
    logger.debug('userdb connect pool release');
    val.userdb.release();
  }
};

exports.single_query = async function (conf, query, values = []) {
  const val = {};
  let results = {};
  try {
    val.connect = await connect(conf);
    results = await this.query(val.connect, query, []);
  } catch (e) {
    val.err = e;
  } finally {
    if (val.connect) val.connect.end();
  }

  if (val.err) throw 'single query error : ' + val.err;
  return results;

  function connect(conf) {
    return new Promise((resolve, reject) => {
      const con = mysql.createConnection(conf);
      con.connect((err) => {
        if (err) reject(err);
        else resolve(con);
      });
    });
  }
};
