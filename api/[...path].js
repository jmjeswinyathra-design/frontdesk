'use strict';

const http = require('http');
const { createServer } = require('../server');

const server = createServer();

module.exports = (req, res) => {
  try {
    server.emit('request', req, res);
  } catch (e) {
    const msg = String((e && (e.stack || e.message)) || e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
    res.end('FrontDesk AI error: ' + msg);
  }
};