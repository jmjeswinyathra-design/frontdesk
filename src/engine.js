'use strict';

const ai = require('./ai');
const i18n = require('./i18n');
const availability = require('./availability');

function normalize(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function has(m, phrase) {
  return m.indexOf(phrase) !== -1;
}

const LOCAL = {
  hi: {
    emergency: ['आपातकाल', 'सांस', 'खून', 'दम', 'बेहोश'],
    discount: ['छूट', 'डिस्काउंट', 'सस्ता', 'मुफ्त'],
    medical: ['दर्द', 'दुख', 'सूजन', 'बुखार', 'दवा', 'इलाज'],
    book: ['अपॉइंटमेंट', 'बुक'],
    price: ['कीमत', 'कितने', 'कितना', 'कितनी', 'फीस', 'शुल्क', 'खर्च', 'रेट', 'पैसे'],
    doctor: ['डॉक्टर', 'डाक्टर', 'वैद्य'],
    child: ['बच्चे', 'बच्चों', 'बच्चा', 'बाल'],
    insurance: ['बीमा', 'इंश्योरेंस', 'कैशलेस', 'क्लेम'],
    location: ['कहां', 'कहाँ', 'पता', 'लोकेशन', 'पहुंच', 'पहुँच', 'मैप'],
    parking: ['पार्किंग', 'गाड़ी', 'कार'],
    timing: ['समय', 'कब', 'खुल', 'बंद', 'बजे', 'टाइम', 'ओपन', 'क्लोज'],
  },
  te: {
    emergency: ['అత్యవసర', 'ఊపిరి', 'రక్తం', 'మూర్ఛ', 'గాయం'],
    discount: ['తగ్గింపు', 'డిస్కౌంట్', 'చౌక', 'ఉచిత'],
    medical: ['నొప్పి', 'మండ', 'వాపు', 'జ్వరం', 'మందు', 'చికిత్స'],
    book: ['అపాయింట్మెంట్', 'బుక్'],
    price: ['ధర', 'ఎంత', 'ఖర్చు', 'ఫీజు', 'రేటు', 'డబ్బు'],
    doctor: ['డాక్టర్', 'వైద్య'],
    child: ['పిల్లల', 'పిల్ల', 'బాల'],
    insurance: ['బీమా', 'ఇన్షూరెన్స్', 'క్యాషलेస్', 'క్లెయిమ్'],
    location: ['ఎక్కడ', 'చిరునామా', 'లొకేషన్', 'మ్యాప్'],
    parking: ['పార్కింగ్', 'కారు'],
    timing: ['సమయం', 'ఎప్పుడు', 'తెరుచు', 'మూసివేత', 'గంట', 'టైమ్', 'ఓపెన్'],
  },
};

function detectLanguage(raw, m) {
  if (/[\u0C00-\u0C7F]/.test(raw)) return 'te';
  if (/[\u0900-\u097F]/.test(raw)) return 'hi';
  if (/\b(kya|kaise|kab|kitne|kitna|kitni|hai|hain|namaste|dhanyavad|chahiye|kaun|kon|kahan|samay|khul|baje)\b/.test(m)) return 'hi';
  return 'en';
}

function isEmergency(m) {
  if (has(m, 'cannot breathe') || has(m, "can't breathe") || has(m, 'cant breathe') || has(m, 'can not breathe')) return true;
  if (has(m, 'hard to breathe') || has(m, 'trouble breathing') || has(m, 'difficulty breathing') || has(m, 'stop breathing')) return true;
  const bleedRe = /bleed\w*[^.]{0,24}(a lot|heavily|uncontrollably|nonstop|non-stop|won't stop|wont stop|does not stop|doesnt stop)/;
  if (bleedRe.test(m)) return true;
  if (has(m, 'unconscious') || has(m, 'passed out') || has(m, 'chest pain') || has(m, 'throat closing') || has(m, 'throat is closing')) return true;
  if (has(m, 'struck by') || has(m, 'road accident')) return true;
  return false;
}

function isInjectionOrDiscount(m) {
  if (has(m, 'ignore your rules') || has(m, 'ignore the rules') || has(m, 'ignore all rules') || has(m, 'ignore all instructions')) return true;
  if (/ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|your|system)\s+(instructions|rules|prompts|messages|guidelines)/.test(m)) return true;
  if (/disregard\s+(the\s+)?(rules|instructions|prompts|previous)/.test(m)) return true;
  if (has(m, 'jailbreak') || has(m, 'developer mode') || has(m, 'system prompt') || has(m, 'dev mode')) return true;
  if (/\d+\s*%\s*off/.test(m)) return true;
  if (/\d+\s*percent/.test(m) && has(m, 'off')) return true;
  if (has(m, 'discount') && (has(m, 'give') || has(m, 'get') || has(m, 'want') || has(m, 'can you') || has(m, 'do you') || has(m, 'any') || has(m, 'offer'))) return true;
  if (has(m, '50%') || has(m, '50 %')) return true;
  return false;
}

function isMedical(m) {
  const kws = ['pain', 'hurts', 'hurt', 'ache', 'aching', 'sore', 'swelling', 'swollen', 'bleeding', 'bleed',
    'what should i take', 'what can i take', 'which medicine', 'what medicine', 'tablet', 'tablets',
    'painkiller', 'diagnose', 'diagnosis', 'infection', 'infected', 'fever', 'cavity', 'cavities', 'abscess'];
  if (kws.some((k) => has(m, k))) return true;
  return /\bnumb\b|\bnumbness\b/.test(m);
}

function isTreatmentQuestion(m) {
  return /\b(do you (do|offer|have|provide)|can you (do|offer)|are you able to|do you take)\b/.test(m);
}

function isGreeting(m) {
  return /^(hi|hii|hey|hello|helo|namaste|namaskaram|vanakkam|good morning|good afternoon|good evening|good day|hola|hi there|hey there)[!. ]*$/.test(m);
}

function isThanks(m) {
  return /^(thanks|thank you|thankyou|thank u|thx|thank you so much|thanks a lot|thank you very much|dhanyavad|dhanyavaad|dhanyawad|dhanyavadam)[!. ]*$/.test(m);
}

function isEndChat(m) {
  const s = ' ' + m + ' ';
  const phrases = ['end chat', 'end this chat', 'end the chat', 'end our chat', 'finish chat', 'finish this chat',
    'finish the chat', 'finish our chat', 'finish chatting', 'close chat', 'close this chat', 'close the chat',
    'chat complete', 'complete the chat', 'complete chat', 'chat is complete', 'this chat is done', 'chat over',
    'stop chat', 'stop the chat', 'goodbye', 'good bye', 'good night', 'quit chat', 'exit chat', 'see you',
    'see you soon', 'talk to you later', 'talk later', 'take care', 'best regards', 'nothing else',
    'no more questions', 'that is all', 'thats all', "that's all", 'that is it', 'thats it', "that's it",
    'i am done', 'i am finished', 'we are done', "we're done"];
  if (phrases.some((p) => s.indexOf(' ' + p + ' ') !== -1)) return true;
  if (/\b(not|never|isn't|aren't|aint|am not|is not|are not)\b/.test(s)) return false;
  if (/\b(bye|done|finish|quit|exit)\b/.test(s)) {
    const words = m.split(' ').filter(Boolean);
    if (words.length <= 6) return true;
  }
  return false;
}

function parseTime(raw) {
  const s = ' ' + String(raw).toLowerCase() + ' ';
  let day = null;
  if (/\bday after tomorrow\b/.test(s)) day = 'day after tomorrow';
  else if (/\btomorrow\b/.test(s)) day = 'tomorrow';
  else if (/\btoday\b/.test(s)) day = 'today';
  else {
    const d = s.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (d) day = d[1];
  }
  let time = null;
  const tm = s.match(/\b(\d{1,2})(:(\d{2}))?\s*(am|pm)\b/);
  if (tm) {
    time = tm[1] + (tm[2] || '') + ' ' + tm[4];
  } else {
    const t2 = s.match(/\b(\d{1,2})(:(\d{2}))?\b/);
    if (t2) time = t2[1] + (t2[2] || '');
    else if (/\bmorning\b/.test(s)) time = 'morning';
    else if (/\bafternoon\b/.test(s)) time = 'afternoon';
    else if (/\bevening\b/.test(s)) time = 'evening';
  }
  if (!day && !time) return null;
  if (day && time) return day + ' at ' + time;
  if (day) return day;
  return 'at ' + time;
}

function isBooking(m) {
  const hasVerb = /\b(book|booking|reserve|schedule|slot|appointment)\b/.test(m);
  if (!hasVerb) return false;
  const requesty = /\b(i want|i would like|i'd like|can i|could i|please|book me|get me|need|want|looking to|for me)\b/.test(m);
  const howTo = /\b(how (do|can|to)|what is|tell me about|policy|cancel|reschedule)\b/.test(m);
  if (howTo && !requesty) return false;
  const hasTime = parseTime(m) != null;
  return requesty || hasTime || /^book\b/.test(m);
}

function serviceKeys(svc) {
  const name = normalize(svc.name);
  const keys = new Set();
  if (name) keys.add(name);
  const noParen = name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (noParen) keys.add(noParen);
  const inner = name.match(/\(([^)]*)\)/);
  if (inner) {
    const innerNorm = normalize(inner[1]);
    if (innerNorm.length > 2) keys.add(innerNorm);
  }
  const words = noParen.split(' ').filter(Boolean);
  if (words.length >= 2) keys.add(words.slice(0, 2).join(' '));
  return Array.from(keys).filter((k) => k.length > 2);
}

function findService(m, clinic) {
  return clinic.services.find((s) => serviceKeys(s).some((k) => has(m, k)));
}

function doctorList(clinic) {
  return clinic.doctors.map((d) => d.name + ' - ' + d.role + ' - ' + d.days).join('; ');
}

function priceList(clinic) {
  return clinic.services.map((s) => s.name + ' - ' + s.price).join('; ');
}

function matchTimings(m, clinic) {
  const h = clinic.hours;
  const mentionsTime = ['time', 'timings', 'timing', 'hour', 'hours', 'open', 'opens', 'opening', 'close', 'closes', 'closing', 'when do you', 'what time'].some((w) => has(m, w));
  const hasSun = /\bsundays?\b/.test(m);
  const hasSat = /\bsaturdays?\b/.test(m);
  const weekday = /\b(monday|tuesday|wednesday|thursday|friday)\b/.test(m);
  const weekend = has(m, 'weekend');
  const lunch = has(m, 'lunch') || has(m, 'break');
  const holiday = has(m, 'holiday');
  if (!mentionsTime && !hasSun && !hasSat && !weekday && !weekend && !lunch && !holiday) return null;
  if (holiday) return { intent: 'timing', data: { kind: 'holiday', text: h.public_holidays } };
  if (lunch) return { intent: 'timing', data: { kind: 'lunch', text: h.lunch_break } };
  if (hasSun && !hasSat) return { intent: 'timing', data: { kind: 'sun', text: h.sunday } };
  if (hasSat && !hasSun) return { intent: 'timing', data: { kind: 'sat', text: h.monday_to_saturday } };
  if (hasSat && hasSun) return { intent: 'timing', data: { kind: 'weekend', text: h.monday_to_saturday, sun: h.sunday } };
  if (weekday && !weekend) return { intent: 'timing', data: { kind: 'weekday', text: h.monday_to_saturday } };
  if (weekend) return { intent: 'timing', data: { kind: 'weekend', text: h.monday_to_saturday, sun: h.sunday } };
  return { intent: 'timing', data: { kind: 'all', text: h.monday_to_saturday, sun: h.sunday, lunch: h.lunch_break } };
}

function matchDoctorAvailability(m, clinic) {
  const doc = availability.doctorByName(clinic, m);
  const day = availability.resolveDay(m);
  const dayLabel = day ? day.charAt(0).toUpperCase() + day.slice(1) : null;
  const asks = ['available', 'availability', 'when is', 'when are', 'which day', 'what days', 'working', 'work on', 'off on', 'free on', 'free'].some((w) => has(m, w));
  if (doc && (day || asks)) {
    if (day) {
      const ok = availability.doctorWorksOn(doc, day);
      return ok
        ? { intent: 'doctor_day_yes', data: { doctor: doc.name, day: dayLabel } }
        : { intent: 'doctor_day_no', data: { doctor: doc.name, day: dayLabel, days: doc.days } };
    }
    return { intent: 'doctor_days', data: { doctor: doc.name, days: doc.days } };
  }
  if (!doc && day && asks) {
    const docs = availability.doctorsOn(clinic, day);
    return { intent: 'doctors_on_day', data: { day: dayLabel, doctors: docs.length ? docs.map((d) => d.name).join(', ') : 'none' } };
  }
  return null;
}

function matchDoctors(m, clinic) {
  const docWords = ['doctor', 'doctors', 'dentist', 'dentists', 'specialist', 'specialists', 'who is the', 'who are the'];
  const mentions = docWords.some((w) => has(m, w));
  const childQ = has(m, 'child') || has(m, 'children') || has(m, 'kid') || has(m, 'paediatric') || has(m, 'pediatric');
  const nameHit = clinic.doctors.some((d) => {
    const full = normalize(d.name);
    const last = normalize(d.name.replace(/^dr\.?\s*/i, '').split(' ').pop());
    return has(m, full) || (last.length > 2 && has(m, 'dr ' + last));
  });
  if (!mentions && !nameHit && !childQ) return null;
  if (childQ && !nameHit) {
    const ped = clinic.doctors.find((d) => /paediatric|pediatric|children/i.test(d.role));
    if (ped) return { intent: 'doctor_child', data: { name: ped.name, role: ped.role, days: ped.days } };
  }
  return { intent: 'doctors', data: { list: doctorList(clinic) } };
}

function matchInsurance(m, clinic) {
  const words = ['insurance', 'insure', 'cashless', 'claim', 'claims', 'mediclaim', 'star health', 'niva', 'bupa', 'hdfc', 'coverage', 'reimburse', 'insurer'];
  if (!words.some((w) => has(m, w))) return null;
  return { intent: 'insurance', data: { text: clinic.policies.insurance } };
}

function matchPolicies(m, clinic) {
  const p = clinic.policies;
  const words = ['appointment', 'book', 'booking', 'schedule', 'cancel', 'reschedule', 'walk-in', 'walk in', 'walkins', 'payment', 'pay', 'card', 'upi', 'cash', 'emi', 'installment', 'instalment', 'child', 'children', 'kid', 'first visit', 'first time', 'steril', 'hygiene', 'hygienic', 'x-ray', 'xray'];
  if (!words.some((w) => has(m, w))) return null;
  let txt = '';
  if (has(m, 'cancel') || has(m, 'reschedule')) txt = p.appointments;
  else if (has(m, 'walk')) txt = p.walk_ins;
  else if (has(m, 'emi') || has(m, 'installment') || has(m, 'instalment')) txt = p.emi;
  else if (has(m, 'pay') || has(m, 'card') || has(m, 'upi') || has(m, 'cash')) txt = p.payment;
  else if (has(m, 'steril')) txt = p.sterilisation;
  else if (has(m, 'first')) txt = p.first_visit;
  else if (has(m, 'child') || has(m, 'children') || has(m, 'kid')) txt = p.children;
  else if (has(m, 'appointment') || has(m, 'book') || has(m, 'schedule')) txt = p.appointments;
  else if (has(m, 'x-ray') || has(m, 'xray')) txt = p.first_visit;
  else txt = Object.keys(p).map((k) => k.replace(/_/g, ' ') + ': ' + p[k]).join(' ');
  return { intent: 'policy', data: { text: txt } };
}

function matchLocation(m, clinic) {
  const c = clinic.clinic;
  const park = has(m, 'parking') || has(m, 'park ') || has(m, 'car') || has(m, 'vehicle');
  if (park) return { intent: 'parking', data: { text: c.parking } };
  const words = ['where', 'address', 'location', 'located', 'direction', 'directions', 'how to reach', 'map', 'landmark', 'pincode', 'area'];
  if (!words.some((w) => has(m, w))) return null;
  return { intent: 'location', data: { landmark: c.landmark, address: c.address } };
}

function matchPrices(m, clinic) {
  const priceIntent = ['price', 'prices', 'cost', 'costs', 'fee', 'fees', 'charge', 'charges', 'how much', 'rate', 'rates', 'expensive', 'afford'].some((w) => has(m, w));
  const svc = findService(m, clinic);
  if (svc) return { intent: 'price', data: { name: svc.name, price: svc.price } };
  if (priceIntent) return { intent: 'pricelist', data: { list: priceList(clinic) } };
  return null;
}

function matchServiceList(m, clinic) {
  const words = ['what services', 'which services', 'services do you', 'treatments', 'what do you offer', 'what all do you', 'list your services', 'services offered', 'what treatments', 'services you offer'];
  if (!words.some((w) => has(m, w))) return null;
  return { intent: 'pricelist', data: { list: priceList(clinic) } };
}

function matchClinic(m, clinic) {
  return (
    matchDoctorAvailability(m, clinic) ||
    matchTimings(m, clinic) ||
    matchDoctors(m, clinic) ||
    matchInsurance(m, clinic) ||
    matchPolicies(m, clinic) ||
    matchLocation(m, clinic) ||
    matchPrices(m, clinic) ||
    matchServiceList(m, clinic)
  );
}

function classifyLocal(m, lang, clinic) {
  const K = LOCAL[lang];
  if (!K) return null;
  if (K.emergency.some((k) => has(m, k))) return { intent: 'emergency', data: {} };
  if (K.discount.some((k) => has(m, k))) return { intent: 'blocked', data: {} };
  if (K.medical.some((k) => has(m, k))) return { intent: 'medical', data: {} };
  const svc = findService(m, clinic);
  if (svc) return { intent: 'price', data: { name: svc.name, price: svc.price } };
  if (K.price.some((k) => has(m, k))) return { intent: 'pricelist', data: { list: priceList(clinic) } };
  const ped = clinic.doctors.find((d) => /paediatric|pediatric|children/i.test(d.role));
  if (K.child.some((k) => has(m, k)) && ped) return { intent: 'doctor_child', data: { name: ped.name, role: ped.role, days: ped.days } };
  if (K.doctor.some((k) => has(m, k))) return { intent: 'doctors', data: { list: doctorList(clinic) } };
  if (K.insurance.some((k) => has(m, k))) return { intent: 'insurance', data: { text: clinic.policies.insurance } };
  if (K.location.some((k) => has(m, k))) return { intent: 'location', data: { landmark: clinic.clinic.landmark, address: clinic.clinic.address } };
  if (K.parking.some((k) => has(m, k))) return { intent: 'parking', data: { text: clinic.clinic.parking } };
  if (K.timing.some((k) => has(m, k))) return { intent: 'timing', data: { kind: 'all', text: clinic.hours.monday_to_saturday, sun: clinic.hours.sunday, lunch: clinic.hours.lunch_break } };
  return null;
}

async function respond(message, clinic, opts) {
  const options = opts || {};
  const raw = String(message == null ? '' : message);
  const m = normalize(raw);
  const lang = detectLanguage(raw, m);
  const L = LOCAL[lang];

  if (isEmergency(m) || (L && L.emergency.some((k) => has(m, k)))) {
    return {
      kind: 'emergency', intent: 'emergency', lang: lang,
      reply: i18n.render('emergency', { phone: clinic.clinic.emergency_phone, rules: clinic.emergency_rules }, lang),
      createTicket: { status: 'urgent' },
    };
  }

  if (isInjectionOrDiscount(m) || (L && L.discount.some((k) => has(m, k)))) {
    return { kind: 'blocked', intent: 'blocked', lang: lang, reply: i18n.render('blocked', {}, lang) };
  }

  if (isMedical(m) || (L && L.medical.some((k) => has(m, k)))) {
    return { kind: 'medical', intent: 'medical', lang: lang, reply: i18n.render('medical', {}, lang) };
  }

  if (isGreeting(m)) {
    return { kind: 'chat', intent: 'greeting', lang: lang, reply: i18n.render('greeting', {}, lang) };
  }

  if (isEndChat(m)) {
    return { kind: 'ended', intent: 'ended', lang: lang, reply: i18n.render('ended', {}, lang) };
  }

  if (isThanks(m)) {
    return { kind: 'chat', intent: 'thanks', lang: lang, reply: i18n.render('thanks', {}, lang) };
  }

  const localBooking = L && L.book.some((k) => has(m, k));
  if (isBooking(m) || localBooking) {
    const time = parseTime(raw);
    if (!time) {
      return { kind: 'booking', intent: 'booking_ask', lang: lang, reply: i18n.render('booking_ask', {}, lang) };
    }
    const a = availability.assess(raw, clinic);
    const doctorName = a.requestedDoctor
      ? a.requestedDoctor.name
      : (a.availableDoctors.length ? a.availableDoctors[0].name : null);
    const available = a.open && a.doctorOk !== false;

    let intent = 'booking_done';
    let data = { time: time };
    if (a.requestedDoctor && a.doctorOk === false) {
      intent = 'booking_doctor_unavailable';
      data = { doctor: a.requestedDoctor.name, days: a.requestedDoctor.days, time: time };
    } else if (a.reason === 'sunday') {
      intent = 'booking_sunday';
      data = { time: time };
    } else if (a.reason === 'hours' || a.reason === 'lunch') {
      intent = 'booking_hours';
      data = { time: time };
    } else if (a.requestedDoctor && a.doctorOk) {
      intent = 'booking_doctor_ok';
      data = { doctor: a.requestedDoctor.name, time: time };
    } else if (a.availableDoctors.length) {
      intent = 'booking_available';
      data = { time: time, doctors: a.availableDoctors.map((d) => d.name).join(', ') };
    }

    return {
      kind: 'booking', intent: intent, lang: lang, time: time,
      reply: i18n.render(intent, data, lang),
      createTicket: { status: 'needs human', time: time, type: 'booking', doctor: doctorName, available: available },
    };
  }

  let fact = matchClinic(m, clinic);
  if (!fact && lang !== 'en') fact = classifyLocal(m, lang, clinic);
  if (fact) {
    const renderKey = fact.data && fact.data.kind ? fact.intent + '_' + fact.data.kind : fact.intent;
    return { kind: 'factual', intent: fact.intent, data: fact.data, lang: lang, reply: i18n.render(renderKey, fact.data, lang), label: 'Answered from the clinic file.' };
  }

  if (isTreatmentQuestion(m)) {
    return { kind: 'unknown', intent: 'unknown_treatment', lang: lang, reply: i18n.render('unknown_treatment', {}, lang), createTicket: { status: 'needs human' } };
  }

  const aiEnabled = options.aiEnabled != null ? options.aiEnabled : ai.isEnabled();
  if (aiEnabled) {
    const res = await ai.answerFromClinic(m, clinic, { lang: lang });
    if (res && res.known) {
      return { kind: 'factual', intent: 'ai', lang: lang, reply: res.reply, label: null };
    }
  }

  return { kind: 'unknown', intent: 'unknown', lang: lang, reply: i18n.render('unknown', {}, lang), createTicket: { status: 'needs human' } };
}

module.exports = { respond, normalize, detectLanguage, parseTime, isEndChat, isGreeting, isThanks };