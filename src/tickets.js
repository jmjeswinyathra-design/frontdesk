'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'tickets.json');
const FILE = process.env.TICKETS_FILE || (process.env.VERCEL ? path.join(require('os').tmpdir(), 'fd_tickets.json') : DEFAULT_FILE);

function read() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tickets)) return { tickets: [] };
    return parsed;
  } catch (e) {
    return { tickets: [] };
  }
}

function write(db) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('failed to persist tickets:', e && e.message);
  }
}

let db = read();

function list() {
  return db.tickets;
}

function create(opts) {
  const o = opts || {};
  const ticket = {
    id: crypto.randomUUID(),
    sessionId: o.sessionId || 'anon',
    question: o.question,
    status: o.status || 'needs human',
    type: o.type || null,
    time: o.time || null,
    doctor: o.doctor || null,
    available: o.available == null ? null : o.available,
    createdAt: new Date().toISOString(),
    reply: null,
    repliedAt: null,
  };
  db.tickets.push(ticket);
  write(db);
  return ticket;
}

function addReply(id, reply) {
  const ticket = db.tickets.find((t) => t.id === id);
  if (!ticket) return null;
  ticket.reply = reply;
  ticket.status = 'answered';
  ticket.repliedAt = new Date().toISOString();
  write(db);
  return ticket;
}

function closeTicket(id) {
  const ticket = db.tickets.find((t) => t.id === id);
  if (!ticket) return null;
  ticket.status = 'closed';
  ticket.closedAt = new Date().toISOString();
  write(db);
  return ticket;
}

function forSession(sessionId) {
  return db.tickets.filter((t) => t.sessionId === sessionId);
}

module.exports = { list, create, addReply, closeTicket, forSession, FILE };