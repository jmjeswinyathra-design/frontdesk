'use strict';

const fs = require('fs');
const path = require('path');

const CLINIC_FILE = process.env.CLINIC_FILE ||
  (process.env.VERCEL ? path.join(require('os').tmpdir(), 'fd_clinic.json') : path.join(__dirname, '..', 'data', 'clinic.json'));

let cache = null;

function readSeed() {
  const candidates = [
    path.join(__dirname, '..', 'data', 'clinic.json'),
    path.join(__dirname, 'data', 'clinic.json'),
    path.join(process.cwd(), 'data', 'clinic.json'),
  ];
  for (let i = 0; i < candidates.length; i++) {
    try {
      return JSON.parse(fs.readFileSync(candidates[i], 'utf8'));
    } catch (e) {}
  }
  return null;
}

function loadClinic() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(CLINIC_FILE, 'utf8'));
    return cache;
  } catch (e) {}
  const seed = readSeed();
  if (!seed) throw new Error('clinic file not found');
  cache = seed;
  try {
    fs.mkdirSync(path.dirname(CLINIC_FILE), { recursive: true });
    fs.writeFileSync(CLINIC_FILE, JSON.stringify(seed, null, 2));
  } catch (e2) {}
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