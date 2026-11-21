'use strict';

const fs = require('fs');
const path = require('path');

const SEED = require('../data/clinic.json');
const CLINIC_FILE = process.env.CLINIC_FILE ||
  (process.env.VERCEL ? path.join(require('os').tmpdir(), 'fd_clinic.json') : path.join(__dirname, '..', 'data', 'clinic.json'));

let cache = null;

function loadClinic() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(CLINIC_FILE, 'utf8'));
  } catch (e) {
    cache = SEED;
    try {
      fs.mkdirSync(path.dirname(CLINIC_FILE), { recursive: true });
      fs.writeFileSync(CLINIC_FILE, JSON.stringify(SEED, null, 2));
    } catch (e2) {}
  }
  return cache;
}

function saveClinic(obj) {
  fs.mkdirSync(path.dirname(CLINIC_FILE), { recursive: true });
  fs.writeFileSync(CLINIC_FILE, JSON.stringify(obj, null, 2));
  cache = obj;
  return obj;
}

function reloadClinic() {
  cache = null;
  return loadClinic();
}

module.exports = { loadClinic, saveClinic, reloadClinic, CLINIC_FILE };