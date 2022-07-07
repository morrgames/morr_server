'use strict';

const logger = require('com/log');
const conf = require('game/config');
const AWS = require('aws-sdk');
const { error } = require('com/code');
const http = require('http');

// https://docs.aws.amazon.com/code-samples/latest/catalog/javascript-s3-s3_listobjects.js.html

const S3 = new AWS.S3({
  endpoint: new AWS.Endpoint(conf.file.so.endpoint),
  region: conf.file.so.region,
  httpOptions: {
    agent: new http.Agent({ rejectUnauthorized: false }),
  },
  credentials: {
    accessKeyId: conf.file.so.access_key,
    secretAccessKey: conf.file.so.secret_key,
  },
});

// ----- common -----
// list , delete, etc
exports.list = function (opt) {
  return new Promise((resolve, reject) => {
    S3.listObjects(opt, (err, data) => {
      if (err) reject(err);
      else {
        const { Contents, NextMarker } = data;
        const ret = {
          bucket: data.Name,
          delimiter: data.Delimiter,
          prefix: data.Prefix,
          max_keys: data.MaxKeys,
          next_marker: NextMarker ? NextMarker : null,
          keys: [],
        };
        logger.debug('S3.listObjects = ', data);

        _.forEach(Contents, (content) => {
          if (content.Key.charAt(content.Key.length - 1) != '/') ret.keys.push(content.Key);
        });
        resolve(ret);
      }
    });
  });
};

exports.list_all = async function (Bucket, ignores, Prefix = undefined) {
  let next_marker = null;
  let keys = [];
  do {
    const ret = await this.list({ Bucket, Marker: next_marker, Prefix });
    keys = _.concat(keys, ret.keys);
    next_marker = ret.next_marker;
    logger.debug('S3.listObjects Next Marker = ', next_marker);
  } while (next_marker);

  if (ignores) return _.differenceWith(keys, ignores, (r, i) => _.includes(r, i));
  else return keys;
};

exports.delete_key = function (Bucket, Key) {
  logger.debug('delete Key : ', Bucket, '/', Key);
  return S3.deleteObject({
    Bucket,
    Key,
  }).promise();
};

exports.clear = async function (Bucket, ignores) {
  const results = await this.list_all(Bucket, ignores);
  for (const Key of results) {
    await this.delete_key(Bucket, Key);
  }

  logger.debug('clear bucket : ', Bucket);
};

exports.copy = function (Bucket, oldKey, newKey) {
  return new Promise((resolve, reject) => {
    S3.copyObject({
      Bucket: Bucket,
      CopySource: `${Bucket}/${oldKey}`,
      Key: newKey,
      ACL: 'public-read',
    })
      .promise()
      .then(() => resolve())
      .catch((e) => reject(error.not_found_world_tmp_file));
  });
};

exports.exists = function (Bucket, Key) {
  return new Promise((resolve, reject) => {
    S3.getObjectAcl({
      Bucket,
      Key,
    })
      .promise()
      .then((data) => {
        resolve(data.Owner);
      })
      .catch((e) => resolve(false));
  });
};
