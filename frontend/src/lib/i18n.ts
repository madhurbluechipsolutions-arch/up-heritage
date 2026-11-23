import type { L10n } from "./types";

/** Languages the companion answers in. UI chrome is English/Hindi; answers come in any of these. */
export const LANGUAGES: { code: string; label: string; speech: string }[] = [
  { code: "hi", label: "हिन्दी", speech: "hi-IN" },
  { code: "en", label: "English", speech: "en-IN" },
  { code: "ur", label: "اردو", speech: "ur-IN" },
  { code: "bn", label: "বাংলা", speech: "bn-IN" },
  { code: "mr", label: "मराठी", speech: "mr-IN" },
  { code: "ta", label: "தமிழ்", speech: "ta-IN" },
  { code: "te", label: "తెలుగు", speech: "te-IN" },
  { code: "gu", label: "ગુજરાતી", speech: "gu-IN" },
  { code: "pa", label: "ਪੰਜਾਬੀ", speech: "pa-IN" },
  { code: "fr", label: "Français", speech: "fr-FR" },
  { code: "es", label: "Español", speech: "es-ES" },
  { code: "de", label: "Deutsch", speech: "de-DE" },
  { code: "ru", label: "Русский", speech: "ru-RU" },
  { code: "ja", label: "日本語", speech: "ja-JP" },
  { code: "zh", label: "中文", speech: "zh-CN" },
  { code: "ko", label: "한국어", speech: "ko-KR" },
];

export const speechLang = (code: string) =>
  LANGUAGES.find((l) => l.code === code)?.speech ?? "en-IN";

/** Pick the best string for a language: exact, then English, then anything. */
export function tr(v: L10n | string | undefined, lang: string): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v[lang] || v.en || Object.values(v).find(Boolean) || "";
}

const STRINGS = {
  appName: { en: "Saathi", hi: "साथी" },
  appTag: { en: "Your heritage companion", hi: "आपका विरासत साथी" },
  chooseCity: { en: "Where are you visiting?", hi: "आप कहाँ घूम रहे हैं?" },
  chooseLang: { en: "Your language", hi: "आपकी भाषा" },
  chooseMode: { en: "How should I explain?", hi: "मैं कैसे समझाऊँ?" },
  start: { en: "Start exploring", hi: "शुरू करें" },
  lite: { en: "Preview", hi: "प्रीव्यू" },
  // tabs
  ask: { en: "Ask", hi: "पूछें" },
  lens: { en: "Camera", hi: "कैमरा" },
  tour: { en: "Tour", hi: "टूर" },
  explore: { en: "Explore", hi: "आस-पास" },
  help: { en: "Help", hi: "मदद" },
  // modes
  mode_standard: { en: "Standard", hi: "सामान्य" },
  mode_kid: { en: "Kids story", hi: "बच्चों की कहानी" },
  mode_quick: { en: "Quick", hi: "झटपट" },
  mode_scholar: { en: "In depth", hi: "विस्तार से" },
  mode_pilgrim: { en: "Pilgrim", hi: "श्रद्धालु" },
  modeHint_standard: { en: "Simple and clear", hi: "आसान और साफ़" },
  modeHint_kid: { en: "Stories for children", hi: "बच्चों के लिए कहानी" },
  modeHint_quick: { en: "For those in a hurry", hi: "जल्दी में हों तो" },
  modeHint_scholar: { en: "History & architecture", hi: "इतिहास और वास्तुकला" },
  modeHint_pilgrim: { en: "Spiritual context", hi: "आध्यात्मिक संदर्भ" },
  // ask
  askPlaceholder: { en: "Ask anything about this place…", hi: "इस जगह के बारे में कुछ भी पूछें…" },
  askIntro: {
    en: "Namaste! Ask me about the history, architecture and stories of this place — by typing, speaking or with the camera.",
    hi: "नमस्ते! इस जगह के इतिहास, वास्तुकला और कहानियों के बारे में पूछिए — लिखकर, बोलकर या कैमरे से।",
  },
  tryAsking: { en: "Try asking", hi: "ऐसे पूछें" },
  listening: { en: "Listening…", hi: "सुन रहा हूँ…" },
  thinking: { en: "Looking it up in verified sources…", hi: "प्रमाणित स्रोतों में देख रहा हूँ…" },
  kind_history: { en: "Recorded history", hi: "दर्ज इतिहास" },
  kind_architecture: { en: "Architecture", hi: "वास्तुकला" },
  kind_folklore: { en: "Folklore", hi: "लोक-कथा" },
  kind_devotional: { en: "Devotional context", hi: "आध्यात्मिक संदर्भ" },
  kind_info: { en: "Visitor info", hi: "जानकारी" },
  kind_unknown: { en: "Not in verified sources", hi: "प्रमाणित स्रोतों में नहीं" },
  folkloreWarn: { en: "A story people tell — not recorded history.", hi: "लोगों में प्रचलित कहानी — दर्ज इतिहास नहीं।" },
  sources: { en: "Sources", hi: "स्रोत" },
  listen: { en: "Listen", hi: "सुनें" },
  stop: { en: "Stop", hi: "रोकें" },
  offlineAnswer: { en: "Offline answer from the downloaded pack", hi: "डाउनलोड किए गए पैक से ऑफ़लाइन जवाब" },
  basicAnswer: { en: "Basic answer (AI not reachable) — straight from the sources", hi: "साधारण जवाब (AI उपलब्ध नहीं) — सीधे स्रोतों से" },
  openOnMap: { en: "Show on map", hi: "मैप पर देखें" },
  startTour: { en: "Start the tour", hi: "टूर शुरू करें" },
  openExplore: { en: "See recommendations", hi: "सुझाव देखें" },
  callHelp: { en: "Emergency help", hi: "आपातकालीन मदद" },
  error: { en: "Something went wrong. Please try again.", hi: "कुछ गड़बड़ हुई। कृपया फिर से कोशिश करें।" },
  errServer: {
    en: "Can't reach the Saathi server. Check your connection, or that the server is running, and try again.",
    hi: "Saathi सर्वर से संपर्क नहीं हो पा रहा। इंटरनेट या सर्वर चालू है या नहीं, जाँचें और फिर कोशिश करें।",
  },
  errBusy: {
    en: "The AI is busy right now. Please wait a minute and try again.",
    hi: "AI अभी व्यस्त है। कृपया एक मिनट रुककर फिर कोशिश करें।",
  },
  errAi: {
    en: "The AI couldn't process this photo. Please try again or use another photo.",
    hi: "AI इस फ़ोटो को प्रोसेस नहीं कर सका। फिर से या दूसरी फ़ोटो से कोशिश करें।",
  },
  errNoAi: {
    en: "Photo recognition is not set up on this server (no AI key).",
    hi: "इस सर्वर पर फ़ोटो पहचान चालू नहीं है (AI key नहीं है)।",
  },
  errTooLarge: {
    en: "This photo is too large. Please use a smaller photo.",
    hi: "यह फ़ोटो बहुत बड़ी है। कृपया छोटी फ़ोटो इस्तेमाल करें।",
  },
  // lens
  lensTitle: { en: "Point your camera and ask", hi: "कैमरा दिखाइए, सवाल पूछिए" },
  lensHint: {
    en: "Take a photo of a gateway, dome, carving or inscription. I'll tell you what it is.",
    hi: "किसी दरवाज़े, गुंबद, नक्काशी या शिलालेख की फ़ोटो लीजिए। मैं बताऊँगा यह क्या है।",
  },
  takePhoto: { en: "Take photo", hi: "फ़ोटो लें" },
  fromGallery: { en: "From gallery", hi: "गैलरी से" },
  recognising: { en: "Recognising…", hi: "पहचान रहा हूँ…" },
  isItOneOf: { en: "Is it one of these?", hi: "क्या यह इनमें से है?" },
  notRecognised: {
    en: "I couldn't match this to a place in my verified list, so I won't guess its history.",
    hi: "यह मेरी प्रमाणित सूची की किसी जगह से मेल नहीं खाया, इसलिए मैं इसका इतिहास अनुमान से नहीं बताऊँगा।",
  },
  iSee: { en: "What I can see", hi: "मुझे क्या दिख रहा है" },
  needsOnline: { en: "Photo recognition needs internet. Use the tour or scan the signboard QR instead.", hi: "फ़ोटो पहचान के लिए इंटरनेट चाहिए। टूर देखें या साइनबोर्ड का QR स्कैन करें।" },
  tryAgain: { en: "Try another photo", hi: "दूसरी फ़ोटो लें" },
  confidence: { en: "match", hi: "मेल" },
  // tour
  tourTitle: { en: "Self-guided audio tour", hi: "ऑडियो टूर" },
  howMuchTime: { en: "How much time do you have?", hi: "आपके पास कितना समय है?" },
  accessibleRoute: { en: "Accessible route (fewer steps)", hi: "सुगम रास्ता (कम सीढ़ियाँ)" },
  stops: { en: "stops", hi: "पड़ाव" },
  min: { en: "min", hi: "मिनट" },
  simulate: { en: "Simulate walk", hi: "वॉक सिमुलेट करें" },
  useGps: { en: "Use my location", hi: "मेरी लोकेशन" },
  stopSim: { en: "Stop", hi: "रोकें" },
  nowAt: { en: "You are here", hi: "आप यहाँ हैं" },
  next: { en: "Next stop", hi: "अगला पड़ाव" },
  prev: { en: "Previous", hi: "पिछला" },
  play: { en: "Play story", hi: "कहानी सुनें" },
  pause: { en: "Pause", hi: "रोकें" },
  arrivedAuto: { en: "Plays automatically when you arrive", hi: "पहुँचने पर अपने आप चलेगा" },
  details: { en: "Details", hi: "विवरण" },
  // explore
  exploreTitle: { en: "Made for you, nearby", hi: "आपके लिए, आस-पास" },
  interests: { en: "Interests", hi: "रुचि" },
  timeLeft: { en: "Time you have", hi: "आपके पास समय" },
  budget: { en: "Budget", hi: "बजट" },
  withWho: { en: "Travelling with", hi: "साथ में" },
  why: { en: "Why for you", hi: "आपके लिए क्यों" },
  timings: { en: "Timings", hi: "समय" },
  entry: { en: "Entry", hi: "प्रवेश" },
  reach: { en: "How to reach", hi: "कैसे पहुँचें" },
  directions: { en: "Directions", hi: "रास्ता" },
  odop: { en: "One District One Product", hi: "एक ज़िला एक उत्पाद" },
  noMatches: { en: "Nothing fits all your choices — showing the closest ones.", hi: "सब पसंद से मेल नहीं खाया — सबसे करीबी सुझाव दिखा रहे हैं।" },
  // help
  sos: { en: "SOS — Emergency", hi: "SOS — आपातकाल" },
  sosHint: { en: "Calls 112 (Police, Fire, Ambulance)", hi: "112 पर कॉल (पुलिस, फ़ायर, एम्बुलेंस)" },
  helplines: { en: "Helplines", hi: "हेल्पलाइन" },
  shareLocation: { en: "Share my location", hi: "मेरी लोकेशन भेजें" },
  nearestFacilities: { en: "Nearest facilities", hi: "सबसे नज़दीकी सुविधाएँ" },
  away: { en: "away", hi: "दूर" },
  walk: { en: "walk", hi: "पैदल" },
  syntheticData: { en: "sample data", hi: "नमूना डेटा" },
  fromSite: { en: "Distances from the main gate (location off)", hi: "दूरी मुख्य द्वार से (लोकेशन बंद)" },
  // settings
  settings: { en: "Settings", hi: "सेटिंग्स" },
  largeText: { en: "Large text", hi: "बड़ा टेक्स्ट" },
  autoRead: { en: "Read answers aloud", hi: "जवाब पढ़कर सुनाएँ" },
  offlinePack: { en: "Offline pack", hi: "ऑफ़लाइन पैक" },
  offlineHint: { en: "Download stories, audio and maps for weak network.", hi: "कमज़ोर नेटवर्क के लिए कहानियाँ, ऑडियो और मैप डाउनलोड करें।" },
  download: { en: "Download", hi: "डाउनलोड" },
  downloaded: { en: "Ready offline", hi: "ऑफ़लाइन तैयार" },
  offline: { en: "Offline", hi: "ऑफ़लाइन" },
  changeCity: { en: "Change destination", hi: "जगह बदलें" },
  close: { en: "Close", hi: "बंद करें" },
  // redesign
  home: { en: "Home", hi: "होम" },
  welcome: { en: "Namaste", hi: "नमस्ते" },
  continue: { en: "Continue", hi: "आगे बढ़ें" },
  back: { en: "Back", hi: "पीछे" },
  stepOf: { en: "Step", hi: "चरण" },
  onbTitle: { en: "Discover Uttar Pradesh, one story at a time", hi: "उत्तर प्रदेश को जानिए, एक-एक कहानी से" },
  onbSub: {
    en: "Verified history, local legends and an audio guide — in your language.",
    hi: "प्रमाणित इतिहास, लोक-कथाएँ और ऑडियो गाइड — आपकी भाषा में।",
  },
  quickScan: { en: "Scan a monument", hi: "स्मारक स्कैन करें" },
  quickTour: { en: "Audio tour", hi: "ऑडियो टूर" },
  quickAsk: { en: "Ask Saathi", hi: "साथी से पूछें" },
  mustSee: { en: "Must-see spots", hi: "ज़रूर देखें" },
  allSpots: { en: "Every corner", hi: "हर कोना" },
  beyond: { en: "Beyond the main site", hi: "आस-पास और भी" },
  seeAll: { en: "See all", hi: "सभी देखें" },
  planVisit: { en: "Plan your visit", hi: "यात्रा की योजना" },
  closedOn: { en: "Closed", hi: "बंद" },
  more: { en: "More", hi: "और" },
  less: { en: "Less", hi: "कम" },
  appearance: { en: "Appearance", hi: "थीम" },
  theme_system: { en: "Auto", hi: "ऑटो" },
  theme_light: { en: "Light", hi: "लाइट" },
  theme_dark: { en: "Dark", hi: "डार्क" },
  accent: { en: "Accent colour", hi: "रंग" },
  accent_sandstone: { en: "Sandstone", hi: "बलुआ पत्थर" },
  accent_peacock: { en: "Peacock", hi: "मोरपंखी" },
  accent_saffron: { en: "Saffron", hi: "केसरिया" },
  accent_neel: { en: "Neel", hi: "नील" },
  personalise: { en: "Personalise", hi: "अपनी पसंद" },
  forYou: { en: "picks for you", hi: "आपके लिए सुझाव" },
  nowPlaying: { en: "Now at stop", hi: "अभी पड़ाव" },
  yourRoute: { en: "Your route", hi: "आपका रास्ता" },
  lensTips: { en: "Works best on", hi: "इन पर सबसे अच्छा" },
  photoBy: { en: "Photo", hi: "फ़ोटो" },
  verified: { en: "Answers from verified sources", hi: "प्रमाणित स्रोतों से जवाब" },
  tapToOpen: { en: "Tap a spot for its full story", hi: "पूरी कहानी के लिए जगह पर टैप करें" },
  emergency: { en: "Emergency", hi: "आपातकाल" },
  dataNote: {
    en: "Content from public sources (ASI, UNESCO, UP Tourism, Wikipedia). Facility points marked 'sample' are synthetic test data.",
    hi: "सामग्री सार्वजनिक स्रोतों (ASI, UNESCO, UP पर्यटन, विकिपीडिया) से। 'नमूना' वाली सुविधाएँ टेस्ट डेटा हैं।",
  },
} satisfies Record<string, L10n>;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, lang: string): string {
  const v: L10n = STRINGS[key];
  return lang === "hi" ? v.hi ?? v.en : v.en;
}
