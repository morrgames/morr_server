'use strict';

const fs = require('fs');

const load = (path) => {
  const data = fs.readFileSync(path, 'utf8');
  return JSON.parse(data);
};

const conf = load('config/game.json');
conf.mysql = load('config/mysql.json');
conf.redis = load('config/redis.json');

module.exports = conf;
