'use strict';

const com = require('com');

exports.sendData = function (input, res, data) {
  let json;
  if (data != undefined) {
    json = JSON.stringify(data);
  }
  if (json == undefined) return;

  res.write(com.gzip_compress_crypt(json));
  res.end();
};

exports.doSend = function (input, res, status, cmd, data) {
  const ret = {};
  ret.status = status;
  ret.cmd = cmd;
  ret.data = data;
  this.sendData(input, res, ret);
};
