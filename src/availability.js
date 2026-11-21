'use strict';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function dayFromOffset(offset) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return DAYS[d.getDay()];
}

function resolveDay(raw) {
  const s = String(raw == null ? '' : raw).toLowerCase();
  if (/\bday after tomorrow\b/.test(s)) return dayFromOffset(2);
  if (/\btomorrow\b/.test(s)) return dayFromOffset(1);
  if (/\btoday\b/.test(s)) return dayFromOffset(0);
  for (let i = 0; i < DAYS.length; i++) {
    const full = DAYS[i];
    const abbr = full.slice(0, 3);
    if (new RegExp('\\b' + full + '\\b').test(s)) return full;
    if (new RegExp('\\b' + abbr + '\\b').test(s)) return full;
  }
  return null;
}

function toMinutes(h, ampm, min) {
  let hour = parseInt(h, 10) % 12;
  if (String(ampm).toLowerCase() === 'pm') hour += 12;
  return hour * 60 + (min ? parseInt(min, 10) : 0);
}

function parseTimeMinutes(raw) {
  const s = String(raw == null ? '' : raw).toLowerCase();
  const withMeridiem = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (withMeridiem) return toMinutes(withMeridiem[1], withMeridiem[3], withMeridiem[2]);
  const plain = s.match(/(\d{1,2})(?::(\d{2}))?/);
  if (plain) return parseInt(plain[1], 10) * 60 + (plain[2] ? parseInt(plain[2], 10) : 0);
  return null;
}

function parseRange(text) {
  if (!text) return null;
  const m = String(text).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:to|-|\u2013|\u2014)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!m) return null;
  return { open: toMinutes(m[1], m[3], m[2]), close: toMinutes(m[4], m[6], m[5]) };
}

function hoursForDay(day, hours) {
  const h = hours || {};
  if (day === 'sunday') {
    const r = parseRange(h.sunday);
    return r ? { open: r.open, close: r.close, lunchStart: null, lunchEnd: null } : { open: 600, close: 840, lunchStart: null, lunchEnd: null };
  }
  const r = parseRange(h.monday_to_saturday) || { open: 540, close: 1200 };
  const lunch = parseRange(h.lunch_break);
  return { open: r.open, close: r.close, lunchStart: lunch ? lunch.open : null, lunchEnd: lunch ? lunch.close : null };
}

function doctorWorksOn(doc, day) {
  if (!day) return true;
  const d = String(doc.days || '').toLowerCase();
  if (!d) return true;
  if (d.indexOf('monday to saturday') !== -1 || d.indexOf('monday - saturday') !== -1 ||
      d.indexOf('monday-saturday') !== -1 || d.indexOf('mon to sat') !== -1 || d.indexOf('mon-sat') !== -1) {
    return day !== 'sunday';
  }
  if (d.indexOf('saturday only') !== -1 || d.indexOf('sat only') !== -1) return day === 'saturday';
  if (d.indexOf(day) !== -1) return true;
  const abbr = day.slice(0, 3);
  return new RegExp('\\b' + abbr).test(d);
}

function doctorsOn(clinic, day) {
  if (!day) return clinic.doctors.slice();
  return clinic.doctors.filter((doc) => doctorWorksOn(doc, day));
}

function doctorByName(clinic, lower) {
  const m = String(lower || '').toLowerCase();
  for (let i = 0; i < clinic.doctors.length; i++) {
    const doc = clinic.doctors[i];
    const full = String(doc.name).toLowerCase().replace(/^dr\.?\s*/, '').replace(/\./g, '').trim();
    if (!full) continue;
    if (m.indexOf(full) !== -1) return doc;
    const parts = full.split(/\s+/).filter((p) => p.length > 2);
    for (let j = 0; j < parts.length; j++) {
      if (m.indexOf('dr ' + parts[j]) !== -1 || m.indexOf(parts[j]) !== -1) return doc;
    }
  }
  return null;
}

function assess(raw, clinic) {
  const lower = String(raw == null ? '' : raw).toLowerCase();
  const day = resolveDay(lower);
  const minutes = parseTimeMinutes(lower);
  const requestedDoctor = doctorByName(clinic, lower);

  let open = true;
  let reason = null;
  if (day === 'sunday') {
    open = false;
    reason = 'sunday';
  } else if (day && minutes != null) {
    const h = hoursForDay(day, clinic.hours);
    if (minutes < h.open || minutes >= h.close) {
      open = false;
      reason = 'hours';
    } else if (h.lunchStart != null && minutes >= h.lunchStart && minutes < h.lunchEnd) {
      open = false;
      reason = 'lunch';
    }
  }

  const availableDoctors = day ? doctorsOn(clinic, day) : [];
  let doctorOk = null;
  if (requestedDoctor) doctorOk = doctorWorksOn(requestedDoctor, day);

  return {
    day: day,
    minutes: minutes,
    requestedDoctor: requestedDoctor,
    availableDoctors: availableDoctors,
    open: open,
    reason: reason,
    doctorOk: doctorOk,
  };
}

module.exports = {
  DAYS: DAYS,
  dayFromOffset: dayFromOffset,
  resolveDay: resolveDay,
  parseTimeMinutes: parseTimeMinutes,
  parseRange: parseRange,
  hoursForDay: hoursForDay,
  doctorWorksOn: doctorWorksOn,
  doctorsOn: doctorsOn,
  doctorByName: doctorByName,
  assess: assess,
};