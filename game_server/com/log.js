'use strict';

const fs = require('fs');

const winston = require('winston'),
  dateFormat = require('dateformat');

Object.defineProperty(global, '__stack', {
  get: function () {
    const orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function (_, stack) {
      return stack;
    };
    const err = new Error();
    Error.captureStackTrace(err, arguments.callee);
    const stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
  },
});

Object.defineProperty(global, '__line', {
  get: function () {
    return __stack[2].getLineNumber();
  },
});

Object.defineProperty(global, '__function', {
  get: function () {
    const fullFilename = __stack[2].getFileName();
    const paths = fullFilename.split('/');
    return paths[paths.length - 1];
  },
});

const loglevel = {
  debug: 4,
  info: 3,
  warn: 2,
  error: 1,
};

function Log() {}

Log.prototype.init = function (logname, conf) {
  this.console_level = loglevel[conf.log.level.console];
  this.file_level = loglevel[conf.log.level.file];
  const path = `${process.cwd()}/${conf.log.path}`;
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }
  const option = {
    exitOnError: false,
    transports: [
      new winston.transports.Console({
        level: conf.log.level.console,
        json: false,
        timestamp: () => dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss:l'),
      }),
      new winston.transports.DailyRotateFile({
        level: conf.log.level.file,
        json: false,
        filename: `${path}/${conf.log.filename}`,
        datePattern: 'yyyy_MM_dd' + '_' + logname + '.log',
        maxsize: 10240000,
        timestamp: () => dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss:l'),
      }),
    ],
  };
  this.logger = new winston.Logger(option);

  this.get_message = function (...arg) {
    if (arg.length == 1) return arg[0];
    const str = _.reduce(arg, (msg, a) => msg + (typeof a === 'object' ? JSON.stringify(a) : a), '');
    return str;
  };
};

Log.prototype.error = function (...arg) {
  if (this.console_level < loglevel.error && this.file_level < loglevel.error) return;

  const message = this.get_message(...arg);
  this.logger.error(message);
};

Log.prototype.warn = function (...arg) {
  if (this.console_level < loglevel.warn && this.file_level < loglevel.warn) return;

  const message = this.get_message(...arg);
  this.logger.warn(message);
};

Log.prototype.info = function (...arg) {
  if (this.console_level < loglevel.info && this.file_level < loglevel.info) return;

  const message = this.get_message(...arg);
  this.logger.info(message);
};

Log.prototype.debug = function (...arg) {
  if (this.console_level < loglevel.debug && this.file_level < loglevel.debug) return;

  const message = this.get_message(...arg);
  this.logger.debug(message);
};

const logger = new Log();
module.exports = logger;
