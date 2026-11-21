'use strict';

require('./src/env').loadEnv();

const http = require('http');
const fs = require('fs');
const path = require('path');

const { loadClinic, saveClinic } = require('./src/clinic');
const tickets = require('./src/tickets');
const engine = require('./src/engine');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
      const p = u.pathname;

      if (req.method === 'POST' && p === '/api/chat') {
        const body = JSON.parse((await readBody(req)) || '{}');
        const message = String(body.message || '');
        const sessionId = String(body.sessionId || 'anon');
        if (!message.trim()) return sendJSON(res, 400, { error: 'message is required' });
        const clinic = loadClinic();
        const result = await engine.respond(message, clinic);
        let ticket = null;
        if (result.createTicket) {
          ticket = tickets.create({
            sessionId: sessionId,
            question: message,
            status: result.createTicket.status,
            time: result.createTicket.time,
            type: result.createTicket.type,
            doctor: result.createTicket.doctor,
            available: result.createTicket.available,
          });
        }
        let receipt = null;
        if (ticket && result.kind === 'booking') {
          receipt = {
            reference: 'FD-' + ticket.id.replace(/-/g, '').slice(0, 8).toUpperCase(),
            clinic: clinic.clinic.name,
            phone: clinic.clinic.phone,
            address: clinic.clinic.address,
            time: ticket.time,
            doctor: ticket.doctor || null,
            available: ticket.available == null ? null : ticket.available,
            status: ticket.status,
            createdAt: ticket.createdAt,
          };
        }
        let reply = result.reply;
        if (receipt) reply = reply + ' Your booking reference is ' + receipt.reference + '.';
        return sendJSON(res, 200, {
          reply: reply,
          label: result.label || null,
          kind: result.kind,
          intent: result.intent || null,
          ticket: ticket ? { id: ticket.id, status: ticket.status } : null,
          receipt: receipt,
          sessionId: sessionId,
        });
      }

      const replyMatch = p.match(/^\/api\/tickets\/([^/]+)\/reply$/);
      if (req.method === 'POST' && replyMatch) {
        const id = decodeURIComponent(replyMatch[1]);
        const body = JSON.parse((await readBody(req)) || '{}');
        const reply = String(body.reply || '').trim();
        if (!reply) return sendJSON(res, 400, { error: 'reply is required' });
        const ticket = tickets.addReply(id, reply);
        if (!ticket) return sendJSON(res, 404, { error: 'ticket not found' });
        return sendJSON(res, 200, { ticket: ticket });
      }

      const closeMatch = p.match(/^\/api\/tickets\/([^/]+)\/close$/);
      if (req.method === 'POST' && closeMatch) {
        const id = decodeURIComponent(closeMatch[1]);
        const ticket = tickets.closeTicket(id);
        if (!ticket) return sendJSON(res, 404, { error: 'ticket not found' });
        return sendJSON(res, 200, { ticket: ticket });
      }

      const sessionMatch = p.match(/^\/api\/session\/([^/]+)$/);
      if (req.method === 'GET' && sessionMatch) {
        const id = decodeURIComponent(sessionMatch[1]);
        return sendJSON(res, 200, { tickets: tickets.forSession(id) });
      }

      if (req.method === 'GET' && p === '/api/tickets') {
        return sendJSON(res, 200, { tickets: tickets.list() });
      }

      if (req.method === 'GET' && p === '/api/config') {
        const c = loadClinic().clinic;
        return sendJSON(res, 200, {
          name: c.name,
          address: c.address,
          phone: c.phone,
          emergency: c.emergency_phone,
        });
      }

      if (req.method === 'GET' && p === '/api/clinic') {
        return sendJSON(res, 200, loadClinic());
      }

      if (req.method === 'POST' && p === '/api/clinic') {
        const body = JSON.parse((await readBody(req)) || '{}');
        if (!body || !body.clinic || !body.hours || !Array.isArray(body.doctors) || !Array.isArray(body.services) || !body.policies) {
          return sendJSON(res, 400, { error: 'invalid clinic data' });
        }
        saveClinic(body);
        return sendJSON(res, 200, { ok: true });
      }

      if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
        return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
      }

      if (req.method === 'GET' && (p === '/staff' || p === '/staff/')) {
        return serveFile(res, path.join(PUBLIC_DIR, 'staff.html'));
      }

      if (req.method === 'GET') {
        const safe = path.normalize(decodeURIComponent(p)).replace(/^([/\\])+/, '');
        const filePath = path.join(PUBLIC_DIR, safe);
        if (filePath === PUBLIC_DIR || filePath.startsWith(PUBLIC_DIR + path.sep)) {
          return serveFile(res, filePath);
        }
      }

      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    } catch (e) {
      if (!res.headersSent) sendJSON(res, 500, { error: String((e && e.message) || e) });
      else res.end();
    }
  });
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  const server = createServer();
  server.listen(port, () => {
    console.log('FrontDesk AI running at http://localhost:' + port + '  (staff page: /staff)');
  });
}

module.exports = { createServer };