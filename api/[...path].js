'use strict';

const http = require('http');
const { createServer } = require('../server');

const server = createServer();

module.exports = (req, res) => server.emit('request', req, res);