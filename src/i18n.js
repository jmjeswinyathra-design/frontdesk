'use strict';

function lowerFirst(s) {
  s = String(s == null ? '' : s);
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

const EN = {
  emergency: (d) => d.phone + ' - please call our emergency number right away. ' + d.rules + " I've also alerted our team and marked this as urgent.",
  blocked: () => "I'm sorry, but I can't offer discounts or change our prices. Our fees are fixed as listed. I'd be happy to share our standard prices or help you book an appointment.",
  medical: () => "I'm sorry you're in discomfort. I can't give medical advice or recommend any treatment. A dentist must see you to examine the problem properly. Would you like me to book an appointment for you?",
  booking_done: (d) => "I've noted your appointment request for " + d.time + ". Our team will confirm the slot shortly.",
  booking_ask: () => "Sure, I can help you book. What day and time would you prefer?",
  booking_doctor_ok: (d) => "I've noted your appointment request for " + d.time + " with " + d.doctor + ". Our team will confirm the slot shortly.",
  booking_doctor_unavailable: (d) => d.doctor + " is not available on that day (available " + d.days + "). I've noted your request for " + d.time + " and our team will suggest the closest slot.",
  booking_sunday: (d) => "On Sundays the clinic is open only for emergencies (10:00 am to 2:00 pm). I've noted your request for " + d.time + "; our team will confirm an alternative from Monday to Saturday.",
  booking_hours: (d) => "Our hours are 9:00 am to 8:00 pm (lunch break 1:30 pm to 2:30 pm). I've noted your request for " + d.time + "; our team will confirm a suitable slot.",
  booking_available: (d) => "I've noted your appointment request for " + d.time + ". Doctors available then: " + d.doctors + ". Our team will confirm the slot shortly.",
  doctor_days: (d) => d.doctor + " is available on " + d.days + ".",
  doctor_day_yes: (d) => d.doctor + " is available on " + d.day + ".",
  doctor_day_no: (d) => d.doctor + " is not available on " + d.day + " (available " + d.days + ").",
  doctors_on_day: (d) => (d.doctors === 'none' ? 'No doctors are scheduled on ' + d.day + '.' : 'Doctors available on ' + d.day + ': ' + d.doctors + '.'),
  timing_holiday: (d) => "On public holidays the clinic is closed - " + lowerFirst(d.text) + ".",
  timing_lunch: (d) => "Lunch break: " + d.text + ".",
  timing_sun: (d) => "On Sunday: " + d.text + ".",
  timing_sat: (d) => "From Monday to Saturday: " + d.text + ".",
  timing_weekday: (d) => "From Monday to Saturday: " + d.text + ".",
  timing_weekend: (d) => "Monday to Saturday: " + d.text + ". Sunday: " + d.sun + ".",
  timing_all: (d) => "Our hours are: Monday to Saturday " + d.text + "; Sunday " + d.sun + ". Lunch break: " + d.lunch + ".",
  doctor_child: (d) => d.name + " sees children (" + d.role + "), available " + d.days + ".",
  doctors: (d) => "Our doctors are: " + d.list + ".",
  insurance: (d) => "We provide " + lowerFirst(d.text),
  policy: (d) => d.text,
  location: (d) => "We are located at " + d.landmark + ", " + d.address + ".",
  parking: (d) => d.text + ".",
  price: (d) => d.name + " costs " + d.price + ".",
  pricelist: (d) => "Our prices are: " + d.list + ".",
  unknown: () => "I'm not sure about that. I've opened a ticket for our team (status: needs human) and someone will call you back within 2 working hours.",
  unknown_treatment: () => "I'm not sure we offer that. I've opened a ticket for our team (status: needs human) and someone will call you back within 2 working hours.",
  thanks: () => "You're welcome! Let me know if you need anything else.",
  ended: () => "Thanks for chatting with us! This conversation is complete. Starting a fresh chat for you...",
  greeting: () => "Hello! I can help with clinic timings, doctors, prices, insurance and location. What would you like to know?"
};

const HI = {
  emergency: (d) => d.phone + " - आपातकाल: कृपया तुरंत कॉल करें। " + d.rules + " मैंने अपनी टीम को सूचित कर दिया है और इसे urgent के रूप में चिह्नित किया है।",
  blocked: () => "क्षमा करें, लेकिन मैं छूट नहीं दे सकता या हमारी कीमतें नहीं बदल सकता। हमारी फीस तय है।",
  medical: () => "आपकी तकलीफ पर खेद है। मैं मेडिकल सलाह या इलाज नहीं दे सकता। जांच के लिए डॉक्टर को आपको देखना चाहिए। क्या मैं आपका अपॉइंटमेंट बुक कर दूं?",
  booking_done: (d) => "मैंने आपका अपॉइंटमेंट " + d.time + " के लिए नोट कर लिया है। हमारी टीम जल्द ही स्लॉट की पुष्टि करेगी।",
  booking_ask: () => "ज़रूर, मैं बुकिंग में मदद कर सकता हूं। आप कौन सा दिन और समय पसंद करेंगे?",
  booking_doctor_ok: (d) => "मैंने आपका अपॉइंटमेंट " + d.time + " के लिए " + d.doctor + " के साथ नोट कर लिया है। हमारी टीम जल्द ही स्लॉट की पुष्टि करेगी।",
  booking_doctor_unavailable: (d) => d.doctor + " उस दिन उपलब्ध नहीं हैं (उपलब्ध: " + d.days + ")। मैंने " + d.time + " के लिए आपका अनुरोध नोट कर लिया है; हमारी टीम नज़दीकी स्लॉट सुझाएगी।",
  booking_sunday: (d) => "रविवार को क्लिनिक केवल आपातकाल के लिए खुला रहता है (10:00 am से 2:00 pm)। मैंने " + d.time + " के लिए आपका अनुरोध नोट कर लिया है; हमारी टीम सोमवार से शनिवार के बीच विकल्प की पुष्टि करेगी।",
  booking_hours: (d) => "हमारे समय 9:00 am से 8:00 pm हैं (लंच ब्रेक 1:30 pm से 2:30 pm)। मैंने " + d.time + " के लिए आपका अनुरोध नोट कर लिया है; हमारी टीम उपयुक्त स्लॉट की पुष्टि करेगी।",
  booking_available: (d) => "मैंने " + d.time + " के लिए आपका अपॉइंटमेंट अनुरोध नोट कर लिया है। उस समय उपलब्ध डॉक्टर: " + d.doctors + "। हमारी टीम जल्द ही स्लॉट की पुष्टि करेगी।",
  doctor_days: (d) => d.doctor + " " + d.days + " को उपलब्ध हैं।",
  doctor_day_yes: (d) => d.doctor + " " + d.day + " को उपलब्ध हैं।",
  doctor_day_no: (d) => d.doctor + " " + d.day + " को उपलब्ध नहीं हैं (उपलब्ध: " + d.days + ")।",
  doctors_on_day: (d) => (d.doctors === 'none' ? d.day + " को किसी भी डॉक्टर का शेड्यूल नहीं है।" : d.day + " को उपलब्ध डॉक्टर: " + d.doctors + "।"),
  timing_holiday: (d) => "सार्वजनिक छुट्टियों में क्लिनिक बंद रहता है - " + lowerFirst(d.text) + "।",
  timing_lunch: (d) => "लंच ब्रेक: " + d.text + "।",
  timing_sun: (d) => "रविवार को: " + d.text + "।",
  timing_sat: (d) => "सोमवार से शनिवार तक: " + d.text + "।",
  timing_weekday: (d) => "सोमवार से शनिवार तक: " + d.text + "।",
  timing_weekend: (d) => "सोमवार से शनिवार: " + d.text + "। रविवार: " + d.sun + "।",
  timing_all: (d) => "हमारे समय: सोमवार से शनिवार " + d.text + "; रविवार " + d.sun + "। लंच ब्रेक: " + d.lunch + "।",
  doctor_child: (d) => d.name + " बच्चों को देखते हैं (" + d.role + "), उपलब्ध " + d.days + "।",
  doctors: (d) => "हमारे डॉक्टर: " + d.list + "।",
  insurance: (d) => "बीमा: " + d.text,
  policy: (d) => "नीति: " + d.text,
  location: (d) => "हम यहां हैं: " + d.landmark + ", " + d.address + "।",
  parking: (d) => d.text + "।",
  price: (d) => d.name + " की कीमत " + d.price + " है।",
  pricelist: (d) => "हमारी कीमतें: " + d.list + "।",
  unknown: () => "मुझे यकीन नहीं है। मैंने अपनी टीम के लिए एक टिकट खोला है (needs human) और कोई 2 घंटे में कॉल करेगा।",
  unknown_treatment: () => "मुझे यकीन नहीं है कि हम यह सेवा देते हैं। मैंने टीम के लिए टिकट खोला है (needs human), कोई 2 घंटे में कॉल करेगा।",
  thanks: () => "आपका धन्यवाद! कुछ और चाहिए तो बताइए।",
  ended: () => "हमसे बात करने के लिए धन्यवाद! यह बातचीत पूरी हो गई है। आपके लिए नई बातचीत शुरू हो रही है...",
  greeting: () => "नमस्ते! मैं क्लिनिक के समय, डॉक्टरों, कीमतों, बीमा और लोकेशन में मदद कर सकता हूं। आप क्या जानना चाहेंगे?"
};

const TEL = {
  emergency: (d) => d.phone + " - దయచేసి వెంటనే మా అత్యవసర నంబర్కు కాల్ చేయండి. " + d.rules + " నేను మా బృందానికి తెలియజేశాను మరియు దీనిని urgent గా గుర్తించాను.",
  blocked: () => "క్షమించండి, నేను తగ్గింపు ఇవ్వలేను లేదా మా ధరలను మార్చలేను. మా ఫీజులు స్థిరంగా ఉన్నాయి.",
  medical: () => "మీ ఇబ్బందికి క్షమించండి. నేను వైద్య సలహా లేదా చికిత్స ఇవ్వలేను. డెంటిస్ట్ మిమ్మల్ని పరీక్షించాలి. నేను మీ కోసం అపాయింట్మెంట్ బుక్ చేయాలా?",
  booking_done: (d) => "మీ అపాయింట్మెంట్ అభ్యర్థన " + d.time + " కోసం నమోదు చేశాను. మా బృందం త్వరలో స్లాట్ను నిర్ధారిస్తుంది.",
  booking_ask: () => "తప్పకుండా, నేను బుకింగ్లో సహాయపడతాను. మీరు ఏ రోజు మరియు సమయం ఇష్టపడతారు?",
  booking_doctor_ok: (d) => "మీ అపాయింట్మెంట్ అభ్యర్థన " + d.time + " కోసం " + d.doctor + " తో నమోదు చేశాను. మా బృందం త్వరలో స్లాట్ను నిర్ధారిస్తుంది.",
  booking_doctor_unavailable: (d) => d.doctor + " ఆ రోజు అందుబాటులో లేరు (అందుబాటు: " + d.days + "). " + d.time + " కోసం మీ అభ్యర్థన నమోదు చేశాను; మా బృందం దగ్గరి స్లాట్ను సూచిస్తుంది.",
  booking_sunday: (d) => "ఆదివారం క్లినిక్ అత్యవసరాల కోసం మాత్రమే (10:00 am – 2:00 pm) తెరిచి ఉంటుంది. " + d.time + " కోసం మీ అభ్యర్థన నమోదు చేశాను; మా బృందం సోమవారం నుండి శనివారం వరకు ప్రత్యామ్నాయాన్ని నిర్ధారిస్తుంది.",
  booking_hours: (d) => "మా సమయాలు 9:00 am – 8:00 pm (లంచ్ బ్రేక్ 1:30 pm – 2:30 pm). " + d.time + " కోసం మీ అభ్యర్థన నమోదు చేశాను; మా బృందం సరిపోయే స్లాట్ను నిర్ధారిస్తుంది.",
  booking_available: (d) => d.time + " కోసం మీ అపాయింట్మెంట్ అభ్యర్థన నమోదు చేశాను. అప్పుడు అందుబాటులో ఉన్న డాక్టర్లు: " + d.doctors + ". మా బృందం త్వరలో స్లాట్ను నిర్ధారిస్తుంది.",
  doctor_days: (d) => d.doctor + " " + d.days + " అందుబాటులో ఉంటారు.",
  doctor_day_yes: (d) => d.doctor + " " + d.day + " అందుబాటులో ఉంటారు.",
  doctor_day_no: (d) => d.doctor + " " + d.day + " అందుబాటులో లేరు (అందుబాటు: " + d.days + ").",
  doctors_on_day: (d) => (d.doctors === 'none' ? d.day + " డాక్టర్లు షెడ్యూల్ చేయబడలేదు." : d.day + " అందుబాటులో ఉన్న డాక్టర్లు: " + d.doctors + "."),
  timing_holiday: (d) => "ప్రజా సెలవుల్లో క్లినిక్ మూసి ఉంటుంది - " + lowerFirst(d.text) + ".",
  timing_lunch: (d) => "లంచ్ బ్రేక్: " + d.text + ".",
  timing_sun: (d) => "ఆదివారం: " + d.text + ".",
  timing_sat: (d) => "సోమవారం నుండి శనివారం వరకు: " + d.text + ".",
  timing_weekday: (d) => "సోమవారం నుండి శనివారం వరకు: " + d.text + ".",
  timing_weekend: (d) => "సోమవారం నుండి శనివారం: " + d.text + " ఆదివారం: " + d.sun + ".",
  timing_all: (d) => "మా సమయాలు: సోమవారం నుండి శనివారం " + d.text + "; ఆదివారం " + d.sun + ". లంచ్ బ్రేక్: " + d.lunch + ".",
  doctor_child: (d) => d.name + " పిల్లలను చూస్తారు (" + d.role + "), అందుబాటులో " + d.days + ".",
  doctors: (d) => "మా డాక్టర్లు: " + d.list + ".",
  insurance: (d) => "బీమా: " + lowerFirst(d.text),
  policy: (d) => "పాలసీ: " + d.text,
  location: (d) => "మేము ఇక్కడ ఉన్నాము: " + d.landmark + ", " + d.address + ".",
  parking: (d) => "పార్కింగ్: " + d.text + ".",
  price: (d) => d.name + " ధర " + d.price + ".",
  pricelist: (d) => "మా ధరలు: " + d.list + ".",
  unknown: () => "నాకు ఖచ్చితంగా తెలియదు. నేను మా బృందం కోసం ఒక టికెట్ తెరిచాను (needs human), ఎవరో 2 పని గంటల్లో కాల్ చేస్తారు.",
  unknown_treatment: () => "మేము ఈ సేవ అందిస్తామా అనేది నాకు ఖచ్చితంగా తెలియదు. నేను బృందం కోసం టికెట్ తెరిచాను (needs human), ఎవరో 2 పని గంటల్లో కాల్ చేస్తారు.",
  thanks: () => "మీ ధన్యవాదాలు! మరింత ఏమైనా కావాలంటే చెప్పండి.",
  ended: () => "మాతో మాట్లాడటం కోసం ధన్యవాదాలు! ఈ సంభాషణ పూర్తయింది. మీ కోసం కొత్త సంభాషణ ప్రారంభమవుతోంది...",
  greeting: () => "నమస్కారం! నేను క్లినిక్ సమయాలు, డాక్టర్లు, ధరలు, బీమా మరియు లొకేషన్లో సహాయపడగలను. మీకు ఏమి తెలుసుకోవాలి?"
};

const LANG = { en: EN, hi: HI, te: TEL };

function render(intent, data, lang) {
  const table = LANG[lang] || EN;
  const fn = table[intent] || EN[intent];
  if (!fn) return '';
  return fn(data || {});
}

module.exports = { render };