'use strict';
const Valid = require('jsonschema').Validator;
const ginfo = require('com/ginfo');
// jsonschema https://www.npmjs.com/package/jsonschema
// http://tcpschool.com/json/json_schema_schema

const validator = {};

// check
validator.check = (obj, name) => {
  if (validator[name] == undefined) return false;
  const v = new Valid();

  // const ret = v.validate(obj, validator[name], { nestedErrors: true });
  // if (!ret.disableFormat) {
  //   console.log(`validator error : `, obj, ret.errors);
  // }
  // return ret.disableFormat;

  const ret = v.validate(obj, validator[name]).valid;
  return ret;
};
// body
validator.login = {
  type: 'object',
  properties: {
    os_type: { type: 'intiger', minimum: ginfo.os_type.android, maximum: ginfo.os_type.ios },
    login_id: { type: 'string', minLength: 1, maxLength: 255 },
    uuid: { type: 'string', minLength: 1, maxLength: 255 },
    login_type: { type: 'integer', minimum: ginfo.login_type.guest, maximum: ginfo.login_type.max },
  },
  required: ['os_type', 'login_id', 'uuid', 'login_type'],
};

validator.reg_id = {
  type: 'object',
  properties: {
    login_id: { type: 'string', minLength: 1, maxLength: 255 },
    uuid: { type: 'string', minLength: 1, maxLength: 255 },
    login_type: { type: 'integer', minimum: ginfo.login_type.guest, maximum: ginfo.login_type.max },
    name: { type: 'string', minLength: 0, maxLength: 50 },
  },
  required: ['login_id', 'uuid', 'login_type', 'name'],
};

validator.account_switching = {
  type: 'object',
  properties: {
    aidx: { type: 'intiger', minimum: 1 },
    session: { type: 'string', minLength: 8, maxLength: 10 },
    login_id: { type: 'string', minLength: 1, maxLength: 255 },
    user_no: { type: 'string', minLength: 0, maxLength: 50 },
    login_type: { type: 'integer', minimum: ginfo.login_type.affrecatv, maximum: ginfo.login_type.max },
    name: { type: 'string', minLength: 1, maxLength: 50 },
  },
  required: ['aidx', 'session', 'login_id', 'login_type', 'name', 'user_no'],
};

validator._test_packet = {
  type: 'object',
  properties: {
    aidx: { type: 'intiger', minimum: 1 },
    session: { type: 'string', minLength: 8, maxLength: 10 },
  },
  required: ['aidx', 'session'],
};

module.exports = validator;
