const LANGUAGE_KEY = 'persian-isles-golf:language:v1';

/** Browser globals are deliberately avoided; the caller supplies storage. */
export function readLanguage(storage) {
  try { return storage?.getItem(LANGUAGE_KEY) === 'fa' ? 'fa' : 'en'; } catch { return 'en'; }
}

export function saveLanguage(storage, lang) {
  const chosen = lang === 'fa' ? 'fa' : 'en';
  try { storage?.setItem(LANGUAGE_KEY, chosen); } catch { /* optional persistence */ }
  return chosen;
}

/** English copy is its own key. Pass formatNumber() output for localized digits. */
export function t(lang, key, vars = {}) {
  const template = key === 'Persian' ? 'فارسی' : lang === 'fa' && Object.prototype.hasOwnProperty.call(fa, key) ? fa[key] : key;
  const values = vars && (typeof vars === 'object' || typeof vars === 'function') ? vars : {};
  return String(template).replace(/\{(\w+)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match);
}

export function islandName(lang, id) {
  const names = { hormuz: ['Hormuz', 'هرمز'], qeshm: ['Qeshm', 'قشم'], kish: ['Kish', 'کیش'], khark: ['Khark', 'خارک'], hengam: ['Hengam', 'هنگام'] };
  return names[id]?.[lang === 'fa' ? 1 : 0] ?? id;
}

export function levelName(lang, id) {
  const names = { 1: ['Red Shore', 'ساحل سرخ'], 2: ['Salt Valley', 'دره نمک'], 3: ['Rainbow Run', 'راه رنگین‌کمان'] };
  return names[id]?.[lang === 'fa' ? 1 : 0] ?? String(id);
}

export function formatNumber(lang, value) {
  return new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en', { maximumFractionDigits: 0 }).format(value);
}

const fa = {
  'PERSIAN ISLES GOLF': 'گلف جزیره‌های پارسی',
  'PERSIAN ISLES MINI GOLF': 'مینی‌گلف جزیره‌های پارسی',
  'THE PERSIAN GULF COLLECTION / 01': 'مجموعه خلیج فارس / ۰۱',
  'The colour of the coast.': 'رنگ‌و‌بوی ساحل.',
  'Three dimensional miniature golf course inspired by Hormuz Island': 'زمین سه‌بعدی مینی‌گلف با الهام از جزیره هرمز',
  'Previous island': 'جزیره قبلی', 'Next island': 'جزیره بعدی', 'Choose an island': 'انتخاب جزیره', Language: 'زبان',
  LOCKED: 'قفل است', 'Preparing the island…': 'در حال آماده‌سازی جزیره…', 'Hormuz holes': 'مرحله‌های هرمز',
  'Hormuz Island': 'جزیره هرمز', '{name} Island': 'جزیره {name}', 'FIVE ISLANDS. ONE COAST.': 'پنج جزیره. یک ساحل.',
  'Sound off': 'صدا خاموش', 'Sound on': 'صدا روشن', 'Music on': 'موسیقی روشن', 'About & credits ↗': 'درباره و سازندگان ↗',
  'Enable sound': 'روشن کردن صدا', 'Change camera view': 'تغییر زاویه دید', 'Pause game': 'توقف بازی',
  HOLE: 'مرحله', PAR: 'پار', STROKES: 'ضربه‌ها', BEST: 'بهترین', POWER: 'قدرت', 'Best —': 'بهترین —',
  'Restart ↺': 'شروع دوباره ↺', 'Shot power': 'قدرت ضربه', 'Aim left': 'نشانه‌گیری به چپ', 'Aim right': 'نشانه‌گیری به راست', Putt: 'ضربه', SPACE: 'فاصله',
  'Camera zoom': 'بزرگ‌نمایی دوربین', 'Zoom out': 'کوچک‌نمایی', 'Zoom in': 'بزرگ‌نمایی',
  'Drag back anywhere to aim · release to putt': 'برای نشانه‌گیری هرجا خواستید به عقب بکشید · برای ضربه رها کنید',
  'Arrows: aim & power · right-drag: orbit': 'فلش‌ها: جهت و قدرت · کشیدن با دکمه راست: چرخش دید',
  'ON ISLAND TIME': 'با آرامش جزیره', 'ABOUT THIS SLICE': 'درباره این نسخه', 'A coast of our own.': 'ساحلی از آنِ خودمان.',
  'COASTAL SOUNDS': 'آواهای ساحل', 'A quieter rhythm.': 'آهنگی آرام‌تر.',
  'Preview could not load · Try another island': 'پیش‌نمایش بارگذاری نشد · جزیره دیگری را امتحان کنید', 'Unable to load': 'بارگذاری ناموفق',
  'The island could not load. This game needs a WebGL-capable browser. Try reloading in a modern browser.': 'جزیره بارگذاری نشد. این بازی به مرورگری با پشتیبانی از WebGL نیاز دارد. صفحه را در مرورگری به‌روز دوباره بارگذاری کنید.',
  'The island could not load. This game needs a WebGL-capable browser. Try Chrome or reload the page.': 'جزیره بارگذاری نشد. این بازی به مرورگری با پشتیبانی از WebGL نیاز دارد. کروم را امتحان کنید یا صفحه را دوباره بارگذاری کنید.',
  'THE SCULPTED COAST': 'ساحل تراش‌خورده', 'THE PALE SHORE': 'ساحل سپید', 'THE CORAL PLATEAU': 'فلات مرجانی', 'THE RAINBOW ISLAND': 'جزیره رنگین‌کمان', 'THE QUIET TIDE': 'جزر و مد آرام',
  'Wander between weathered canyon walls and sea-carved arches.': 'میان دیواره‌های فرسوده دره و طاق‌هایی که دریا تراشیده است، گردش کنید.',
  'A sunlit promenade, white piers and palms above a clear lagoon.': 'گردشگاهی آفتابی، اسکله‌های سفید و نخل‌هایی کنار تالابی زلال.',
  'Limestone cliffs, a quiet harbour and a lighthouse facing the gulf.': 'صخره‌های آهکی، بندری آرام و فانوس دریایی رو به خلیج.',
  'Find your line through red earth, salt-white cliffs and turquoise water.': 'مسیرتان را میان خاک سرخ، صخره‌های سفید نمکی و آب فیروزه‌ای پیدا کنید.',
  'A little fishing dhow, rocky coves and dolphins beyond the shore.': 'لنج ماهیگیری کوچک، خلیجک‌های صخره‌ای و دلفین‌هایی دورتر از ساحل.',
  'Find your pace. One clear lane, one gentle finish.': 'ریتم خودتان را پیدا کنید. یک مسیر باز و پایانی آرام.',
  'Read the corner. Take the open line or bank off the salt walls.': 'پیچ مسیر را بسنجید. از راه باز بروید یا توپ را از دیواره‌های نمکی کمانه بدهید.',
  'Choose your line through the long turn and mineral outcrops.': 'مسیرتان را از میان پیچ بلند و برآمدگی‌های معدنی انتخاب کنید.',
  'HOLE IN ONE': 'تک‌ضرب', ALBATROSS: 'آلباتروس', EAGLE: 'ایگل', BIRDIE: 'بردی', BOGEY: 'بوگی', stroke: 'ضربه', strokes: 'ضربه',
  'Your best line: {n} strokes. Try another angle.': 'بهترین امتیازتان: {n} ضربه. زاویه دیگری را امتحان کنید.',
  'Ball & fixed-step physics adapted from {game} by Luiz Vicente (MIT). Three.js (MIT), Rapier (Apache-2.0). Required notices ship with the build.': 'توپ و فیزیک با گام زمانی ثابت، اقتباس‌شده از {game} ساخته Luiz Vicente با مجوز MIT. Three.js با مجوز MIT و Rapier با مجوز Apache-2.0. اطلاعیه‌های الزامی همراه نسخه بازی ارائه می‌شوند.',
  'Ball & fixed-step physics adapted from': 'توپ و فیزیک با گام زمانی ثابت، اقتباس‌شده از',
  'by Luiz Vicente (MIT). Three.js (MIT), Rapier (Apache-2.0). Required notices ship with the build.': 'ساخته Luiz Vicente با مجوز MIT. Three.js با مجوز MIT و Rapier با مجوز Apache-2.0. اطلاعیه‌های الزامی همراه نسخه بازی ارائه می‌شوند.',
  'Nature reference:': 'منبع اطلاعات طبیعی:', 'NASA Earth Observatory, Iran’s Rainbow Island': 'رصدخانه زمین ناسا، جزیره رنگین‌کمانی ایران',
  'Find a better line': 'مسیر بهتری پیدا کنید', 'Play the journey again': 'سفر را دوباره بازی کنید',
  'Red Shore': 'ساحل سرخ', 'Salt Valley': 'دره نمک', 'Rainbow Run': 'راه رنگین‌کمان',
  'RED SHORE': 'ساحل سرخ', 'SALT VALLEY': 'دره نمک', 'RAINBOW RUN': 'راه رنگین‌کمان',
  Hormuz: 'هرمز', Qeshm: 'قشم', Kish: 'کیش', Khark: 'خارک', Hengam: 'هنگام', HORMUZ: 'هرمز',
  'Choose your island': 'جزیره‌تان را انتخاب کنید', 'Play Hormuz journey': 'سفر هرمز را آغاز کنید', 'Practice a hole': 'تمرین یک مرحله',
  '3 open holes · 7 more in development': '۳ مرحله باز · ۷ مرحله دیگر در دست ساخت', 'Preview only': 'فقط پیش‌نمایش', 'In development': 'در دست ساخت',
  'More holes are in development.': 'مرحله‌های بیشتری در دست ساخت هستند.', 'Best {n}': 'بهترین {n}', 'Par {n}': 'معیار {n}', Completed: 'تمام شد',
  'Not played yet': 'هنوز بازی نشده', 'Next hole': 'مرحله بعدی', 'Try again': 'دوباره تلاش کنید', 'Play again': 'دوباره بازی کنید',
  'Journey best: {n}': 'بهترین امتیاز سفر: {n}', 'Full course view': 'نمای کامل زمین', Help: 'راهنما', 'How to play': 'چطور بازی کنیم',
  'Drag back, release to putt.': 'برای ضربه، بکشید و رها کنید.', 'Longer drag, more power.': 'کشیدن طولانی‌تر، قدرت بیشتر.',
  'Scroll or pinch to zoom.': 'برای بزرگ‌نمایی اسکرول کنید یا دو انگشت را جمع و باز کنید.', 'Arrows aim and set power. Space puts.': 'فلش‌ها جهت و قدرت را تنظیم می‌کنند. کلید فاصله ضربه می‌زند.',
  'Start playing': 'شروع بازی', Next: 'بعدی', Back: 'بازگشت', English: 'English', Persian: 'فارسی', 'Your Hormuz postcard.': 'کارت‌پستال شما از هرمز.',
  'strokes · par {n}': 'ضربه · پار {n}', '{n} strokes': '{n} ضربه', 'total strokes · par {n}': 'مجموع ضربه‌ها · پار {n}', 'Hole {n}': 'مرحله {n}',
  Music: 'موسیقی', Effects: 'افکت‌ها', 'View island': 'نمایش جزیره', 'Back to holes': 'بازگشت به مرحله‌ها', 'Coming soon · Preview only': 'به‌زودی · فقط پیش‌نمایش',
  'Playable now · 3 of 10 holes ready': 'اکنون قابل بازی · ۳ مرحله از ۱۰ مرحله آماده است', 'Locked · In development': 'قفل است · در دست ساخت',
  'Find your line through a little world of red earth, salt-white cliffs and turquoise water.': 'مسیرتان را در دنیایی کوچک از خاک سرخ، صخره‌های سفید نمکی و آب فیروزه‌ای پیدا کنید.',
  'Or explore any open hole below. Your best is saved on this device.': 'یا یکی از مرحله‌های باز زیر را امتحان کنید. بهترین امتیازتان روی این دستگاه ذخیره می‌شود.',
  'A miniature inspired by Iran’s rainbow island.': 'مینیاتوری الهام‌گرفته از جزیره رنگین‌کمانی ایران.', 'Playful geography, not a map.': 'برداشتی بازیگوشانه از جغرافیا، نه یک نقشه.',
  'Three holes open now. A playful interpretation, not a map.': 'اکنون سه مرحله باز است. برداشتی بازیگوشانه، نه یک نقشه.', 'A visual preview. Golf on this island is still in development.': 'یک پیش‌نمایش تصویری. گلف در این جزیره هنوز در دست ساخت است.',
  Loading: 'در حال بارگذاری', 'Ready to putt': 'آماده ضربه', Rolling: 'در حال حرکت', 'Holed!': 'وارد حفره شد!', 'Returned to your last shot · +1': 'به محل آخرین ضربه برگشت · +۱',
  'A line to remember.': 'مسیری که به یاد می‌ماند.', 'A new personal best on this coast.': 'بهترین امتیاز شخصی جدیدتان در این ساحل.',
  'Your best line: {n} {strokeWord}. Try another angle.': 'بهترین مسیر شما: {n} {strokeWord}. زاویه دیگری را امتحان کنید.', 'Three shores, one journey. Replay to find a better line.': 'سه ساحل، یک سفر. دوباره بازی کنید تا مسیر بهتری پیدا کنید.',
  'Play the journey again ↗': 'سفر را دوباره بازی کنید ↗', 'See journey results': 'دیدن نتیجه سفر', 'Next open hole': 'مرحله باز بعدی', 'Take a breath.': 'نفسی تازه کنید.',
  'The coast can wait. Your next line is right where you left it.': 'ساحل منتظر می‌ماند. مسیر بعدی‌تان درست همان‌جاست که رهایش کردید.', Resume: 'ادامه', 'Restart hole': 'شروع دوباره مرحله', 'Back to the coast': 'بازگشت به ساحل',
  'HORMUZ / HOLE COMPLETE': 'هرمز / مرحله کامل شد', 'The red, gold and pale layers of Hormuz come from its remarkable geology. This course is a playful interpretation, not a real golf site.': 'لایه‌های سرخ، طلایی و روشن هرمز از زمین‌شناسی شگفت‌انگیز آن پدید آمده‌اند. این زمین برداشتی بازیگوشانه است، نه یک زمین گلف واقعی.',
  'Find a better line ↗': 'مسیر بهتری پیدا کنید ↗', 'A five-island preview with three playable Hormuz holes. The other islands are visible but remain locked while they are being built.': 'پیش‌نمایشی از پنج جزیره با سه مرحله قابل بازی در هرمز. جزیره‌های دیگر دیده می‌شوند اما تا زمان ساخت قفل می‌مانند.',
  'Procedural landscapes, course, interface and synthesized audio created for this project. No models or art were taken from the benchmark game.': 'مناظر رویه‌ای، زمین، رابط کاربری و صدای ترکیبی برای این پروژه ساخته شده‌اند. هیچ مدل یا هنری از بازی معیار برداشته نشده است.',
  'Original, softly synthesized island music. Music and game sounds are optional and saved separately on this device.': 'موسیقی اصیل و آرامِ ترکیبی جزیره. موسیقی و صداهای بازی اختیاری‌اند و جداگانه روی این دستگاه ذخیره می‌شوند.', 'Island music': 'موسیقی جزیره', 'Shot & completion sounds': 'صدای ضربه و پایان',
  'Sound settings': 'تنظیمات صدا', 'Audio is unavailable in this browser. The game still works without it.': 'صدا در این مرورگر در دسترس نیست. بازی بدون صدا هم کار می‌کند.',
};
