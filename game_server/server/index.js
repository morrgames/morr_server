'use strict';

const http = require('http');
const logger = require('com/log');

module.exports = class Server {
  constructor(port, router, get_router) {
    if (!port) {
      throw new Error('포트 값을 지정해주세요.');
    }

    this.router = router;
    this.port = port;
    this.http = undefined;
    this.get_router = get_router;
  }

  doStart(callback) {
    const self = this;

    const onRequest = (req, res) => {
      const { headers, method, url } = req;
      const client_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;

      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
      });
      req.on('end', () => {
        if (this.get_router && method == 'GET') {
          this.get_router(req, res);
        } else {
          this.router.doRoute(data, res, client_ip);
        }
      });
    };

    const svr = http.createServer(onRequest);
    svr.on('error', (err) => {
      if (err) {
        logger.error(err);
      }
      callback(err);
    });

    svr.on('connection', (socket) => {
      if (socket) {
        socket.setNoDelay();
      }
    });

    svr.listen(this.port, '0.0.0.0', () => {
      logger.info('서버가 시작되었습니다. [port:' + self.port + ']');
      this.http = svr;
      callback(null, this.port);
    });
  }

  doClose() {
    if (this.http) {
      this.http.close();
    }
  }
};
