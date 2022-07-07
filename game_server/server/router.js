'use strict';

const responsor = require('server/responsor');

const stat = require('server/status');
const CODE = require('com/code').game_packet;
const com = require('com');
const logger = require('com/log');
const { error } = require('com/code');
const validator = require('server/validator');

class Service {
  constructor() {
    this.handlers = {};
    this.func = {};
  }

  set_handler(proto_name, protocol) {
    //yeer of week
    this.func[proto_name] = function (input, res) {
      const start = com.get_date().getTime();

      const input_chk = validator.check(input, proto_name);
      if (!input_chk) {
        logger.error('parameter error : ', input);
        return responsor.doSend(input, res, error.validator, input.cmd + 1);
      }

      protocol(input, function (err, data) {
        stat.add(CODE[proto_name], proto_name, com.get_date().getTime() - start);
        if (err) {
          logger.error(JSON.stringify(err));
          responsor.doSend(input, res, err, input.cmd + 1, data.data);
          return;
        }
        responsor.sendData(input, res, data);
      });
    };

    this.handlers[CODE[proto_name]] = this.func[proto_name];
  }
}

const service = new Service();
exports.service = service;

exports.doRoute = function (data, res, client_ip) {
  const handlers = service.handlers;

  if (!data || !data.length) {
    responsor.doSend(null, res, error.nodata, 0);
    return;
  }

  let input = {};
  try {
    //data = qs.unescape(encodedStr);
    input = JSON.parse(com.gzip_uncompress_crypt(data));
    input.client_ip = client_ip;
  } catch (err) {
    responsor.doSend(input, res, error.crypto, input.cmd + 1);
    return;
  }

  if (typeof handlers[input.cmd] === 'function') {
    handlers[input.cmd](input, res);
  } else {
    logger.debug('not found handler.[' + input.cmd + ']');
    responsor.doSend(input, res, error.nohandler, input.cmd + 1);
  }
};
