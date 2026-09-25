/* Casandra's Coach: a gentle, adaptive beginner workout app.
   Static single-page app. All data lives in this browser's localStorage under "casandraCoach.". */
(function () {
  "use strict";

  // ——— Storage keys (separate namespace so nothing collides with any other app) ———
  const NS = "casandraCoach.";
  const KEYS = {
    week: NS + "week.v1",
    profile: NS + "profile.v1",
    levels: NS + "levels.v1",
    history: NS + "history.v1",
    records: NS + "records.v1",
  };

  // Week 1 starts Monday Sep 28, 2026. Weeks run Monday to Sunday.
  // Anything before that is a relaxed "head start" week where nothing is required.
  const WEEK1_MONDAY = new Date(2026, 8, 28);
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // ——— Date helpers ———
  function nowDate() {
    // Optional ?today=YYYY-MM-DD for trying the app on another date.
    try {
      const q = new URLSearchParams(location.search).get("today");
      if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) {
        const p = q.split("-").map(Number);
        const n = new Date();
        return new Date(p[0], p[1] - 1, p[2], n.getHours(), n.getMinutes(), n.getSeconds());
      }
    } catch (e) { /* ignore */ }
    return new Date();
  }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { const x = startOfDay(d); x.setDate(x.getDate() + n); return x; }
  function mondayOf(d) { const s = startOfDay(d); const dow = (s.getDay() + 6) % 7; return addDays(s, -dow); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function dateKey(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }
  function programWeek(d) { return Math.floor(daysBetween(WEEK1_MONDAY, mondayOf(d)) / 7) + 1; }
  function shortDate(d) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function longDate(d) { return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }); }
  function keyToDate(k) { const p = k.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }

  function weekInfo() {
    const now = nowDate();
    const monday = mondayOf(now);
    const num = programWeek(now);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      days.push({ idx: i, key: dateKey(d), date: d, name: DAY_NAMES[i] });
    }
    const todayIdx = (startOfDay(now).getDay() + 6) % 7;
    return {
      now: now, monday: monday, num: num, headStart: num < 1,
      id: "week-" + dateKey(monday), days: days, todayIdx: todayIdx, todayKey: dateKey(now),
    };
  }

  // ——— Generic storage ———
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback();
      return JSON.parse(raw);
    } catch (e) { return fallback(); }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage full or blocked */ }
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ——— Profile ———
  const EQUIPMENT = [
    { id: "treadmill", label: "Treadmill (incline up to 15%)", def: true },
    { id: "rack", label: "Power rack with barbell and plates", def: true },
    { id: "bench", label: "Adjustable bench", def: true },
    { id: "pullupBar", label: "Pull-up bar", def: true },
    { id: "dumbbells25", label: "Dumbbells from 25 lb and up", def: true },
    { id: "curlBar", label: "Curl bar", def: true },
    { id: "backExtBench", label: "Back-extension and hamstring bench", def: true },
    { id: "lightDumbbells", label: "Light dumbbells (5 to 15 lb)", def: false },
    { id: "bands", label: "Resistance bands", def: false },
    { id: "backpack", label: "A backpack for hikes", def: true },
  ];
  function defaultProfile() {
    const eq = {};
    EQUIPMENT.forEach(function (e) { eq[e.id] = e.def; });
    return { name: "Casandra", age: 37, trainingDays: 3, equipment: eq, bowType: "Compound", bowWeight: 35 };
  }
  let profile = Object.assign(defaultProfile(), load(KEYS.profile, defaultProfile));
  profile.equipment = Object.assign(defaultProfile().equipment, profile.equipment || {});
  function saveProfile() { save(KEYS.profile, profile); }
  function eq(id) { return !!profile.equipment[id]; }

  // ——— Levels (one per path) ———
  const PILLARS = {
    run: { name: "Running", max: 27 },
    strength: { name: "General strength", max: 12 },
    hike: { name: "Hiking", max: 17 },
    bow: { name: "Bow strength (back and shoulders)", max: 12 },
  };
  function defaultLevels() {
    return {
      run: { level: 1, justRight: 0 },
      strength: { level: 1, justRight: 0 },
      hike: { level: 1, justRight: 0 },
      bow: { level: 1, justRight: 0 },
    };
  }
  let levels = Object.assign(defaultLevels(), load(KEYS.levels, defaultLevels));
  function saveLevels() { save(KEYS.levels, levels); }
  function lvl(p) { return Math.max(1, Math.min(PILLARS[p].max, (levels[p] && levels[p].level) || 1)); }

  // ——— History and records ———
  let history = load(KEYS.history, function () { return []; });
  function saveHistory() { save(KEYS.history, history); }
  let records = load(KEYS.records, function () { return {}; });
  function saveRecords() { save(KEYS.records, records); }

  const METRICS = [
    { id: "jog", label: "Longest continuous jog", unit: "min", hint: "Minutes of easy jogging without a walk break." },
    { id: "hike", label: "Longest walk or hike", unit: "min", hint: "Minutes on your feet in one walk or hike." },
    { id: "pack", label: "Heaviest pack on a hike", unit: "lb", hint: "Pounds in your backpack for a whole walk or hike." },
    { id: "hang", label: "Dead hang", unit: "sec", hint: "Seconds hanging from the pull-up bar with your feet off the ground." },
    { id: "invrow_high", label: "Inverted rows, bar at chest height", unit: "reps", hint: "Most good reps in one set." },
    { id: "invrow_mid", label: "Inverted rows, bar at waist height", unit: "reps", hint: "Most good reps in one set." },
    { id: "invrow_low", label: "Inverted rows, bar at hip height or lower", unit: "reps", hint: "Most good reps in one set." },
    { id: "bbrow", label: "Bent-over row (8 or more reps)", unit: "lb", hint: "Total weight: bar plus plates, or the dumbbell." },
    { id: "ytw", label: "Y-T-W raises", unit: "reps", hint: "Smooth reps for each letter." },
    { id: "plank", label: "Plank hold", unit: "sec", hint: "Seconds holding a plank with good form (note if it was on your knees)." },
    { id: "sideplank", label: "Side plank hold", unit: "sec", hint: "Seconds on each side with good form." },
  ];
  function metric(id) { return METRICS.find(function (m) { return m.id === id; }); }
  function metricEntries(id) { return (records[id] || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts; }); }
  function best(id) {
    const e = records[id] || [];
    let b = 0;
    e.forEach(function (x) { if (Number(x.value) > b) b = Number(x.value); });
    return b;
  }
  function fmtVal(id, v) {
    const m = metric(id);
    if (!m) return String(v);
    const n = Math.round(Number(v) * 10) / 10;
    if (m.unit === "min") return n + (n === 1 ? " minute" : " minutes");
    if (m.unit === "sec") return n + (n === 1 ? " second" : " seconds");
    if (m.unit === "lb") return n + " lb";
    return n + (n === 1 ? " rep" : " reps");
  }
  function addRecord(id, value, dateStr, note, source) {
    const entry = { id: uid(), date: dateStr, value: Number(value), note: note || "", source: source || "manual", ts: Date.now() };
    if (!records[id]) records[id] = [];
    records[id].push(entry);
    saveRecords();
    return entry;
  }

  // ——— Week state ———
  function defaultWeek() {
    return { weekId: weekInfo().id, completed: {}, activeSession: null, checkinDone: false };
  }
  let week = load(KEYS.week, defaultWeek);
  if (!week || week.weekId !== weekInfo().id) {
    // New calendar week: keep an unfinished session only if it was started today (e.g. just after midnight Sunday it resets cleanly).
    const carry = week && week.activeSession && week.activeSession.dayKey === weekInfo().todayKey ? week.activeSession : null;
    week = defaultWeek();
    week.activeSession = carry;
  }
  week = Object.assign(defaultWeek(), week);
  function saveWeek() { save(KEYS.week, week); }
  saveWeek();

  // ——— Exercise library: plain-English cues ———
  // log: "reps" (count reps), "weight" (weight + reps), "hold" (seconds), "carry" (weight + seconds), "check" (just tick it off)
  const EX = {
    // Legs and hips
    boxSquat: { name: "Box squat to the bench", log: "reps", bw: true,
      how: "Stand in front of the bench (or a sturdy box) that's about knee height or a little higher, feet hip-width apart. Sit back and down until you lightly touch the seat, then stand up tall by pushing the floor away. Your thighs should stay level with the floor or higher at the bottom.",
      feel: "Thighs and bottom working, and your hips feeling comfortable the whole way. A pinch in the front of the hip means the box is too low today.",
      easier: "Make the seat higher by stacking a firm cushion or folded mat on the bench, or hold the rack upright lightly for balance." },
    boxSquatSlow: { name: "Box squat with a slow lower", log: "reps", bw: true,
      how: "Same box at knee height or a little higher. Take 3 slow seconds to lower yourself until you lightly touch the seat, then stand up tall at a normal speed.",
      feel: "The slow lowering makes your legs work harder without going any deeper. Hips stay comfortable.",
      easier: "Lower at a normal speed, or raise the box." },
    boxSquatDB: { name: "Box squat holding one 25 lb dumbbell at your chest", log: "weight",
      how: "Hold one end of a dumbbell against your chest with both hands. Sit back to the bench or box (knee height or a little higher), lightly touch it, then stand up tall. Keep the same box height; add reps before anything else.",
      feel: "Legs and bottom working for the last 2 or 3 reps, hips comfortable. Your thighs never go below level with the floor.",
      easier: "Put the dumbbell down and do the box squat with your body weight." },
    boxSquatLight: { name: "Box squat holding a light dumbbell", log: "weight",
      how: "Hold one light dumbbell at your chest. Sit back to the bench or box (knee height or a little higher), lightly touch it, and stand tall.",
      feel: "A little harder than bodyweight, hips comfortable.",
      easier: "Do the box squat with no weight." },
    gluteBridge: { name: "Glute bridge", log: "reps", bw: true,
      how: "Lie on your back with your knees bent and feet flat. Squeeze your bottom and lift your hips until your body makes a straight line from knees to shoulders. Pause for a second, then lower slowly.",
      feel: "The squeeze is in your bottom, not your lower back.",
      easier: "Lift your hips only halfway." },
    singleLegBridge: { name: "Single-leg glute bridge", log: "reps", bw: true,
      how: "Lie on your back with knees bent and feet flat. Straighten one leg out in line with the other thigh (or just lift that foot an inch off the floor). Push through the planted foot to lift your hips, pause, and lower slowly. Do all reps on one side, then switch.",
      feel: "The bottom of the working side doing the job, hips level, nothing pinching.",
      easier: "Keep both feet down and just put more weight through one foot." },
    clamshell: { name: "Side-lying clamshell", log: "reps", bw: true,
      how: "Lie on your side with your hips and knees gently bent and your heels together, head resting on your arm. Keeping your feet touching, lift your top knee a few inches like a clamshell opening, then lower slowly. Don't let your top hip roll backward.",
      feel: "A warm, working feeling in the side of your bottom (the muscles that keep hips steady when you run and hike).",
      easier: "Open only a little way, or do fewer reps." },
    sideHipRaise: { name: "Side-lying hip raise (leg lift)", log: "reps", bw: true,
      how: "Lie on your side with the bottom knee bent for balance and the top leg straight, in line with your body. With your toes pointing forward, lift the top leg about a foot, pause, and lower slowly. Keep your hips stacked; don't roll back.",
      feel: "The side of your hip and bottom working, not the front of your hip.",
      easier: "Lift it a smaller distance." },
    hipHike: { name: "Standing hip hike on a step", log: "reps", bw: true,
      how: "Stand sideways on the bottom stair or a low step with one foot on it and the other foot hanging just off the edge, holding the rack or a railing. Keeping both knees straight, let the hanging foot drop an inch or two, then lift it back up by hiking that hip. Do all reps on one side, then switch.",
      feel: "The side of the hip on the standing leg working. It's a small movement.",
      easier: "Do it standing on flat ground, just lifting one foot slightly by hiking the hip." },
    hipHinge: { name: "Hip hinge practice", log: "reps", bw: true,
      how: "Stand tall with hands on your hips and a soft bend in your knees. Push your hips back like closing a car door with your bottom, letting your chest tip forward with a flat back, then stand up by squeezing your bottom.",
      feel: "A gentle stretch in the back of your thighs. Your back stays flat, not rounded.",
      easier: "Stand a few inches in front of a wall and reach your hips back to touch it." },
    rdlCurl: { name: "Romanian deadlift with the curl bar", log: "weight", weightLabel: "Total lb",
      how: "Hold the curl bar in front of your thighs. With soft knees and a flat back, slide the bar down your legs by pushing your hips back, only as far as feels comfortable (usually to around your knees), then stand up tall by squeezing your bottom.",
      feel: "A stretch in the back of your thighs on the way down. Your lower back should feel steady, not strained.",
      easier: "Use just the empty curl bar and a smaller range, stopping at your knees." },
    rdlDumbbell: { name: "Romanian deadlift holding one 25 lb dumbbell", log: "weight",
      how: "Hold one dumbbell by the handle with both hands in front of your thighs. Push your hips back with a flat back until you feel a stretch in the back of your thighs, then stand tall.",
      feel: "Hamstring stretch on the way down, bottom squeezing on the way up.",
      easier: "Do hip hinge practice with no weight." },
    rdlBarbell: { name: "Romanian deadlift with the barbell", log: "weight", weightLabel: "Total lb",
      how: "Take the barbell from the rack at hip height. Soft knees, flat back, push your hips back and slide the bar down your thighs to just below your knees, then stand up tall.",
      feel: "Hamstrings and bottom working, back steady. The last 2 reps are work but not a struggle.",
      easier: "Go back to the curl bar. An empty barbell is usually 45 lb (some are 35 lb), which is a big jump." },
    stepUpLow: { name: "Step-up onto a low step (6 to 8 inches)", log: "reps", bw: true,
      how: "Use the bottom stair or a sturdy step about 6 to 8 inches high. Step up with one foot, press through that whole foot to stand tall, then step back down slowly. Do all reps on one leg, then switch.",
      feel: "The front leg does the work. This builds your hiking legs.",
      easier: "Hold a railing or the rack for balance." },
    stepUpHigh: { name: "Step-up onto a slightly higher step (about 10 inches)", log: "reps", bw: true,
      how: "Use a sturdy step about 10 inches high (two stairs is often too high; a sturdy box or a stack of firm mats works). Press through the front foot to stand all the way up, then lower yourself slowly. Never use a step so high that your hip pinches.",
      feel: "Front thigh and bottom working, hip comfortable. Slow on the way down is where the hiking strength comes from.",
      easier: "Go back to the low step." },
    stepUpDB: { name: "Step-up holding one 25 lb dumbbell", log: "weight",
      how: "Hold a dumbbell at your side, or at your chest with both hands. Step up onto a sturdy low step (about 8 inches), stand tall, then step down slowly. Add weight before adding height.",
      feel: "Like hiking uphill with a pack. Legs work, balance stays steady.",
      easier: "Do the same step-up with no weight." },
    splitSquat: { name: "Short-range split squat, hand on the rack", log: "reps", bw: true,
      how: "Stand in a long stride, one foot forward and one back, with one hand on the rack upright. Bend both knees to lower straight down only a few inches, then push back up. Do all reps on one side, then switch.",
      feel: "Front thigh and bottom working, hips comfortable. Depth isn't the goal; control is.",
      easier: "Lower only an inch or two, or shorten your stride." },
    reverseLunge: { name: "Reverse lunge, hand on the rack", log: "reps", bw: true,
      how: "Stand tall with one hand on the rack. Step one foot back and bend both knees to lower a comfortable distance (not all the way to the floor), then push through the front foot to come back to standing. Do all reps on one side, then switch.",
      feel: "Front leg working, balance steady, hips comfortable.",
      easier: "Go back to the short-range split squat." },
    calfRaise: { name: "Calf raise", log: "reps", bw: true,
      how: "Stand tall holding the rack or a wall. Rise up onto the balls of your feet, pause for a second, then lower slowly.",
      feel: "A burn in your calves toward the end of the set. Great for running and hiking.",
      easier: "Do fewer reps, or go only halfway up." },
    backExt: { name: "Back extension on the back-extension bench", log: "reps", bw: true,
      how: "Set the pad just below your hip bones. Cross your arms on your chest, lower your upper body a comfortable distance, then rise until your body is straight. Stop at straight; don't lean back past it.",
      feel: "Your bottom, hamstrings and lower back working together, smooth and controlled.",
      easier: "Use a smaller range, or do bird dogs on the floor." },
    hamLower: { name: "Assisted hamstring lower on the hamstring bench", log: "reps", bw: true,
      how: "Kneel on the pad with your ankles locked in. Keeping your body straight from knees to head, lean forward slowly only as far as you control, then use your hands on the pad or floor to push yourself back up.",
      feel: "Strong work in the back of your thighs. Tiny range is completely fine.",
      easier: "Lean forward only a few inches, or skip it and do glute bridges." },

    // Pushing
    wallPushup: { name: "Wall push-up", log: "reps", bw: true,
      how: "Stand an arm's length from a wall with your hands on it at shoulder height. Keep your body straight like a plank, bend your elbows to bring your chest toward the wall, then push away.",
      feel: "Chest, shoulders and arms working gently.",
      easier: "Stand a little closer to the wall." },
    inclinePushupHigh: { name: "Incline push-up, hands on the bench", log: "reps", bw: true,
      how: "Put your hands on the edge of the bench (or the rack bar set at hip height). Walk your feet back so your body is straight from head to heels. Lower your chest toward your hands, then push away.",
      feel: "Chest and arms working, stomach tight so your hips don't sag.",
      easier: "Go back to wall push-ups." },
    inclinePushupLow: { name: "Incline push-up, hands on the rack bar at knee height", log: "reps", bw: true,
      how: "Set the bar in the rack around knee height. Hands on the bar, body straight, lower your chest to the bar and push back up.",
      feel: "Harder than the bench version. Stop each set with a couple of reps left in the tank.",
      easier: "Raise the bar back up a notch or two." },
    kneePushup: { name: "Knee push-up", log: "reps", bw: true,
      how: "Hands on the floor under your shoulders, knees down, body straight from knees to head. Lower your chest toward the floor and press back up.",
      feel: "Chest and arms working, stomach tight.",
      easier: "Go back to incline push-ups on the rack bar." },
    pushup: { name: "Push-up", log: "reps", bw: true,
      how: "Hands under your shoulders, body straight from head to heels. Lower your chest toward the floor and press back up.",
      feel: "Hard work for the last rep or two. If form slips, finish the set on your knees.",
      easier: "Do knee push-ups." },
    pressCurl: { name: "Overhead press with the curl bar", log: "weight", weightLabel: "Total lb",
      how: "Stand tall holding the curl bar at your shoulders. Squeeze your bottom and stomach, press the bar straight up until your arms are straight, then lower it back to your shoulders.",
      feel: "Shoulders and arms working. Your back doesn't arch.",
      easier: "Press while seated on the bench, or do fewer reps." },
    pressLight: { name: "Dumbbell shoulder press with light dumbbells", log: "weight",
      how: "Sit or stand tall with a light dumbbell at each shoulder. Press straight up until your arms are straight, then lower slowly.",
      feel: "Shoulders working, back not arching.",
      easier: "Use lighter dumbbells or do one arm at a time." },
    lateralRaise: { name: "Lateral raise with light dumbbells", log: "weight",
      how: "Stand tall with a light dumbbell in each hand. With a slight bend in your elbows, raise your arms out to the sides to shoulder height, then lower slowly.",
      feel: "The tops of your shoulders working. Keep your shoulders away from your ears.",
      easier: "Use lighter weights or raise only halfway." },

    // Core
    deadBug: { name: "Dead bug", log: "reps", bw: true,
      how: "Lie on your back with arms reaching to the ceiling and knees bent above your hips. Press your lower back gently into the floor. Slowly reach one arm back and the opposite leg out, then return and switch.",
      feel: "Your stomach working to keep your lower back from lifting.",
      easier: "Move only your legs, one at a time, keeping arms still." },
    birdDog: { name: "Bird dog", log: "reps", bw: true,
      how: "On hands and knees, reach one arm forward and the opposite leg back until they're level with your body. Pause for 2 seconds, then return and switch sides.",
      feel: "Steady and balanced, with your back flat like a table.",
      easier: "Move just an arm or just a leg." },
    plankKnees: { name: "Plank on your knees", log: "hold", bw: true,
      how: "Forearms on the floor, elbows under your shoulders, knees down. Make a straight line from knees to head and gently tighten your stomach.",
      feel: "Stomach working, breathing steady. No sagging in the lower back.",
      easier: "Hold for a shorter time." },
    plank: { name: "Plank", log: "hold", bw: true,
      how: "Forearms on the floor, elbows under your shoulders, legs straight. Make a straight line from heels to head, squeeze your bottom and tighten your stomach.",
      feel: "Your whole middle working. Stop before your hips sag.",
      easier: "Drop to your knees." },
    sidePlankKnees: { name: "Side plank on your knees", log: "hold", bw: true,
      how: "Lie on your side with your elbow under your shoulder and knees bent. Lift your hips so you're in a straight line from knees to head.",
      feel: "The side of your stomach and your shoulder working.",
      easier: "Hold for a shorter time." },
    sidePlank: { name: "Side plank", log: "hold", bw: true,
      how: "Lie on your side with your elbow under your shoulder and legs straight, feet stacked or staggered. Lift your hips into a straight line.",
      feel: "The side of your middle working, and your shoulder steady.",
      easier: "Bend your knees and do it from your knees." },
    suitcaseCarry: { name: "Suitcase carry with one 25 lb dumbbell", log: "carry",
      how: "Hold one dumbbell at your side like a suitcase. Stand tall without leaning and walk slowly around the room. Switch hands halfway.",
      feel: "Your grip, shoulders and the side of your middle working to keep you straight.",
      easier: "Walk for a shorter time." },
    farmerCarry: { name: "Farmer carry with two 25 lb dumbbells", log: "carry", weightLabel: "Lb per hand",
      how: "Hold a dumbbell in each hand at your sides. Stand tall, shoulders back and down, and walk slowly with short steps.",
      feel: "Grip and upper back working. Great for hiking with a pack and for holding the bow steady.",
      easier: "Carry just one dumbbell and switch hands halfway." },
    carryBackpack: { name: "Backpack or water-jug carry", log: "carry", weightLabel: "Lb",
      how: "Hold a filled water jug or a loaded backpack by the handle at your side. Stand tall and walk slowly, switching hands halfway.",
      feel: "Grip and the side of your middle working.",
      easier: "Use less weight or walk for less time." },

    // Back and shoulders (bow strength)
    scapSqueeze: { name: "Shoulder blade squeeze", log: "reps", bw: true,
      how: "Stand tall with arms at your sides. Gently squeeze your shoulder blades back and down, as if tucking them into your back pockets. Hold for 3 seconds, then relax.",
      feel: "The muscles between your shoulder blades waking up. No shrugging.",
      easier: "Hold for just 1 second." },
    wallSlide: { name: "Wall slide", log: "reps", bw: true,
      how: "Stand with your back against a wall, arms bent like goalposts with the backs of your hands near the wall. Slowly slide your arms up as far as comfortable, then back down.",
      feel: "A gentle stretch and wake-up for your shoulders and upper back.",
      easier: "Step your feet a little away from the wall and slide only partway." },
    invRowHigh: { name: "Inverted row in the rack, bar at chest height", log: "reps", bw: true, record: "invrow_high",
      how: "Set the barbell in the rack at about chest height. Hold it with hands shoulder-width apart, walk your feet slightly forward and lean back with straight arms and a straight body. Pull your chest to the bar by squeezing your shoulder blades together, then lower slowly.",
      feel: "Your upper back and the backs of your shoulders working, the exact muscles that draw a bow.",
      easier: "Walk your feet back so you're more upright." },
    invRowMid: { name: "Inverted row in the rack, bar at waist height", log: "reps", bw: true, record: "invrow_mid",
      how: "Set the barbell at about waist height. Lean back with straight arms and a straight body, heels on the floor. Pull your chest to the bar, squeeze your shoulder blades, then lower slowly.",
      feel: "Harder than the chest-height version. Slow and controlled beats fast.",
      easier: "Move the bar up a notch or walk your feet back." },
    invRowLow: { name: "Inverted row in the rack, bar at hip height", log: "reps", bw: true, record: "invrow_low",
      how: "Set the barbell at about hip height. Lean back until your body is at a low angle with straight arms. Pull your chest to the bar, pause for a second, then lower slowly.",
      feel: "Real upper-back work. This is the kind of pulling strength a bow draw needs.",
      easier: "Raise the bar back to waist height." },
    oneArmRow25: { name: "One-arm dumbbell row with a 25 lb dumbbell", log: "weight", record: "bbrow",
      how: "Put one knee and one hand on the bench, back flat. Let the dumbbell hang, then pull it toward your hip by driving your elbow back. Lower slowly. Do all reps on one side, then switch.",
      feel: "The big muscle under your shoulder blade working. Your back stays flat and still.",
      easier: "Do fewer reps, or do inverted rows with the bar higher." },
    oneArmRowLight: { name: "One-arm dumbbell row with a light dumbbell", log: "weight",
      how: "One knee and one hand on the bench, back flat. Pull the dumbbell toward your hip by driving your elbow back, then lower slowly.",
      feel: "Upper back working, not your arm alone.",
      easier: "Use a lighter dumbbell." },
    backpackRow: { name: "Backpack row", log: "weight",
      how: "Load a backpack with a few books. Hinge forward with a flat back, hold it by the straps, and pull it toward your stomach by squeezing your shoulder blades.",
      feel: "Upper back working.",
      easier: "Take a book or two out." },
    bentRowCurl: { name: "Bent-over row with the curl bar", log: "weight", weightLabel: "Total lb", record: "bbrow",
      how: "Hold the curl bar, soften your knees and hinge forward to about a 45-degree angle with a flat back. Pull the bar to your belly button by squeezing your shoulder blades together, then lower slowly.",
      feel: "Upper back doing the work. Your lower back stays steady and flat.",
      easier: "Use just the empty bar, or do inverted rows with the bar higher." },
    ytw: { name: "Y-T-W raises on the incline bench (no weight)", log: "reps", bw: true, record: "ytw",
      how: "Set the bench to a low incline and lie face down on it. Let your arms hang. Raise them into a Y shape (thumbs up), lower; then out to the sides like a T, lower; then pull elbows back into a W, lower. The reps you log are for each letter.",
      feel: "Small muscles around your shoulder blades working. They tire quickly, and that's normal.",
      easier: "Do just the T and W, or do fewer reps." },
    ytwFloor: { name: "Y-T-W raises lying on the floor (no weight)", log: "reps", bw: true, record: "ytw",
      how: "Lie face down on the floor with your forehead on a small towel. Lift your arms a few inches into a Y, then a T, then a W. The reps you log are for each letter.",
      feel: "The muscles around your shoulder blades working. Small lifts are fine.",
      easier: "Do fewer reps." },
    extRot: { name: "Side-lying external rotation (no weight or a soup can)", log: "reps", bw: true,
      how: "Lie on your side with your top elbow bent 90 degrees and tucked against your ribs, with a small folded towel under that elbow. Rotate your forearm up toward the ceiling, keeping the elbow on your side, then lower slowly.",
      feel: "A small, deep muscle at the back of your shoulder working. This keeps shoulders healthy for drawing a bow.",
      easier: "Use no weight and a smaller range." },
    extRotLight: { name: "Side-lying external rotation with a 5 lb dumbbell", log: "weight",
      how: "Lie on your side with your top elbow bent 90 degrees and tucked against your ribs. Rotate the dumbbell up toward the ceiling, keeping the elbow on your side, then lower slowly.",
      feel: "The back of your shoulder working. Smooth and slow.",
      easier: "Use no weight or a soup can." },
    reverseFlyLight: { name: "Bent-over reverse fly with light dumbbells", log: "weight",
      how: "Hinge forward with a flat back, light dumbbells hanging below your chest. With a slight bend in your elbows, raise your arms out to the sides, squeezing your shoulder blades, then lower slowly.",
      feel: "The backs of your shoulders working. These are muscles that help hold a bow steady.",
      easier: "Use lighter weights or do it lying face down on the incline bench." },
    bandPullApart: { name: "Band pull-apart", log: "reps", bw: true,
      how: "Hold a light band at shoulder height with straight arms. Pull it apart by squeezing your shoulder blades until it touches your chest, then return slowly.",
      feel: "Upper back and the backs of your shoulders working.",
      easier: "Use a lighter band or hold it wider." },
    bandFacePull: { name: "Band face pull", log: "reps", bw: true,
      how: "Anchor a band at face height. Pull the band toward your face, elbows high and wide, ending with your hands beside your ears. Return slowly.",
      feel: "Backs of your shoulders and upper back working.",
      easier: "Step closer to the anchor to lower the tension." },
    bandExtRot: { name: "Band external rotation", log: "reps", bw: true,
      how: "Anchor a light band at elbow height. With your elbow bent 90 degrees and tucked against your side, rotate your forearm outward away from your body, then return slowly.",
      feel: "The back of your shoulder working gently.",
      easier: "Step closer to the anchor." },
    supportedHang: { name: "Supported hang (toes on a box)", log: "hold", bw: true, record: null,
      how: "Put a sturdy box or step under the pull-up bar. Hold the bar with your hands shoulder-width apart and bend your knees so some of your weight hangs from your arms while your toes stay on the box.",
      feel: "Your grip and shoulders getting used to hanging. Shoulders stay gently engaged, not jammed up by your ears.",
      easier: "Put more weight through your feet." },
    deadHang: { name: "Dead hang", log: "hold", bw: true, record: "hang",
      how: "Step up to the pull-up bar using a box, grip it shoulder-width apart, and gently lift your feet so you hang with straight arms. Keep your shoulders slightly pulled down, away from your ears. Step down before your grip gives out.",
      feel: "Grip and shoulders working. Hanging builds the grip and shoulder strength a bow draw needs.",
      easier: "Keep your toes on the box to take some weight." },
    scapPull: { name: "Scapular pull on the pull-up bar", log: "reps", bw: true,
      how: "Hang from the bar with straight arms. Without bending your elbows, pull your shoulders down away from your ears so your body rises an inch or two. Pause, then relax back down slowly.",
      feel: "The muscles around your shoulder blades switching on. It's a small movement.",
      easier: "Keep your toes on a box." },
    flexHang: { name: "Flexed-arm hang", log: "hold", bw: true,
      how: "Stand on a box and grip the bar with palms facing you. Step up so your chin is above the bar, then lift your feet and hold. Lower yourself slowly when you can't hold any longer.",
      feel: "Arms and upper back working hard for a few seconds.",
      easier: "Keep your toes lightly on the box." },
    negPullup: { name: "Slow lowering pull-up", log: "reps", bw: true,
      how: "Use a box to get your chin above the bar. Lift your feet and lower yourself as slowly as you can, about 3 to 5 seconds, until your arms are straight. Step back up and repeat.",
      feel: "Your back and arms working hard. This builds toward a pull-up.",
      easier: "Do a flexed-arm hang instead." },

    // Stretch and easy movement
    easyWalk: { name: "Easy walk", log: "check", how: "Walk at a relaxed pace on the treadmill or outside.", feel: "Easy and comfortable. You could chat the whole time.", easier: "Walk for less time." },
    catCow: { name: "Cat-cow", log: "check", how: "On hands and knees, slowly round your back up toward the ceiling, then let it gently sag as you look forward. Move with your breath.", feel: "Your spine loosening up.", easier: "Make the movement smaller." },
    hipFlexor: { name: "Half-kneeling hip flexor stretch with a pad", log: "check", how: "Kneel on one knee on a soft pad with the other foot flat in front. Stand tall, gently squeeze the bottom on the kneeling side and tuck your hips under a little. You may feel the stretch without moving forward at all; if not, shift forward only an inch or two. Hold 30 seconds each side.", feel: "A mild stretch at the front of the kneeling-side hip. Stay in a comfortable range; a pinch in the front of the hip means back off.", easier: "Do it standing: hold the rack, step one foot back, and squeeze that side's bottom." },
    quadStretch: { name: "Standing quad stretch", log: "check", how: "Hold the rack or a wall. Bend one knee and hold that ankle (or your sock or pant leg) behind you, keeping your knees close together and standing tall. Hold 30 seconds each side.", feel: "A gentle stretch in the front of your thigh.", easier: "Loop a towel around your ankle instead of reaching." },
    hamStretch: { name: "Hamstring stretch with your heel on a low step", log: "check", how: "Stand facing the bottom stair or a low step and put one heel on it with that leg straight. Stand tall and lean forward just a little from your hips with a flat back. Hold 30 seconds each side.", feel: "A mild stretch in the back of your thigh, nothing in the front of the hip.", easier: "Bend the stretching knee slightly or use a lower step." },
    calfStretch: { name: "Calf stretch against a wall", log: "check", how: "Hands on a wall, one foot back with the heel down and the knee straight. Lean in until you feel your calf stretch. Hold 30 seconds each side.", feel: "A gentle stretch in your calf.", easier: "Step the back foot closer to the wall." },
    hipCircles: { name: "Gentle standing hip circles", log: "check", how: "Hold the rack or a wall. Lift one knee a little (not high) and draw slow, small circles with it, 5 each way, then switch legs. Keep every circle within a comfortable range.", feel: "Your hip loosening up gently. A pinch in the front of the hip means make the circles smaller.", easier: "Make the circles tiny, or just shift your weight side to side." },
    doorwayStretch: { name: "Doorway chest stretch", log: "check", how: "Put your forearm on a door frame with your elbow at shoulder height. Step forward gently until you feel a stretch across your chest. Hold 30 seconds each side.", feel: "Chest and front of the shoulder opening up. Helpful after rows and bow work.", easier: "Put your arm lower on the door frame." },
    thoracicRotation: { name: "Seated upper-back rotation", log: "check", how: "Sit tall on the bench with your feet flat and your arms crossed on your chest. Slowly turn your upper body to one side as far as is comfortable, keeping your hips facing forward, then turn to the other side. 5 slow turns each way.", feel: "A gentle twist through your upper back, not your hips.", easier: "Turn a smaller distance." },
  };

  function ex(key, opts) {
    const base = EX[key];
    if (!base) throw new Error("Unknown exercise " + key);
    return Object.assign({ key: key }, base, opts || {});
  }

  // Plain-English prescription text for an item
  function prescription(it) {
    if (it.detail) return it.detail;
    const s = it.sets || 1;
    const side = it.perSide ? " " + it.perSide : "";
    if (it.log === "hold") return s === 1 ? "Hold for " + it.target + " seconds" + side : s + " holds of " + it.target + " seconds" + side;
    if (it.log === "carry") return s + (s === 1 ? " carry" : " carries") + " of " + it.target + " seconds" + side;
    if (it.log === "check") return it.target ? it.target : "Take your time";
    return s + (s === 1 ? " set" : " sets") + " of " + it.target + " reps" + side;
  }

  // ——— Progressions ———
  function band(L, arr) { return arr[Math.max(0, Math.min(arr.length - 1, L - 1))]; }
  function fmtMin(m) {
    if (m < 1) return Math.round(m * 60) + " seconds";
    if (m === Math.floor(m)) return m + (m === 1 ? " minute" : " minutes");
    return Math.floor(m) + " and a half minutes";
  }

  // Walk/jog steps (couch-to-5K style). jog/walk in minutes, reps = rounds. cont = continuous easy jog minutes.
  const RUN_LEVELS = [
    { jog: 0.5, walk: 2, reps: 6 },
    { jog: 1, walk: 2, reps: 6 },
    { jog: 1, walk: 2, reps: 7 },
    { jog: 1, walk: 1.5, reps: 7 },
    { jog: 1.5, walk: 2, reps: 6 },
    { jog: 1.5, walk: 1.5, reps: 6 },
    { jog: 2, walk: 2, reps: 5 },
    { jog: 2, walk: 1.5, reps: 6 },
    { jog: 2.5, walk: 2, reps: 5 },
    { jog: 3, walk: 2, reps: 4 },
    { jog: 3, walk: 2, reps: 5 },
    { jog: 3, walk: 1.5, reps: 5 },
    { jog: 4, walk: 2, reps: 4 },
    { jog: 4, walk: 1.5, reps: 4 },
    { jog: 5, walk: 2, reps: 3 },
    { jog: 5, walk: 2, reps: 4 },
    { jog: 5, walk: 1.5, reps: 4 },
    { jog: 8, walk: 2, reps: 2 },
    { jog: 8, walk: 2, reps: 3 },
    { jog: 10, walk: 2, reps: 2 },
    { jog: 12, walk: 2, reps: 2 },
    { jog: 15, walk: 2, reps: 2 },
    { cont: 20 },
    { cont: 22 },
    { cont: 25 },
    { cont: 28 },
    { cont: 30 },
  ];
  function runStepText(L) {
    const s = RUN_LEVELS[L - 1];
    if (s.cont) return "Jog easy for " + fmtMin(s.cont) + " without a walk break";
    return "Jog " + fmtMin(s.jog) + ", walk " + fmtMin(s.walk) + ", " + s.reps + " times";
  }

  const HIKE_LEVELS = [
    { min: 20, incline: 0, pack: 0, where: "flat" },
    { min: 25, incline: 0, pack: 0, where: "flat" },
    { min: 30, incline: 0, pack: 0, where: "flat" },
    { min: 30, incline: 3, pack: 0, where: "gentle" },
    { min: 35, incline: 4, pack: 0, where: "gentle" },
    { min: 40, incline: 5, pack: 0, where: "hills" },
    { min: 45, incline: 6, pack: 0, where: "hills" },
    { min: 50, incline: 7, pack: 0, where: "hills" },
    { min: 60, incline: 8, pack: 0, where: "trail" },
    { min: 60, incline: 8, pack: 5, where: "trail" },
    { min: 60, incline: 8, pack: 7, where: "trail" },
    { min: 75, incline: 8, pack: 10, where: "trail" },
    { min: 75, incline: 10, pack: 12, where: "trail" },
    { min: 90, incline: 10, pack: 15, where: "trail" },
    { min: 90, incline: 10, pack: 18, where: "trail" },
    { min: 120, incline: 10, pack: 20, where: "trail" },
    { min: 150, incline: 12, pack: 20, where: "trail" },
  ];
  function hikeStepText(L) {
    const h = HIKE_LEVELS[L - 1];
    let t = fmtMin(h.min) + " of walking";
    if (h.incline) t += " on hills or at a " + h.incline + "% treadmill incline";
    if (h.pack) t += ", carrying about " + h.pack + " lb";
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function strengthStepText(L) {
    return band(L, [
      "Box squats to the bench, wall push-ups, glute bridges and side-hip work",
      "Box squats to the bench, wall push-ups, glute bridges and side-hip work",
      "Three sets of box squats, incline push-ups and glute bridges",
      "Slow-lowering box squats, incline push-ups and curl-bar Romanian deadlifts",
      "Slow-lowering box squats, incline push-ups and side-lying hip raises",
      "Slow-lowering box squats, lower incline push-ups and single-leg bridges",
      "Box squats holding a dumbbell, slightly higher step-ups and full planks",
      "Box squats holding a dumbbell, short-range split squats and farmer carries",
      "Box squats holding a dumbbell, knee push-ups and back extensions",
      "Weighted low step-ups, reverse lunges and knee push-ups",
      "Your first full push-ups, weighted low step-ups and reverse lunges",
      "Strong and steady: full push-ups, weighted box squats and longer carries",
    ]);
  }
  function bowStepText(L) {
    return band(L, [
      "Inverted rows with the bar high, supported hangs and Y-T-W raises",
      "Inverted rows with the bar high, supported hangs and Y-T-W raises",
      "Three sets of high inverted rows and your first dead hangs",
      "Inverted rows at waist height and 10-second dead hangs",
      "Waist-height rows, curl-bar rows and 15-second hangs",
      "Waist-height rows, curl-bar rows and 20-second hangs",
      "Waist-height rows, scapular pulls and 20-second hangs",
      "Hip-height rows, scapular pulls and 25-second hangs",
      "Hip-height rows, 30-second hangs and flexed-arm holds",
      "Hip-height rows, flexed-arm holds and longer hangs",
      "Slow lowering pull-ups, hip-height rows and curl-bar rows",
      "Slow lowering pull-ups, strong rows and steady hangs",
    ]);
  }
  function stepText(p, L) {
    if (p === "run") return runStepText(L);
    if (p === "hike") return hikeStepText(L);
    if (p === "strength") return strengthStepText(L);
    return bowStepText(L);
  }

  // ——— Exercise pickers (level + equipment aware) ———
  function squatItem(L) {
    // Hip-friendly: always to a box at knee height or higher. Progress with reps, tempo and load, not depth.
    if (L <= 3) return ex("boxSquat", { sets: L <= 2 ? 2 : 3, target: band(L, [8, 10, 10]) });
    if (L <= 6) {
      if (eq("lightDumbbells") && L >= 5) return ex("boxSquatLight", { sets: 3, target: 10 });
      return ex("boxSquatSlow", { sets: 3, target: band(L - 3, [8, 10, 10]) });
    }
    const tip = L >= 10 ? "When 12 reps feel easy, you can lower the box an inch, but never below the point where your thighs are level with the floor." : "Keep the same box height. Add reps before anything else.";
    if (eq("dumbbells25")) return ex("boxSquatDB", { sets: 3, target: band(L - 6, [8, 10, 12]), weightDefault: 25, tip: tip });
    if (eq("lightDumbbells")) return ex("boxSquatLight", { sets: 3, target: 12, tip: tip });
    return ex("boxSquatSlow", { sets: 3, target: 12, tip: tip });
  }
  function hingeItem(L) {
    if (L <= 3) return ex("gluteBridge", { sets: L === 1 ? 2 : 3, target: band(L, [10, 10, 12]) });
    const reps = band(L - 3, [8, 10, 10, 12, 10, 10, 10, 10, 10]);
    if (eq("curlBar")) return ex("rdlCurl", { sets: 3, target: reps,
      tip: L >= 8 ? "Add a small plate to each side when 10 reps feel easy. Log the total weight (bar plus plates)." : "Start with just the curl bar. Add small plates only after 12 reps feel easy. Log the total weight (bar plus plates)." });
    if (eq("dumbbells25")) return ex("rdlDumbbell", { sets: 3, target: reps, weightDefault: 25 });
    if (eq("lightDumbbells")) return ex("rdlDumbbell", { name: "Romanian deadlift with light dumbbells", sets: 3, target: 12 });
    return ex("hipHinge", { sets: 3, target: 12 });
  }
  function pushItem(L) {
    if (L <= 2) return ex("wallPushup", { sets: 2, target: band(L, [8, 10]) });
    if (L <= 5) return ex("inclinePushupHigh", { sets: 3, target: band(L - 2, [6, 8, 10]) });
    if (L <= 8) {
      if (!eq("rack")) return ex("inclinePushupHigh", { sets: 3, target: 12 });
      return ex("inclinePushupLow", { sets: 3, target: band(L - 5, [6, 8, 10]) });
    }
    if (L <= 10) return ex("kneePushup", { sets: 3, target: band(L - 8, [6, 8]) });
    return ex("pushup", { sets: 3, target: band(L - 10, [3, 5]), tip: "If you run out of full push-ups, finish the set on your knees." });
  }
  function pressItem(L) {
    if (L <= 4) return pushItem(Math.max(1, L - 1));
    if (eq("lightDumbbells")) return ex("pressLight", { sets: 3, target: band(L - 4, [8, 8, 10, 10, 12]) });
    if (eq("curlBar")) return ex("pressCurl", { sets: L <= 6 ? 2 : 3, target: 8, tip: "Start with the empty curl bar. Log the total weight." });
    return pushItem(L);
  }
  function legItemA(L) {
    if (L <= 3) return ex("stepUpLow", { sets: 2, target: band(L, [6, 8, 8]), perSide: "on each leg" });
    if (L <= 6) return ex("stepUpLow", { sets: 3, target: band(L - 3, [8, 10, 10]), perSide: "on each leg" });
    if (L <= 9 || !eq("dumbbells25")) return ex("stepUpHigh", { sets: 3, target: band(L - 6, [6, 8, 10, 12]), perSide: "on each leg" });
    return ex("stepUpDB", { sets: 3, target: 8, perSide: "on each leg", weightDefault: 25 });
  }
  function legItemB(L) {
    if (L <= 3) return ex("boxSquat", { sets: 2, target: 8 });
    if (L <= 9) return ex("splitSquat", { sets: L >= 7 ? 3 : 2, target: band(L - 3, [6, 8, 8, 10, 10, 10]), perSide: "on each leg" });
    return ex("reverseLunge", { sets: 3, target: band(L - 9, [6, 8, 8]), perSide: "on each leg" });
  }
  function sideHipItems(L, full) {
    // Glute medius / side-hip work for steady hips
    const out = [];
    if (L <= 4) out.push(ex("clamshell", { sets: 2, target: band(L, [8, 10, 10, 12]), perSide: "on each side" }));
    else out.push(ex("sideHipRaise", { sets: 2, target: band(L - 4, [8, 10, 10, 12]), perSide: "on each side" }));
    if (full && L >= 3) out.push(ex("hipHike", { sets: 2, target: band(L - 2, [8, 10, 12]), perSide: "on each side" }));
    return out;
  }
  function backItemB(L) {
    if (L <= 3) return ex("hipHinge", { sets: 2, target: 10 });
    if (L >= 6 && !eq("backExtBench")) return ex("singleLegBridge", { sets: 2, target: band(L - 5, [6, 8, 10]), perSide: "on each side" });
    if (eq("backExtBench")) return ex("backExt", { sets: L <= 5 ? 2 : 3, target: band(L - 3, [8, 10, 10, 10, 12]) });
    return ex("gluteBridge", { sets: 3, target: 12 });
  }
  function coreItemsA(L) {
    if (L <= 3) return [ex("deadBug", { sets: 2, target: band(L, [5, 6, 8]), perSide: "on each side" })];
    if (L <= 6) return [ex("deadBug", { sets: 2, target: 8, perSide: "on each side" }), ex("plankKnees", { sets: 2, target: band(L - 3, [15, 20, 25]) })];
    return [ex("plank", { sets: 3, target: band(L - 6, [15, 20, 25, 30]), record: "plank" }), ex("deadBug", { sets: 2, target: 10, perSide: "on each side" })];
  }
  function coreItemB(L) {
    if (L <= 3) return ex("birdDog", { sets: 2, target: band(L, [5, 6, 8]), perSide: "on each side" });
    if (L <= 6) return ex("sidePlankKnees", { sets: 2, target: band(L - 3, [15, 20, 25]), perSide: "on each side" });
    return ex("sidePlank", { sets: 2, target: band(L - 6, [15, 20, 25, 30]), perSide: "on each side", record: "sideplank" });
  }
  function carryItem(L) {
    if (eq("dumbbells25")) {
      if (L <= 5) return ex("suitcaseCarry", { sets: 2, target: 40, detail: "2 carries of 40 seconds, switching hands halfway", weightDefault: 25 });
      return ex("farmerCarry", { sets: 3, target: band(L - 5, [30, 40, 45]), weightDefault: 25 });
    }
    return ex("carryBackpack", { sets: 2, target: 40, detail: "2 carries of 40 seconds, switching hands halfway" });
  }
  function rowItem(L, setsOverride) {
    let it;
    if (eq("rack")) {
      if (L <= 3) it = ex("invRowHigh", { sets: band(L, [2, 2, 3]), target: band(L, [6, 8, 8]) });
      else if (L <= 7) it = ex("invRowMid", { sets: 3, target: band(L - 3, [6, 8, 8, 10]) });
      else it = ex("invRowLow", { sets: 3, target: band(L - 7, [6, 8, 10]) });
    } else if (eq("lightDumbbells")) {
      it = ex("oneArmRowLight", { sets: 3, target: 10, perSide: "on each side" });
    } else if (eq("dumbbells25") && L >= 4) {
      it = ex("oneArmRow25", { sets: 3, target: 8, perSide: "on each side", weightDefault: 25 });
    } else {
      it = ex("backpackRow", { sets: 3, target: 10 });
    }
    if (setsOverride) it.sets = setsOverride;
    return it;
  }
  function hangItems(L, full) {
    const out = [];
    if (!eq("pullupBar")) {
      if (eq("dumbbells25")) out.push(ex("farmerCarry", { name: "Grip hold with two 25 lb dumbbells", sets: 3, target: 20, detail: "Stand tall and hold the dumbbells at your sides: 3 holds of 20 seconds", weightDefault: 25 }));
      return out;
    }
    if (L <= 2) out.push(ex("supportedHang", { sets: 3, target: band(L, [10, 15]) }));
    else out.push(ex("deadHang", { sets: 3, target: band(L - 2, [10, 10, 15, 20, 20, 25, 30]) }));
    if (full && L >= 7) out.push(ex("scapPull", { sets: 2, target: 5 }));
    if (full && L >= 9 && L <= 10) out.push(ex("flexHang", { sets: 3, target: 5 }));
    if (full && L >= 11) out.push(ex("negPullup", { sets: 3, target: 2 }));
    return out;
  }
  function ytwItem(L) {
    const sets = L <= 3 ? 1 : 2;
    const target = L <= 3 ? 6 : L <= 6 ? 8 : 10;
    return ex(eq("bench") ? "ytw" : "ytwFloor", { sets: sets, target: target,
      detail: sets + (sets === 1 ? " round" : " rounds") + " of " + target + " reps for each letter (Y, then T, then W)" });
  }
  function extRotItem(L) {
    if (eq("bands")) return ex("bandExtRot", { sets: 2, target: 12, perSide: "on each arm" });
    if (eq("lightDumbbells") && L >= 4) return ex("extRotLight", { sets: 2, target: band(L - 3, [10, 12]), perSide: "on each arm", weightDefault: 5 });
    return ex("extRot", { sets: 2, target: L <= 4 ? 10 : 12, perSide: "on each arm" });
  }
  function bentRowItem(L) {
    if (L < 5) return null;
    if (eq("curlBar")) return ex("bentRowCurl", { sets: 3, target: 10, tip: "Start with the empty curl bar and log the total weight. Add a small plate to each side when 10 reps feel easy. Most curl bars weigh about 15 to 25 lb, so check yours." });
    if (eq("dumbbells25") && L >= 7) return ex("oneArmRow25", { sets: 2, target: 8, perSide: "on each side", weightDefault: 25 });
    return null;
  }
  function isCompound() { return (profile.bowType || "Compound") === "Compound"; }
  function bowWorkoutIntro() {
    return "These build the pulling strength and shoulder-blade control you'll use to draw your bow.";
  }
  function bowIntro() {
    return isCompound()
      ? "Why the training looks like this: with a compound bow, the heaviest pull is the first part of the draw. Once the cams roll over, you hold a much lighter weight at full draw (the let-off). So the training focuses on pulling strength and shoulder-blade control for that first part, plus short, steady holds, not long heavy holds."
      : "Why the training looks like this: with a recurve, the pull gets heavier the farther you draw, and you hold that full weight at anchor. So the training focuses on pulling strength and shoulder-blade control, plus short, steady holds.";
  }
  // ——— Readiness toward drawing the bow ———
  function readiness() {
    const target = profile.bowWeight || 35;
    const rowVal = Math.max(best("invrow_mid"), best("invrow_low"));
    const markers = [
      { id: "row", label: eq("rack") ? "Inverted rows with the bar at waist height or lower" : "Rows (log them as inverted rows if you use the rack)", value: rowVal, target: 10, unit: "reps in one set" },
      { id: "hang", label: "Dead hang from the pull-up bar", value: best("hang"), target: 30, unit: "seconds" },
      { id: "bbrow", label: "Bent-over or one-arm row, 8 or more reps", value: best("bbrow"), target: target, unit: "lb" },
      { id: "ytw", label: "Y-T-W raises, smooth reps for each letter", value: best("ytw"), target: 10, unit: "reps" },
    ];
    let sum = 0, met = 0;
    markers.forEach(function (m) { const f = Math.min(1, m.value / m.target); m.frac = f; sum += f; if (m.value >= m.target) met++; });
    const pct = Math.round((sum / markers.length) * 100);
    let stage;
    if (met >= 4) stage = "Your strength markers say you're likely ready";
    else if (met >= 3) stage = "Almost there: one more marker to go";
    else if (pct >= 40) stage = "Getting stronger";
    else stage = "Building the base";
    return { markers: markers, pct: pct, met: met, ready: met >= 4, stage: stage, target: target };
  }

  // ——— Workout builders ———
  const REST_NOTE = "Rest about a minute between sets, or longer if you need it.";
  const PAIN_NOTE = "If anything hurts sharply (a pinch or a stab, not just muscles working), stop that exercise and skip it today. Feeling a little sore a day or two later is normal.";
  const PAIN_RULE = "A simple rule: mild discomfort up to about 3 out of 10 that settles by the next morning is okay. Sharp pain, pinching, or pain that's worse the next day means ease back, and if it keeps happening, check with your physical therapist or doctor.";
  const HIP_RANGE_NOTE = "Stay in a comfortable range; a pinch in the front of the hip means back off.";

  function runWorkout(variant) {
    const L = lvl("run");
    const s = RUN_LEVELS[L - 1];
    const short = variant === "short";
    const warm = short ? 3 : 5, cool = short ? 3 : 5;
    let jog = 0, walk = 0, reps = 0, cont = 0;
    if (s.cont) cont = short ? Math.min(s.cont, 14) : s.cont;
    else {
      jog = s.jog; walk = s.walk; reps = s.reps;
      if (short) {
        if (jog + walk > 7) { reps = 1; jog = Math.min(jog, 12); }
        else reps = Math.max(2, Math.min(reps, Math.floor(14 / (jog + walk))));
      }
    }
    const phases = [{ kind: "walk", label: "Warm-up walk", secs: warm * 60 }];
    if (cont) phases.push({ kind: "jog", label: "Easy jog", secs: cont * 60, round: 0 });
    else {
      for (let i = 0; i < reps; i++) {
        phases.push({ kind: "jog", label: "Jog easy", secs: Math.round(jog * 60), round: i });
        if (i < reps - 1) phases.push({ kind: "walk", label: "Walk", secs: Math.round(walk * 60) });
      }
    }
    phases.push({ kind: "walk", label: "Cool-down walk", secs: cool * 60 });
    const mainMin = cont || reps * jog + (reps - 1) * walk;
    const total = Math.round(warm + mainMin + cool + (short ? 0 : 4));
    const detail = cont
      ? "Walk briskly for " + warm + " minutes to warm up. Then jog easy for " + fmtMin(cont) + " without stopping. Finish with " + cool + " minutes of easy walking."
      : reps === 1
        ? "Walk briskly for " + warm + " minutes to warm up. Then jog easy for " + fmtMin(jog) + ". Finish with " + cool + " minutes of easy walking."
        : "Walk briskly for " + warm + " minutes to warm up. Then jog easy for " + fmtMin(jog) + " and walk for " + fmtMin(walk) + ", " + reps + " times. Finish with " + cool + " minutes of easy walking.";
    const main = {
      key: "intervals", log: "intervals", name: cont ? "Easy continuous jog" : "Walk and jog intervals",
      detail: detail, phases: phases, rounds: cont ? 1 : reps, jog: cont || jog, cont: !!cont, record: "jog",
      how: "Jog slowly enough that you could chat in full sentences. It's fine if your jog is barely faster than your walk. The timer below tells you when to switch.",
      feel: "Breathing harder than walking, but never gasping. If you can't talk, slow down or walk a little longer.",
      easier: "Walk briskly in place of any jog, or stop after fewer rounds. Every bit counts.",
    };
    const blocks = [{ name: cont ? "Easy jog" : "Walk and jog", items: [main] }];
    if (!short) {
      blocks.push({ name: "After your walk", items: [
        ex("calfRaise", { sets: 2, target: 12 }),
        ex("calfStretch", { target: "Hold 30 seconds on each side" }),
        ex("hipFlexor", { target: "Hold 30 seconds on each side" }),
      ] });
    }
    return {
      title: (short ? "Short " : "") + (cont ? (short ? "easy jog" : "Easy continuous jog") : (short ? "walk and jog intervals" : "Walk and jog intervals")),
      minutes: total,
      location: eq("treadmill") ? "Home treadmill or outdoor" : "Outdoor",
      why: "Builds your running base a little at a time. The goal is easy, chatty jogging, not speed.",
      warmup: [],
      blocks: blocks,
      notes: [
        eq("treadmill") ? "Keep the treadmill flat, at 0 to 1% incline, and don't use the decline setting. Outside, pick flat routes and walk any downhills for now." : "Pick a flat, safe route for now, and walk any downhills.",
        PAIN_RULE,
        "If this felt too hard, it's completely fine to repeat this step next time. Lots of new runners repeat a week or two, and that's how running starts to feel good.",
        PAIN_NOTE,
      ],
    };
  }

  function walkItem(minutes, incline, pack, where, forShort) {
    let d = "Walk for " + fmtMin(minutes) + " at an easy pace where you could chat the whole time.";
    if (incline) d += eq("treadmill") ? " On the treadmill, set the incline to " + incline + "%. Outside, choose a route with " + (where === "trail" ? "some real hills or a trail with elevation." : "gentle hills.") : " Choose a route with " + (where === "trail" ? "some real hills or a trail with elevation." : "gentle hills.");
    else d += " Flat or gently rolling is perfect, outside or on the treadmill.";
    if (pack) d += " Carry about " + pack + " lb in your backpack.";
    return {
      key: "walk", log: "walk", name: forShort ? (eq("treadmill") ? "Treadmill incline walk" : "Hilly walk") : pack ? "Hike with a light pack" : incline ? "Hilly walk" : "Long walk",
      detail: d, targetMin: minutes, incline: incline, pack: pack, showPack: !!pack || !forShort, record: "hike",
      how: "Walk tall with relaxed shoulders and short, easy steps on uphills." + (pack ? " Tighten the hip belt so the pack weight sits on your hips, not your shoulders." : ""),
      feel: "Comfortable and steady. Uphills can get your breathing up, but you can still talk.",
      easier: "Walk for less time, use a lower incline, or " + (pack ? "take a little weight out of the pack." : "take the flattest route."),
    };
  }

  function hikeWorkout(variant) {
    const L = lvl("hike");
    const h = HIKE_LEVELS[L - 1];
    const Ls = lvl("strength");
    if (variant === "short") {
      const incl = Math.max(3, Math.min(h.incline || 3, 8));
      const step = legItemA(Ls); step.sets = 2;
      return {
        title: eq("treadmill") ? "Incline walk and step-ups" : "Hilly walk and step-ups",
        minutes: 20,
        location: eq("treadmill") ? "Home" : "Outdoor",
        why: "A quick dose of hiking fitness: uphill walking plus step-ups for strong hiking legs.",
        warmup: [],
        blocks: [
          { name: "Uphill walk", items: [eq("treadmill")
            ? Object.assign(walkItem(15, incl, 0, "gentle", true), { detail: "Walk for 15 minutes on the treadmill. Start flat for 2 minutes, then raise the incline to " + incl + "% for the rest. Easy, chatty pace." })
            : Object.assign(walkItem(15, 0, 0, "gentle", true), { detail: "Walk for 15 minutes on the hilliest route near you, or walk up and down a flight of stairs a few times along the way." })] },
          { name: "Hiking legs", items: [step, ex("calfRaise", { sets: 2, target: 12 })] },
        ],
        notes: [PAIN_NOTE],
      };
    }
    const title = L <= 3 ? "Long walk" : L <= 7 ? "Hilly walk or incline walk" : "Hike with a light pack";
    const blocks = [{ name: h.pack ? "Hike" : "Walk", items: [walkItem(h.min, h.incline, h.pack, h.where, false)] }];
    let minutes = h.min;
    if (h.min < 75) {
      const step = legItemA(Ls); step.sets = 2;
      blocks.push({ name: "Hiking legs (at home afterwards)", items: [step, ex("calfRaise", { sets: 2, target: 12 })] });
      minutes += 8;
    }
    const notes = [];
    if (h.pack) notes.push("Pack weight idea: a liter of water weighs about 2.2 lb, so " + h.pack + " lb is roughly " + Math.round(h.pack / 2.2) + " liters of water, or water plus a jacket and snacks. Add weight slowly, a few pounds at a time.");
    if (h.pack) notes.push("Only add pack weight after a comfortable hike at the current weight with your hips feeling fine. If your hips were achy, the app keeps you at this weight.");
    if (h.incline) notes.push("Downhill is usually harder on hips than uphill. Take downhills slowly with short steps, and use trekking poles if you have them (they help most on the way down)." + (L < 14 ? " Choose routes without long descents for now; longer downhills come at later steps." : "") + (eq("treadmill") ? " On the treadmill, stick to uphill or flat; skip the decline setting." : ""));
    if (h.min >= 60) notes.push("Bring water and a snack, and tell someone your route if you're heading onto a trail.");
    if (L >= 10) notes.push("Every hike like this builds toward multi-day backcountry trips. Comfortable feet and a well-fitted pack matter more than speed.");
    notes.push(PAIN_RULE);
    return {
      title: title,
      minutes: minutes,
      location: L <= 3 ? "Outdoor or home treadmill" : "Outdoor trail or home treadmill incline",
      why: "Builds the steady leg and lung fitness for long days on the trail, and later for carrying a pack.",
      warmup: [],
      blocks: blocks,
      notes: notes,
    };
  }

  function strengthAWorkout(variant) {
    const Ls = lvl("strength"), Lb = lvl("bow");
    if (variant === "short") {
      const s = squatItem(Ls), p = pushItem(Ls), h = hingeItem(Ls), c = coreItemsA(Ls)[0];
      [s, p, h, c].forEach(function (it) { it.sets = 2; });
      return {
        title: "Short full-body strength", minutes: 20, location: "Home",
        why: "A quick full-body session. Two sets of each keeps it short but still counts.",
        warmup: ["March in place or walk on the treadmill for 2 minutes.", "10 arm circles forward and 10 backward.", "8 side-lying clamshells on each side."],
        blocks: [{ name: "Legs and hips", items: [s, h] }, { name: "Push", items: [p] }, { name: "Core", items: [c] }],
        notes: [REST_NOTE, HIP_RANGE_NOTE, PAIN_NOTE],
      };
    }
    return {
      title: "Full-body strength", minutes: Ls >= 7 ? 40 : 35, location: "Home",
      why: "Builds strength for everything you want to do: running, carrying a pack, and holding a bow steady.",
      warmup: ["March in place or walk on the treadmill for 3 minutes.", "10 arm circles forward and 10 backward.", "8 side-lying clamshells on each side.", "5 slow box squats to the bench.", "5 slow cat-cows on your hands and knees."],
      blocks: [
        { name: "Legs", items: [squatItem(Ls), legItemA(Ls)] },
        { name: "Push and pull", items: [pushItem(Ls), rowItem(Lb, 2)] },
        { name: "Hips and the back of your legs", items: [hingeItem(Ls)].concat(Ls >= 6 ? [ex("singleLegBridge", { sets: 2, target: band(Ls - 5, [6, 8, 10]), perSide: "on each side" })] : []).concat(sideHipItems(Ls, false)) },
        { name: "Core and carry", items: coreItemsA(Ls).concat([carryItem(Ls)]) },
      ],
      notes: [REST_NOTE, "Choose a weight or version where the last 2 reps of each set take effort but your form stays smooth.", HIP_RANGE_NOTE, PAIN_NOTE],
    };
  }

  function strengthBWorkout(variant) {
    const Ls = lvl("strength"), Lb = lvl("bow");
    if (variant === "short") {
      const items = [rowItem(Lb), hangItems(Lb, false)[0], ytwItem(Lb), extRotItem(Lb)].filter(Boolean);
      items.forEach(function (it) { it.sets = Math.min(it.sets, 2); });
      return {
        title: "Short back and shoulder session for your bow", minutes: 20, location: "Home",
        why: "The key moves for drawing your bow, in about 20 minutes.",
        warmup: ["10 arm circles each way.", "8 wall slides.", "8 shoulder blade squeezes, holding each for 3 seconds."],
        blocks: [{ name: "Back and shoulders for your bow", intro: bowWorkoutIntro(), items: items }, { name: "Core and side hips", items: [coreItemB(Ls)].concat(sideHipItems(Ls, false)) }],
        notes: [REST_NOTE, PAIN_NOTE],
      };
    }
    const bowItems = [rowItem(Lb)].concat(hangItems(Lb, true)).concat([
      ytwItem(Lb), extRotItem(Lb), bentRowItem(Lb),
      eq("lightDumbbells") && Lb >= 3 ? ex("reverseFlyLight", { sets: 2, target: band(Lb - 2, [10, 10, 12]), weightDefault: 5 }) : null,
      eq("bands") ? ex("bandPullApart", { sets: 2, target: 12 }) : null,
      eq("bands") && Lb >= 4 ? ex("bandFacePull", { sets: 2, target: 12 }) : null,
    ]).filter(Boolean);
    const legItems = [legItemB(Ls), backItemB(Ls)].concat(sideHipItems(Ls, true));
    if (Ls >= 9 && eq("backExtBench")) legItems.push(ex("hamLower", { sets: 2, target: 3 }));
    const pressItems = [pressItem(Ls)];
    if (eq("lightDumbbells") && Ls >= 3) pressItems.push(ex("lateralRaise", { sets: 2, target: 10, weightDefault: 5 }));
    const warm = ["Walk or march in place for 3 minutes.", "10 arm circles each way.", "8 wall slides.", "8 shoulder blade squeezes, holding each for 3 seconds.", "8 standing hip hikes on each side (on flat ground)."];
    if (eq("bands")) warm.push("10 easy band pull-aparts.");
    return {
      title: "Back, shoulders and legs for your bow", minutes: Lb >= 7 ? 45 : 40, location: "Home",
      why: "Drawing a bow is mostly upper-back strength. This session builds it steadily, plus legs and core.",
      warmup: warm,
      blocks: [
        { name: "Back and shoulders for your bow", intro: bowWorkoutIntro(), items: bowItems },
        { name: "Legs and side hips", items: legItems },
        { name: "Press", items: pressItems },
        { name: "Core", items: [coreItemB(Ls)] },
      ],
      notes: [REST_NOTE, "The small shoulder exercises (Y-T-W and rotations) tire quickly. That's normal, and they keep your shoulders happy for archery.", "The hip and core work matters for archery too: a steady, tall stance helps you control the draw.", HIP_RANGE_NOTE, PAIN_NOTE],
    };
  }

  function mobilityWorkout(variant) {
    const full = variant !== "short";
    const items = [];
    if (full) items.push(ex("easyWalk", { target: "10 minutes, relaxed" }));
    items.push(ex("catCow", { target: "8 slow rounds" }));
    items.push(ex("hipCircles", { target: "5 small circles each way, on each leg" }));
    items.push(ex("hipFlexor", { target: "Hold 30 seconds on each side" }));
    if (full) items.push(ex("quadStretch", { target: "Hold 30 seconds on each side" }));
    if (full) items.push(ex("hamStretch", { target: "Hold 30 seconds on each side" }));
    items.push(ex("calfStretch", { target: "Hold 30 seconds on each side" }));
    items.push(ex("thoracicRotation", { target: "5 slow turns each way" }));
    if (full) items.push(ex("doorwayStretch", { target: "Hold 30 seconds on each side" }));
    return {
      title: full ? "Stretch and easy movement" : "Short stretch", minutes: full ? 25 : 12, location: "Home",
      why: "Gentle movement that helps you feel loose and recover. Nothing here should feel like hard work.",
      warmup: [],
      blocks: [{ name: full ? "Easy walk and stretches" : "Stretches", items: items }],
      notes: [HIP_RANGE_NOTE, "Stretch to a mild, comfortable pull, never pain, and breathe slowly. There's no need to push any stretch to its limit.", "A rest day with a stretch like this is a great day."],
    };
  }

  function checkinWorkout() {
    const items = [];
    if (eq("pullupBar")) items.push(ex("deadHang", {
      sets: 1, target: 30, detail: "One hang, as long as feels comfortable (up to about 30 seconds). Step down before your grip gives out. Only count seconds with your feet fully off the box. If you can't lift your feet yet, that's completely fine: do a short supported hang for practice and leave the seconds empty." }));
    if (eq("rack")) items.push(ex("invRowMid", { sets: 1, target: 10, detail: "One set of as many smooth reps as you can, stopping when your form starts to slip." }));
    items.push(ex(eq("bench") ? "ytw" : "ytwFloor", { sets: 1, target: 10, detail: "One round: as many smooth reps as you can for each letter, up to 15. Log the reps per letter." }));
    items.push(ex("plank", { sets: 1, target: 30, record: "plank", detail: "One plank, holding as long as your form stays good, up to 60 seconds. Doing it on your knees is fine; add a note in Progress if you did." }));
    items.push({ key: "jogcheck", log: "walk", name: "Easy jog check", fields: ["minutes"], record: "jog", showPack: false,
      detail: "Jog easy for as long as it stays chatty, up to 10 minutes, then walk. Log the minutes you jogged without a walk break. Walking the whole time is fine too.",
      how: "Treadmill or outside. Keep the jog slow enough to talk.", feel: "Comfortable. This is a check-in, not a test to push through.", easier: "Skip it today; it's optional." });
    return {
      title: "Gentle check-in", minutes: 20, location: "Home",
      why: "A friendly look at where you are, so you can see progress over time. No pushing to your limit.",
      warmup: ["Walk or march in place for 3 minutes.", "10 arm circles each way.", "8 wall slides."],
      blocks: [{ name: "Check-in", intro: "Do each one once, at a comfortable effort.", items: items }],
      notes: ["Your results go straight to Progress. Beating an old number gets a little celebration.", PAIN_NOTE],
    };
  }

  // ——— Weekly slots ———
  // Main slots in priority order; the first N (N = training days) are the week's main workouts. The rest become bonus.
  const SLOTS = {
    strengthA: { label: "Full-body strength", pillars: ["strength"], build: strengthAWorkout },
    run1: { label: "Walk and jog", pillars: ["run"], build: runWorkout },
    strengthB: { label: "Bow strength", pillars: ["bow", "strength"], build: strengthBWorkout },
    run2: { label: "Walk and jog", pillars: ["run"], build: runWorkout },
    hike: { label: "Hike or long walk", pillars: ["hike"], build: hikeWorkout },
    mobility: { label: "Stretch and easy movement", pillars: [], build: mobilityWorkout },
    checkin: { label: "Gentle check-in", pillars: [], build: checkinWorkout },
  };
  const PRIORITY = ["strengthA", "run1", "strengthB", "run2", "hike"];

  function buildWorkout(slotId, variant) {
    const w = SLOTS[slotId].build(variant);
    w.slotId = slotId;
    w.variant = variant;
    w.pillars = SLOTS[slotId].pillars.slice();
    // Number every block/item for logging
    w.blocks.forEach(function (b, bi) { b.items.forEach(function (it, ii) { it.logKey = bi + "-" + ii; }); });
    return w;
  }

  function mainSlots() { return weekInfo().headStart ? [] : PRIORITY.slice(0, Math.max(2, Math.min(5, profile.trainingDays || 3))); }
  function bonusSlots() {
    const main = mainSlots();
    // In the head-start days a single walk and jog option is plenty.
    const pool = weekInfo().headStart ? PRIORITY.filter(function (s) { return s !== "run2"; }) : PRIORITY;
    return pool.filter(function (s) { return main.indexOf(s) < 0; }).concat(["mobility"]);
  }
  function isCheckinWeek() {
    const w = weekInfo();
    return w.headStart || (w.num % 4 === 1);
  }

  // ——— Week plan (recomputed from what's actually been logged, so it reshuffles itself) ———
  function kindOf(s) { return s === "run2" ? "run1" : s; }

  function planWeek() {
    const w = weekInfo();
    const main = mainSlots(), bonus = bonusSlots();
    const done = week.completed || {};
    const act = week.activeSession && week.activeSession.dayKey === w.todayKey ? week.activeSession : null;
    const byDay = {};
    w.days.forEach(function (d) { byDay[d.key] = { done: [], plan: null, planType: null, active: null }; });
    Object.keys(done).forEach(function (sid) { const e = done[sid]; if (byDay[e.dayKey]) byDay[e.dayKey].done.push(sid); });
    if (act) byDay[w.todayKey].active = act.slotId;
    const todayTaken = byDay[w.todayKey].done.length > 0 || !!act;
    const open = function (s) { return !done[s] && !(act && act.slotId === s); };
    const remMain = main.filter(open);
    const remBonus = bonus.filter(open);
    const avail = w.days.filter(function (d) {
      return d.idx >= w.todayIdx && byDay[d.key].done.length === 0 && !(d.key === w.todayKey && todayTaken);
    });
    const overflow = [];
    const n = remMain.length, m = avail.length;
    if (n >= m) {
      remMain.forEach(function (s, i) { if (i < m) { byDay[avail[i].key].plan = s; byDay[avail[i].key].planType = "main"; } else overflow.push(s); });
    } else {
      for (let k = 0; k < n; k++) {
        const d = avail[Math.floor((k * m) / n)];
        byDay[d.key].plan = remMain[k]; byDay[d.key].planType = "main";
      }
    }
    // Place up to two bonus sessions on free days, always leaving at least one pure rest day.
    let free = avail.filter(function (d) { return !byDay[d.key].plan; });
    const placeCount = Math.min(2, Math.max(0, free.length - 1));
    const pref = ["hike", "mobility", "run2", "strengthB", "run1", "strengthA"];
    const bonusSorted = remBonus.slice().sort(function (a, b) { return pref.indexOf(a) - pref.indexOf(b); });
    const placed = [];
    bonusSorted.slice(0, placeCount).forEach(function (s) {
      let d = null;
      if (s === "hike") d = free.find(function (x) { return x.idx >= 5; }) || null;
      if (!d) {
        // Prefer a free day that isn't the last one (the last free day stays a rest day)
        d = free.find(function (x, i) { return i < free.length - 1; }) || null;
      }
      if (d) {
        byDay[d.key].plan = s; byDay[d.key].planType = "bonus"; placed.push(s);
        free = free.filter(function (x) { return x.key !== d.key; });
      }
    });
    const extras = remBonus.filter(function (s) { return placed.indexOf(s) < 0; });
    return { w: w, byDay: byDay, remMain: remMain, remBonus: remBonus, overflow: overflow, extras: extras, main: main, act: act };
  }

  function todayOptions(p) {
    const t = p.byDay[p.w.todayKey];
    const list = [];
    const seen = {};
    function add(slotId, variant, reason) {
      if (!slotId) return;
      const k = kindOf(slotId) + ":" + variant;
      if (seen[k]) return;
      seen[k] = 1;
      list.push({ slotId: slotId, variant: variant, reason: reason, isMain: p.main.indexOf(slotId) >= 0, headStart: p.w.headStart });
    }
    const altMain = function (not) { return p.remMain.find(function (s) { return kindOf(s) !== kindOf(not); }); };
    if (t.plan && t.planType === "main") {
      add(t.plan, "full", "On the plan for today.");
      add(t.plan, "short", "Short on time or energy? This still counts.");
      const alt = altMain(t.plan) || p.remBonus.find(function (s) { return kindOf(s) !== kindOf(t.plan); });
      add(alt, "full", "Rather do something different today? The week will reshuffle around it.");
    } else if (p.remMain.length) {
      const first = p.remMain[0];
      if (t.plan) add(t.plan, "full", "A gentle extra for a lighter day.");
      else add("mobility", "full", "Easy movement for a rest day.");
      add(first, "short", "Feel like a little training? A short one still counts.");
      add(first, "full", "Or the full version if you're feeling good.");
    } else if (p.w.headStart) {
      // Friendly first tastes: a short strength session, a walk and jog, and a stretch.
      const open = function (s) { return p.remBonus.indexOf(s) >= 0; };
      if (open("strengthA")) add("strengthA", "short", "A short, friendly first strength session. Nothing is required before Week 1.");
      if (open("run1")) add("run1", "full", "A gentle first taste of walking and jogging.");
      if (open("mobility")) add("mobility", "full", "Or simply an easy walk and some stretches.");
      p.remBonus.forEach(function (s) { if (list.length < 3) add(s, "short", "A short, easy head start."); });
    } else {
      p.remBonus.slice(0, 2).forEach(function (s) { add(s, "full", "A bonus. Your main workouts are already done!"); });
      add(p.remBonus[0] || "mobility", "short", "A short, easy bonus.");
    }
    return list.slice(0, 3);
  }

  // ——— Active session ———
  function initLogs(w) {
    const logs = {};
    w.blocks.forEach(function (b) {
      b.items.forEach(function (it) {
        const k = it.logKey;
        if (it.log === "intervals") logs[k] = { type: "intervals", rounds: new Array(it.rounds).fill(false), minutes: "", done: false };
        else if (it.log === "walk") logs[k] = { type: "walk", minutes: "", pack: it.pack ? String(it.pack) : "", incline: it.incline ? String(it.incline) : "", distance: "", done: false };
        else if (it.log === "check") logs[k] = { type: "check", done: false };
        else {
          const sets = [];
          for (let i = 0; i < (it.sets || 1); i++) sets.push({ w: it.weightDefault ? String(it.weightDefault) : "", v: "", done: false });
          logs[k] = { type: "sets", kind: it.log, sets: sets, done: false };
        }
      });
    });
    return logs;
  }
  function itemComplete(log) {
    if (!log) return false;
    if (log.type === "sets") return log.done || (log.sets.length > 0 && log.sets.every(function (s) { return s.done; }));
    if (log.type === "intervals") return log.done || (log.rounds.length > 0 && log.rounds.every(Boolean));
    return !!log.done;
  }
  function sessionProgress(s) {
    let total = 0, done = 0;
    s.workout.blocks.forEach(function (b) { b.items.forEach(function (it) { total++; if (itemComplete(s.logs[it.logKey])) done++; }); });
    return { total: total, done: done };
  }
  function sessionHasProgress(s) {
    if (!s) return false;
    if ((s.warmup || []).some(Boolean)) return true;
    if (s.timer && s.timer.elapsed > 0) return true;
    return Object.keys(s.logs).some(function (k) {
      const l = s.logs[k];
      if (l.done) return true;
      if (l.type === "sets") return l.sets.some(function (x) { return x.done || x.v; });
      if (l.type === "intervals") return l.rounds.some(Boolean) || !!l.minutes;
      if (l.type === "walk") return !!l.minutes || !!l.distance;
      return false;
    });
  }

  function startWorkout(slotId, variant) {
    const w = weekInfo();
    const cur = week.activeSession;
    if (cur && !(cur.slotId === slotId && cur.variant === variant)) {
      if (sessionHasProgress(cur) && !confirm("You've already logged some of \"" + cur.workout.title + "\". Switch workouts and lose that?")) return;
    }
    if (cur && cur.slotId === slotId && cur.variant === variant) { showActive(); return; }
    const workout = buildWorkout(slotId, variant);
    week.activeSession = {
      slotId: slotId, variant: variant, dayKey: w.todayKey, startedAt: Date.now(),
      workout: workout, logs: initLogs(workout), warmup: workout.warmup.map(function () { return false; }), timer: null,
    };
    saveWeek();
    closeDetail();
    showActive();
  }

  function extractRecords(s) {
    const out = {};
    function put(id, v) { v = Number(v); if (!id || !(v > 0)) return; if (!out[id] || v > out[id]) out[id] = v; }
    s.workout.blocks.forEach(function (b) {
      b.items.forEach(function (it) {
        const log = s.logs[it.logKey];
        if (!log || !it.record) return;
        if (log.type === "sets") {
          log.sets.forEach(function (x) {
            if (!x.done && !x.v) return;
            if (it.record === "bbrow") { if (Number(x.v) >= 8) put("bbrow", x.w); }
            else put(it.record, x.v);
          });
        } else if (log.type === "intervals") {
          if (log.rounds.some(Boolean)) put("jog", it.jog);
        } else if (log.type === "walk") {
          if (it.record === "jog") put("jog", log.minutes);
          else {
            put("hike", log.minutes);
            if (Number(log.minutes) >= 20) put("pack", log.pack);
          }
        }
      });
    });
    return out;
  }

  const PILLAR_SHORT = { run: "Walk and jog", strength: "Strength", hike: "Hiking", bow: "Bow strength" };
  const HIP_PILLARS = ["run", "hike", "strength"]; // legs, running and hiking; the bow path is never affected by hips
  function applyRating(p, rating, hips) {
    const st = levels[p] || (levels[p] = { level: 1, justRight: 0 });
    const max = PILLARS[p].max;
    const before = st.level;
    const name = PILLAR_SHORT[p];
    let msg;
    const hipAffected = HIP_PILLARS.indexOf(p) >= 0 && (hips === "achy" || hips === "pinchy");
    if (hipAffected && hips === "pinchy") {
      st.level = Math.max(1, before - 1); st.justRight = 0;
      msg = st.level < before
        ? name + ": eases back a step next time, since your hips felt pinchy or sore."
        : name + ": stays at the gentlest step, since your hips felt pinchy or sore.";
      return { pillar: p, before: before, after: st.level, msg: msg };
    }
    if (hipAffected && hips === "achy" && rating !== "hard") {
      msg = name + ": stays on the same step next time because your hips were a little achy. That's a smart way to let things settle.";
      return { pillar: p, before: before, after: st.level, msg: msg };
    }
    if (rating === "easy") {
      st.level = Math.min(max, before + 1); st.justRight = 0;
      msg = st.level > before ? name + ": next time steps up a little (" + stepText(p, st.level).toLowerCase() + ")." : name + ": you're at the top step, so keep enjoying it!";
    } else if (rating === "right") {
      st.justRight = (st.justRight || 0) + 1;
      if (st.justRight >= 2 && before < max) { st.level = before + 1; st.justRight = 0; msg = name + ": that's twice feeling just right at this step, so next time moves up a little."; }
      else msg = name + ": same step next time so it can settle in.";
    } else {
      st.level = Math.max(1, before - 1); st.justRight = 0;
      if (st.level < before) msg = p === "run"
        ? "Walk and jog: next time repeats an easier step. Repeating a week is completely normal, and it's how running starts to feel good."
        : name + ": next time eases back a step. That's not going backwards; it's how lasting progress is built.";
      else msg = name + ": we'll stay at the gentlest step. Shorten it anytime; even 10 minutes counts.";
    }
    return { pillar: p, before: before, after: st.level, msg: msg };
  }
  const FEEL_LABEL = { easy: "Easy", right: "Just right", hard: "Too hard" };
  const FEEL_LEAD = {
    easy: "Love that! You're getting stronger.",
    right: "Just right is the sweet spot.",
    hard: "Thank you for being honest. Showing up is what counts.",
  };

  const HIPS_LABEL = { fine: "Fine", achy: "A little achy", pinchy: "Pinchy or sore" };
  function finishWorkout(rating, hips) {
    hips = hips || "fine";
    const s = week.activeSession;
    if (!s) return;
    const w = s.workout;
    const wi = weekInfo();
    const levelsBefore = clone(levels);
    const changes = w.pillars.map(function (p) { return applyRating(p, rating, hips); });
    saveLevels();
    const found = extractRecords(s);
    const toasts = [];
    const firsts = [];
    const recordIds = [];
    Object.keys(found).forEach(function (id) {
      const had = (records[id] || []).length > 0;
      const prev = best(id);
      const v = found[id];
      const m = metric(id);
      if (s.slotId === "checkin" || !had || v > prev) {
        const e = addRecord(id, v, wi.todayKey, w.title, "workout");
        recordIds.push({ metric: id, id: e.id });
        if (had && v > prev) toasts.push("New personal best! " + m.label + ": " + fmtVal(id, v) + " (was " + fmtVal(id, prev) + ").");
        else if (!had) firsts.push(m.label + ": " + fmtVal(id, v));
      }
    });
    if (firsts.length === 1) toasts.push("Starting point saved. " + firsts[0] + ". Beat it next time for a celebration!");
    else if (firsts.length > 1) toasts.push("Saved " + firsts.length + " starting points in Progress. " + firsts.join("; ") + ".");
    let minutes = 0;
    Object.keys(s.logs).forEach(function (k) { const l = s.logs[k]; if ((l.type === "walk" || l.type === "intervals") && Number(l.minutes) > 0) minutes += Number(l.minutes); });
    if (!minutes) minutes = w.minutes;
    let msg = FEEL_LEAD[rating];
    if (changes.length) msg += " " + changes.map(function (c) { return c.msg; }).join(" ");
    else msg += w.slotId === "checkin" ? " Your numbers are saved in Progress." : " Stretch days stay easy on purpose.";
    if (hips === "pinchy") msg += " Be kind to your hips for a day or two. " + PAIN_RULE;
    else if (hips === "achy") msg += " A little achiness is common. Notice how your hips feel tomorrow morning.";
    const h = { id: uid(), date: wi.todayKey, slotId: s.slotId, variant: s.variant, title: w.title, minutes: minutes, rating: rating, hips: hips, pillars: w.pillars, ts: Date.now() };
    history.push(h);
    saveHistory();
    week.completed[s.slotId] = { dayKey: wi.todayKey, title: w.title, rating: rating, hips: hips, variant: s.variant, historyId: h.id, levelsBefore: levelsBefore, recordIds: recordIds, message: msg, minutes: minutes };
    if (s.slotId === "checkin") week.checkinDone = true;
    week.activeSession = null;
    saveWeek();
    stopTicker();
    closeRating();
    hideActive();
    setTab("today");
    render();
    if (toasts.length) showToasts(toasts);
    else showToasts(["Workout saved. Nice work!"]);
  }

  function todaysCompletion() {
    const k = weekInfo().todayKey;
    const id = Object.keys(week.completed).find(function (s) { return week.completed[s].dayKey === k; });
    return id ? { slotId: id, entry: week.completed[id] } : null;
  }

  function undoToday() {
    const c = todaysCompletion();
    if (!c) return;
    if (!confirm("Undo \"" + c.entry.title + "\" for today? Your levels go back to how they were before it, and you can pick again.")) return;
    if (c.entry.levelsBefore) { levels = Object.assign(defaultLevels(), c.entry.levelsBefore); saveLevels(); }
    history = history.filter(function (h) { return h.id !== c.entry.historyId; });
    saveHistory();
    (c.entry.recordIds || []).forEach(function (r) {
      if (records[r.metric]) records[r.metric] = records[r.metric].filter(function (e) { return e.id !== r.id; });
    });
    saveRecords();
    if (c.slotId === "checkin") week.checkinDone = false;
    delete week.completed[c.slotId];
    saveWeek();
    render();
  }

  function abandonWorkout() {
    const s = week.activeSession;
    if (!s) return;
    if (sessionHasProgress(s) && !confirm("Stop this workout without saving it? What you've logged so far will be cleared.")) return;
    if (!sessionHasProgress(s) && !confirm("Leave this workout? You can pick any workout again from Today.")) return;
    week.activeSession = null;
    saveWeek();
    stopTicker();
    hideActive();
    setTab("today");
    render();
  }

  function resetWeek() {
    if (!confirm("Reset this week? This clears this week's check-marks so the board starts fresh. Your levels, history and personal bests stay.")) return;
    week = defaultWeek();
    saveWeek();
    stopTicker();
    hideActive();
    render();
  }

  // ——— Rendering helpers ———
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function minutesLabel(m) { return "About " + m + " min"; }

  function cuesHtml(it) {
    if (!it.how && !it.feel && !it.easier) return "";
    return '<details class="cues"><summary>How to do it</summary>' +
      (it.how ? "<p><strong>How:</strong> " + esc(it.how) + "</p>" : "") +
      (it.feel ? "<p><strong>What it should feel like:</strong> " + esc(it.feel) + "</p>" : "") +
      (it.easier ? "<p><strong>Easier version:</strong> " + esc(it.easier) + "</p>" : "") +
      "</details>";
  }

  function workoutPreviewHtml(w) {
    let h = '<p class="why">' + esc(w.why) + "</p>";
    h += '<div class="chip-row"><span class="chip">' + esc(minutesLabel(w.minutes)) + '</span><span class="chip loc">' + esc(w.location) + "</span></div>";
    if (w.warmup && w.warmup.length) {
      h += '<section class="block"><h4>Warm-up</h4><ul class="plain-list">' + w.warmup.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></section>";
    }
    w.blocks.forEach(function (b) {
      h += '<section class="block"><h4>' + esc(b.name) + "</h4>" + (b.intro ? '<p class="block-intro">' + esc(b.intro) + "</p>" : "");
      b.items.forEach(function (it) {
        h += '<div class="exercise"><div class="ex-name">' + esc(it.name) + '</div><div class="ex-rx">' + esc(prescription(it)) + "</div>" +
          (it.tip ? '<div class="ex-tip">' + esc(it.tip) + "</div>" : "") + cuesHtml(it) + "</div>";
      });
      h += "</section>";
    });
    if (w.notes && w.notes.length) h += '<section class="block"><h4>Good to know</h4><ul class="plain-list">' + w.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul></section>";
    return h;
  }

  // ——— Detail sheet ———
  let detailCtx = null;
  function openDetail(slotId, variant) {
    const w = buildWorkout(slotId, variant);
    const p = planWeek();
    detailCtx = { slotId: slotId, variant: variant };
    $("detail-eyebrow").textContent = SLOTS[slotId].label + (p.main.indexOf(slotId) >= 0 ? " · Main workout" : p.w.headStart ? " · Head start" : " · Bonus");
    $("detail-title").textContent = w.title;
    $("detail-meta").textContent = minutesLabel(w.minutes) + " · " + w.location;
    $("detail-body").innerHTML = workoutPreviewHtml(w);
    const doneToday = !!todaysCompletion();
    const btn = $("btn-start");
    const cur = week.activeSession;
    if (doneToday) { btn.disabled = true; btn.textContent = "Already done a workout today"; }
    else if (week.completed[slotId]) { btn.disabled = true; btn.textContent = "Done this week"; }
    else { btn.disabled = false; btn.textContent = cur && cur.slotId === slotId && cur.variant === variant ? "Continue this workout" : "Start this workout"; }
    $("detail").classList.remove("hidden");
    $("detail").querySelector(".sheet").scrollTop = 0;
  }
  function closeDetail() { $("detail").classList.add("hidden"); detailCtx = null; }

  // ——— Tabs / views ———
  let currentTab = "today";
  function setTab(v) {
    currentTab = v;
    document.querySelectorAll(".tab").forEach(function (t) { const on = t.dataset.view === v; t.classList.toggle("active", on); t.setAttribute("aria-selected", on ? "true" : "false"); });
    document.querySelectorAll("main > .view").forEach(function (s) { s.hidden = s.id !== "view-" + v; });
    window.scrollTo(0, 0);
  }
  function showActive() {
    $("app").classList.add("in-session");
    $("view-active").hidden = false;
    document.querySelectorAll("main > .view").forEach(function (s) { s.hidden = true; });
    renderActive();
    window.scrollTo(0, 0);
    startTickerIfNeeded();
  }
  function hideActive() {
    $("app").classList.remove("in-session");
    $("view-active").hidden = true;
    stopTicker();
    setTab(currentTab);
  }

  function render() {
    const w = weekInfo();
    $("week-label").textContent = w.headStart
      ? "Head start · Week 1 begins Mon " + shortDate(WEEK1_MONDAY)
      : "Week " + w.num + " · " + shortDate(w.monday) + " to " + shortDate(addDays(w.monday, 6));
    renderToday();
    renderWeek();
    renderProgress();
    renderGoals();
  }

  // ——— Today ———
  function optionCardHtml(o) {
    const w = buildWorkout(o.slotId, o.variant);
    return '<button type="button" class="option-card' + (o.variant === "short" ? " is-short" : "") + '" data-open="' + o.slotId + '" data-variant="' + o.variant + '">' +
      '<div class="chip-row"><span class="chip ' + (o.isMain ? "main" : "bonus") + '">' + (o.isMain ? "Main workout" : o.headStart ? "Head start" : "Bonus") + "</span>" +
      '<span class="chip">' + esc(minutesLabel(w.minutes)) + '</span><span class="chip loc">' + esc(w.location) + "</span></div>" +
      "<h3>" + esc(w.title) + "</h3>" +
      '<p class="opt-why">' + esc(w.why) + "</p>" +
      '<p class="opt-reason">' + esc(o.reason) + "</p>" +
      '<span class="opt-go">See the workout →</span></button>';
  }

  function renderToday() {
    const p = planWeek();
    const w = p.w;
    $("today-date").textContent = longDate(w.now);
    const body = $("today-body");
    const done = todaysCompletion();
    const act = p.act;
    let h = "";
    if (done) {
      $("today-title").textContent = "Done for today";
      $("today-sub").textContent = "Rest and recovery are part of the plan. See you next time!";
      const e = done.entry;
      h += '<div class="done-card"><span class="done-badge">Done ✓</span><h2>' + esc(e.title) + "</h2>" +
        '<p class="done-feel">You said it felt: <strong>' + esc(FEEL_LABEL[e.rating] || "") + "</strong>" + (e.hips ? " · Hips: <strong>" + esc(HIPS_LABEL[e.hips] || "") + "</strong>" : "") + "</p>" +
        '<p class="done-msg">' + esc(e.message || "") + "</p>";
      const next = nextPlanned(p);
      if (next) h += '<p class="done-next">Next on your board: <strong>' + esc(next) + "</strong></p>";
      h += '<button type="button" class="btn-ghost" id="btn-undo">Undo today</button></div>';
      body.innerHTML = h;
      $("btn-undo").addEventListener("click", undoToday);
      return;
    }
    if (act) {
      const pr = sessionProgress(act);
      h += '<div class="continue-card"><p class="eyebrow">In progress</p><h2>' + esc(act.workout.title) + "</h2><p>" + pr.done + " of " + pr.total + " exercises checked off.</p>" +
        '<button type="button" class="btn-primary" id="btn-continue">Continue workout</button></div>';
    }
    const t = p.byDay[w.todayKey];
    if (w.headStart) {
      $("today-title").textContent = "Head start";
      $("today-sub").textContent = "Week 1 begins Monday. Nothing is required yet, but if you'd like to try something, anything you do is a lovely head start.";
    } else if (!p.remMain.length) {
      $("today-title").textContent = "All main workouts done!";
      $("today-sub").textContent = "That's your whole week. Anything more is a bonus, and resting is a great choice too.";
    } else if (t.plan && t.planType === "main") {
      $("today-title").textContent = "Pick today's workout";
      $("today-sub").textContent = "Choose whichever fits your day. If you pick something different, the rest of the week reshuffles.";
    } else {
      $("today-title").textContent = "Today is a rest day 🌿";
      $("today-sub").textContent = "Resting is part of getting stronger. If you feel like moving, here are some easy choices.";
    }
    if (!act) {
      h += '<div class="options">' + todayOptions(p).map(optionCardHtml).join("") + "</div>";
      if (isCheckinWeek() && !week.checkinDone) {
        h += '<div class="checkin-card"><p class="eyebrow">Optional this week</p><h3>Gentle check-in</h3><p>About 20 minutes: a hang, some rows, Y-T-W raises, a plank and an easy jog, all at a comfortable effort. It shows your progress over time.</p>' +
          '<button type="button" class="btn-ghost" data-open="checkin" data-variant="full">See the check-in</button></div>';
      }
      h += '<p class="gentle-note">Missed a day? No problem. The week simply reshuffles around whatever you do.</p>';
    }
    body.innerHTML = h;
    const c = $("btn-continue");
    if (c) c.addEventListener("click", function () { if (week.activeSession) showActive(); });
  }

  function nextPlanned(p) {
    const w = p.w;
    for (let i = w.todayIdx + 1; i < 7; i++) {
      const d = w.days[i];
      const t = p.byDay[d.key];
      if (t.plan) return SLOTS[t.plan].label + " on " + d.name + (t.planType === "bonus" ? " (optional)" : "");
    }
    return null;
  }

  // ——— Active workout ———
  function fmtClock(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(t / 60) + ":" + pad2(t % 60);
  }
  function findIntervalItem(s) {
    let found = null;
    s.workout.blocks.forEach(function (b) { b.items.forEach(function (it) { if (it.log === "intervals") found = it; }); });
    return found;
  }
  function timerCalc(s, it) {
    const t = s.timer || { running: false, startedAt: 0, elapsed: 0 };
    const el = t.elapsed + (t.running ? Date.now() - t.startedAt : 0);
    let acc = 0;
    for (let i = 0; i < it.phases.length; i++) {
      const len = it.phases[i].secs * 1000;
      if (el < acc + len) return { idx: i, remain: acc + len - el, el: el, frac: (el - acc) / len, finished: false };
      acc += len;
    }
    return { idx: it.phases.length, remain: 0, el: acc, frac: 1, finished: true, total: acc };
  }

  function timerHtml(s, it) {
    const c = timerCalc(s, it);
    const running = s.timer && s.timer.running;
    const ph = it.phases[Math.min(c.idx, it.phases.length - 1)];
    const next = it.phases[c.idx + 1];
    const started = s.timer && s.timer.elapsed + (running ? 1 : 0) > 0;
    return '<div class="timer' + (ph.kind === "jog" && !c.finished ? " is-jog" : "") + '" id="timer">' +
      '<div class="timer-phase" id="tm-phase">' + esc(c.finished ? "All done. Nice work!" : started ? ph.label : "Ready when you are") + "</div>" +
      '<div class="timer-time" id="tm-time">' + (c.finished ? "0:00" : fmtClock(c.remain)) + "</div>" +
      '<div class="timer-next" id="tm-next">' + esc(c.finished ? "Tap Finish workout below when you're ready." : next ? "Next: " + next.label.toLowerCase() + " for " + fmtMin(next.secs / 60) : "Last part!") + "</div>" +
      '<div class="timer-bar"><div class="timer-fill" id="tm-fill" style="width:' + Math.round(c.frac * 100) + '%"></div></div>' +
      '<div class="timer-btns">' +
      (c.finished ? "" : running
        ? '<button type="button" class="btn-secondary" data-action="timer-pause">Pause</button>'
        : '<button type="button" class="btn-primary" data-action="timer-start">' + (started ? "Resume timer" : "Start timer") + "</button>") +
      (started || c.finished ? '<button type="button" class="btn-text" data-action="timer-reset">Reset timer</button>' : "") +
      "</div><p class=\"timer-hint\">Your phone will buzz (where supported) and beep when it's time to switch.</p></div>";
  }

  function logItemHtml(s, it) {
    const k = it.logKey;
    const log = s.logs[k];
    const complete = itemComplete(log);
    let h = '<div class="log-ex' + (complete ? " complete" : "") + '" data-key="' + k + '">';
    h += '<div class="log-ex-head"><div class="log-ex-name">' + esc(it.name) + '</div><div class="log-ex-rx">' + esc(prescription(it)) + "</div></div>";
    if (it.tip) h += '<div class="ex-tip">' + esc(it.tip) + "</div>";
    h += cuesHtml(it);
    if (log.type === "sets") {
      const kind = log.kind;
      const bw = !!it.bw;
      const valLabel = kind === "hold" || kind === "carry" ? "Seconds" : "Reps";
      const wLabel = bw ? "" : it.weightLabel || (kind === "carry" ? "Lb" : "Weight (lb)");
      h += '<div class="set-rows"><div class="set-row set-head" aria-hidden="true"><span></span><span>' + esc(wLabel) + "</span><span>" + valLabel + "</span><span></span></div>";
      log.sets.forEach(function (x, i) {
        h += '<div class="set-row" data-set="' + i + '"><span class="set-label">Set ' + (i + 1) + "</span>" +
          (bw ? '<span class="set-bw">Body weight</span>' : '<input type="text" inputmode="decimal" data-field="w" placeholder="lb" value="' + esc(x.w) + '" aria-label="' + esc(wLabel) + '" />') +
          '<input type="text" inputmode="numeric" data-field="v" placeholder="' + (it.target || "") + '" value="' + esc(x.v) + '" aria-label="' + valLabel + '" />' +
          '<button type="button" class="set-check' + (x.done ? " on" : "") + '" data-action="toggle-set" aria-label="Mark set ' + (i + 1) + ' done">' + (x.done ? "✓" : "") + "</button></div>";
      });
      h += "</div>";
      h += '<p class="log-hint">Tap the circle when a set is done. If you leave the box empty, it fills in the planned ' + (valLabel === "Reps" ? "reps" : "seconds") + ".</p>";
    } else if (log.type === "intervals") {
      h += timerHtml(s, it);
      h += '<div class="rounds">';
      log.rounds.forEach(function (r, i) {
        h += '<button type="button" class="round' + (r ? " on" : "") + '" data-action="toggle-round" data-round="' + i + '">' + (it.cont ? "Easy jog" : "Round " + (i + 1)) + (r ? " ✓" : "") + "</button>";
      });
      h += "</div>";
      h += '<label class="field inline"><span>Total minutes (optional)</span><input type="text" inputmode="decimal" data-field="minutes" value="' + esc(log.minutes) + '" placeholder="min" /></label>';
    } else if (log.type === "walk") {
      const fields = it.fields || ["minutes", "incline", "pack", "distance"];
      h += '<div class="walk-fields">';
      if (fields.indexOf("minutes") >= 0) h += '<label class="field"><span>Minutes</span><input type="text" inputmode="decimal" data-field="minutes" value="' + esc(log.minutes) + '" placeholder="' + (it.targetMin || "min") + '" /></label>';
      if (fields.indexOf("incline") >= 0 && (it.incline || eq("treadmill"))) h += '<label class="field"><span>Incline % (treadmill)</span><input type="text" inputmode="decimal" data-field="incline" value="' + esc(log.incline) + '" placeholder="optional" /></label>';
      if (fields.indexOf("pack") >= 0 && it.showPack) h += '<label class="field"><span>Pack weight (lb)</span><input type="text" inputmode="decimal" data-field="pack" value="' + esc(log.pack) + '" placeholder="optional" /></label>';
      if (fields.indexOf("distance") >= 0) h += '<label class="field"><span>Distance (miles)</span><input type="text" inputmode="decimal" data-field="distance" value="' + esc(log.distance) + '" placeholder="optional" /></label>';
      h += "</div>";
      h += '<button type="button" class="btn-ex-done' + (log.done ? " on" : "") + '" data-action="toggle-done">' + (log.done ? "Done ✓" : "Mark done") + "</button>";
    } else {
      h += '<button type="button" class="btn-ex-done' + (log.done ? " on" : "") + '" data-action="toggle-done">' + (log.done ? "Done ✓" : "Mark done") + "</button>";
    }
    h += "</div>";
    return h;
  }

  function renderActive() {
    const s = week.activeSession;
    if (!s) return;
    const w = s.workout;
    $("active-eyebrow").textContent = SLOTS[s.slotId].label;
    $("active-title").textContent = w.title;
    $("active-meta").textContent = minutesLabel(w.minutes) + " · " + w.location;
    const pr = sessionProgress(s);
    $("active-progress").textContent = pr.done + " of " + pr.total + " exercises checked off";
    let h = "";
    if (w.warmup.length) {
      h += '<section class="block"><h4>Warm-up</h4>';
      w.warmup.forEach(function (x, i) {
        h += '<label class="warmup-check' + (s.warmup[i] ? " done" : "") + '"><input type="checkbox" data-warmup="' + i + '"' + (s.warmup[i] ? " checked" : "") + " /><span>" + esc(x) + "</span></label>";
      });
      h += "</section>";
    }
    w.blocks.forEach(function (b) {
      h += '<section class="block"><h4>' + esc(b.name) + "</h4>" + (b.intro ? '<p class="block-intro">' + esc(b.intro) + "</p>" : "");
      b.items.forEach(function (it) { h += logItemHtml(s, it); });
      h += "</section>";
    });
    if (w.notes.length) h += '<section class="block"><h4>Good to know</h4><ul class="plain-list">' + w.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul></section>";
    $("active-body").innerHTML = h;
  }

  function locateLog(el) {
    const s = week.activeSession;
    const box = el.closest("[data-key]");
    if (!s || !box) return null;
    const log = s.logs[box.dataset.key];
    const row = el.closest("[data-set]");
    let it = null;
    s.workout.blocks.forEach(function (b) { b.items.forEach(function (x) { if (x.logKey === box.dataset.key) it = x; }); });
    return { s: s, log: log, item: it, setIdx: row ? Number(row.dataset.set) : -1 };
  }

  function onActiveInput(e) {
    const el = e.target;
    if (el.dataset.warmup != null) {
      week.activeSession.warmup[Number(el.dataset.warmup)] = el.checked;
      el.closest(".warmup-check").classList.toggle("done", el.checked);
      saveWeek();
      return;
    }
    const f = el.dataset.field;
    if (!f) return;
    const L = locateLog(el);
    if (!L) return;
    if (L.log.type === "sets" && L.setIdx >= 0) L.log.sets[L.setIdx][f] = el.value.trim();
    else L.log[f] = el.value.trim();
    saveWeek();
  }

  function onActiveClick(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const a = btn.dataset.action;
    const s = week.activeSession;
    if (!s) return;
    if (a === "timer-start" || a === "timer-pause" || a === "timer-reset") { timerAction(a); return; }
    const L = locateLog(btn);
    if (!L) return;
    if (a === "toggle-set") {
      const x = L.log.sets[L.setIdx];
      x.done = !x.done;
      if (x.done && !x.v && L.item.target) x.v = String(L.item.target);
    } else if (a === "toggle-round") {
      const i = Number(btn.dataset.round);
      L.log.rounds[i] = !L.log.rounds[i];
    } else if (a === "toggle-done") {
      L.log.done = !L.log.done;
      if (L.log.done && L.log.type === "walk" && !L.log.minutes && L.item.targetMin) L.log.minutes = String(L.item.targetMin);
    }
    saveWeek();
    renderActive();
  }

  // ——— Interval timer (refresh-safe: based on timestamps saved in the session) ———
  let ticker = null, lastPhaseIdx = -1, audioCtx = null;
  function cue() {
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* ignore */ }
    try {
      if (!audioCtx) return;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; g.gain.value = 0.15;
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.25);
    } catch (e) { /* ignore */ }
  }
  function timerAction(a) {
    const s = week.activeSession;
    const it = findIntervalItem(s);
    if (!it) return;
    if (!s.timer) s.timer = { running: false, startedAt: 0, elapsed: 0 };
    if (a === "timer-start") {
      try { if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
      s.timer.running = true; s.timer.startedAt = Date.now();
    } else if (a === "timer-pause") {
      s.timer.elapsed += Date.now() - s.timer.startedAt; s.timer.running = false;
    } else if (a === "timer-reset") {
      if (!confirm("Reset the timer to the start?")) return;
      s.timer = null;
    }
    lastPhaseIdx = -1;
    saveWeek();
    renderActive();
    startTickerIfNeeded();
  }
  function startTickerIfNeeded() {
    stopTicker();
    const s = week.activeSession;
    if (!s || !s.timer || !s.timer.running) return;
    ticker = setInterval(tick, 500);
    tick();
  }
  function stopTicker() { if (ticker) clearInterval(ticker); ticker = null; }
  function tick() {
    const s = week.activeSession;
    if (!s || !s.timer || !s.timer.running) { stopTicker(); return; }
    const it = findIntervalItem(s);
    if (!it) { stopTicker(); return; }
    const c = timerCalc(s, it);
    const log = s.logs[it.logKey];
    let changed = false;
    // Mark every jog phase that has fully passed as a completed round
    for (let i = 0; i < Math.min(c.idx, it.phases.length); i++) {
      const ph = it.phases[i];
      if (ph.kind === "jog" && ph.round != null && !log.rounds[ph.round]) { log.rounds[ph.round] = true; changed = true; }
    }
    if (lastPhaseIdx >= 0 && c.idx !== lastPhaseIdx) cue();
    const phaseChanged = c.idx !== lastPhaseIdx;
    lastPhaseIdx = c.idx;
    if (c.finished) {
      s.timer.running = false; s.timer.elapsed = c.total;
      if (!log.minutes) log.minutes = String(Math.round(c.total / 60000));
      saveWeek(); stopTicker(); renderActive();
      return;
    }
    if (changed || phaseChanged) { saveWeek(); renderActive(); return; }
    const t = $("tm-time"); if (t) t.textContent = fmtClock(c.remain);
    const f = $("tm-fill"); if (f) f.style.width = Math.round(c.frac * 100) + "%";
  }

  // ——— Rating sheet ———
  let ratingSel = null, hipsSel = null;
  function updateRatingUi() {
    document.querySelectorAll("#rating [data-rate]").forEach(function (b) { b.classList.toggle("on", b.dataset.rate === ratingSel); b.setAttribute("aria-pressed", b.dataset.rate === ratingSel ? "true" : "false"); });
    document.querySelectorAll("#rating [data-hips]").forEach(function (b) { b.classList.toggle("on", b.dataset.hips === hipsSel); b.setAttribute("aria-pressed", b.dataset.hips === hipsSel ? "true" : "false"); });
    const btn = $("btn-save-rating");
    btn.disabled = !(ratingSel && hipsSel);
    btn.textContent = ratingSel && hipsSel ? "Save workout" : "Choose both answers to save";
  }
  function openRating() {
    const s = week.activeSession;
    if (!s) return;
    if (!sessionHasProgress(s) && !confirm("Nothing is checked off yet. Finish anyway?")) return;
    ratingSel = null; hipsSel = null;
    updateRatingUi();
    $("rating").classList.remove("hidden");
  }
  function closeRating() { $("rating").classList.add("hidden"); }

  // ——— Week board ———
  function renderWeek() {
    const p = planWeek();
    const w = p.w;
    const mainDone = p.main.filter(function (s) { return week.completed[s]; }).length;
    const bonusDone = Object.keys(week.completed).filter(function (s) { return p.main.indexOf(s) < 0; }).length;
    let h = "";
    if (w.headStart) {
      h += '<div class="week-summary"><p class="big">Head start days</p><p>Week 1 begins Monday, ' + esc(shortDate(WEEK1_MONDAY)) + ". Nothing is required before then." +
        (bonusDone ? " You've already done " + bonusDone + " head-start " + (bonusDone === 1 ? "workout" : "workouts") + ". Wonderful!" : "") + "</p></div>";
    } else {
      const pct = p.main.length ? Math.round((mainDone / p.main.length) * 100) : 0;
      h += '<div class="week-summary"><p class="big">' + mainDone + " of " + p.main.length + " main workouts done</p>" +
        '<div class="progress-bar" aria-hidden="true"><div class="progress-fill" id="progress-fill" style="width:' + pct + '%"></div></div>' +
        "<p>" + (mainDone >= p.main.length ? "All main workouts are done this week. Anything more is a bonus!" : "Do them in any order, on any day. If you miss a day, the plan simply moves around it.") +
        (bonusDone ? " Plus " + bonusDone + " bonus " + (bonusDone === 1 ? "session" : "sessions") + "." : "") + "</p></div>";
    }
    h += '<div class="days">';
    w.days.forEach(function (d) {
      const t = p.byDay[d.key];
      const isToday = d.key === w.todayKey;
      const past = d.idx < w.todayIdx;
      let content = "";
      let cls = "day-row";
      if (isToday) cls += " today";
      if (past) cls += " past";
      if (t.done.length) {
        cls += " is-done";
        content = t.done.map(function (sid) {
          const e = week.completed[sid];
          return '<div class="slot done"><span class="slot-status">Done ✓</span><strong>' + esc(e.title) + '</strong><span class="slot-sub">Felt ' + esc((FEEL_LABEL[e.rating] || "").toLowerCase()) + "</span></div>";
        }).join("");
      } else if (t.active) {
        content = '<div class="slot active"><span class="slot-status">Started</span><strong>' + esc(week.activeSession.workout.title) + '</strong><span class="slot-sub">Tap Finish workout when you\'re done to check it off.</span></div>';
      } else if (t.plan) {
        const isMain = t.planType === "main";
        content = '<button type="button" class="slot ' + (isMain ? "planned" : "optional") + '" data-open="' + t.plan + '" data-variant="full">' +
          '<span class="slot-status">' + (isMain ? "Planned" : "Optional") + "</span><strong>" + esc(SLOTS[t.plan].label) + "</strong>" +
          '<span class="slot-sub">' + esc(slotSubline(t.plan)) + "</span></button>";
      } else if (past) {
        content = '<div class="slot rest"><strong>Rest</strong></div>';
      } else {
        content = '<div class="slot rest"><strong>Rest day 🌿</strong><span class="slot-sub">Rest is part of the plan.</span></div>';
      }
      h += '<div class="' + cls + '"><div class="day-when"><strong>' + d.name + "</strong><span>" + esc(shortDate(d.date)) + "</span>" + (isToday ? '<em>Today</em>' : "") + '</div><div class="day-what">' + content + "</div></div>";
    });
    h += "</div>";
    if (p.overflow.length) {
      h += '<section class="block"><h4>Still open this week</h4><p class="block-intro">There are more workouts left than days. That\'s okay: do what fits, and the rest simply wait.</p>' +
        p.overflow.map(function (s) { return '<button type="button" class="slot planned" data-open="' + s + '" data-variant="full"><strong>' + esc(SLOTS[s].label) + '</strong><span class="slot-sub">' + esc(slotSubline(s)) + "</span></button>"; }).join("") + "</section>";
    }
    if (p.extras.length) {
      h += '<section class="block"><h4>Anytime extras</h4><p class="block-intro">Bonus easy movement. Never required.</p>' +
        p.extras.map(function (s) { return '<button type="button" class="slot optional" data-open="' + s + '" data-variant="full"><strong>' + esc(SLOTS[s].label) + '</strong><span class="slot-sub">' + esc(slotSubline(s)) + "</span></button>"; }).join("") + "</section>";
    }
    h += '<button type="button" class="btn-danger-ghost" id="btn-reset-week">Reset this week</button>';
    $("week-body").innerHTML = h;
    $("btn-reset-week").addEventListener("click", resetWeek);
  }
  function slotSubline(s) {
    const w = buildWorkout(s, "full");
    return (w.title !== SLOTS[s].label ? w.title + " · " : "") + "about " + w.minutes + " min";
  }

  // ——— Progress ———
  function renderProgress() {
    const wi = weekInfo();
    const thisWeek = history.filter(function (h) { return h.date >= dateKey(wi.monday); });
    const mins = history.reduce(function (a, h) { return a + (Number(h.minutes) || 0); }, 0);
    let h = '<div class="tiles"><div class="tile"><strong>' + thisWeek.length + "</strong><span>workouts this week</span></div>" +
      '<div class="tile"><strong>' + history.length + "</strong><span>workouts in total</span></div>" +
      '<div class="tile"><strong>' + Math.round(mins) + "</strong><span>minutes moved</span></div></div>";

    h += '<section class="card"><h3>Personal bests</h3><p class="card-intro">These update on their own from your workouts and check-ins. Beat one and you\'ll get a little celebration.</p>';
    const withData = METRICS.filter(function (m) { return (records[m.id] || []).length; });
    if (!withData.length) h += '<p class="empty">Nothing yet. Your first workouts and check-in will fill this in.</p>';
    withData.forEach(function (m) {
      const list = metricEntries(m.id);
      const b = best(m.id);
      h += '<div class="metric"><div class="metric-head"><span class="metric-name">' + esc(m.label) + '</span><span class="metric-best">Best: ' + esc(fmtVal(m.id, b)) + "</span></div>" +
        '<ul class="metric-history">' + list.slice(-5).reverse().map(function (e) {
          return "<li><span>" + esc(shortDate(keyToDate(e.date))) + "</span><span>" + esc(fmtVal(m.id, e.value)) + (e.note ? ' <em>' + esc(e.note) + "</em>" : "") + '</span><button type="button" class="icon-x" data-del-rec="' + m.id + '" data-id="' + e.id + '" aria-label="Delete entry">✕</button></li>';
        }).join("") + "</ul></div>";
    });
    h += '<details class="add-entry"><summary>Add an entry by hand</summary><form id="rec-form" class="rec-form">' +
      '<label class="field"><span>What</span><select id="rec-metric">' + METRICS.map(function (m) { return '<option value="' + m.id + '">' + esc(m.label) + " (" + m.unit + ")</option>"; }).join("") + "</select></label>" +
      '<p class="field-hint" id="rec-hint">' + esc(METRICS[0].hint) + "</p>" +
      '<label class="field"><span>Value</span><input type="text" inputmode="decimal" id="rec-value" placeholder="number" /></label>' +
      '<label class="field"><span>Date</span><input type="date" id="rec-date" value="' + wi.todayKey + '" /></label>' +
      '<label class="field"><span>Note (optional)</span><input type="text" id="rec-note" maxlength="60" placeholder="e.g. on my knees, trail name" /></label>' +
      '<button type="submit" class="btn-primary">Save entry</button><p class="form-msg" id="rec-msg"></p></form></details></section>';

    const nextCheck = wi.headStart ? "this week or in Week 1" : (wi.num % 4 === 1 ? "this week" : "Week " + (wi.num + (4 - ((wi.num - 1) % 4))));
    h += '<section class="card"><h3>Check-in days</h3><p class="card-intro">About once a month there\'s an optional gentle check-in on the Today screen: a hang, some rows, Y-T-W raises, a plank and an easy jog. Nothing all-out. Next one: ' + esc(nextCheck) + (week.checkinDone ? " (done this week ✓)" : "") + ".</p></section>";

    h += '<section class="card"><h3>Recent workouts</h3>';
    if (!history.length) h += '<p class="empty">Your finished workouts will show up here.</p>';
    else h += '<ul class="history">' + history.slice(-15).reverse().map(function (x) {
      return '<li><div><strong>' + esc(x.title) + "</strong><span>" + esc(shortDate(keyToDate(x.date))) + " · about " + Math.round(x.minutes) + " min" + (x.hips ? " · Hips: " + esc((HIPS_LABEL[x.hips] || "").toLowerCase()) : "") + '</span></div><span class="feel feel-' + x.rating + '">' + esc(FEEL_LABEL[x.rating] || "") + "</span></li>";
    }).join("") + "</ul>";
    h += "</section>";
    $("progress-body").innerHTML = h;

    const sel = $("rec-metric");
    sel.addEventListener("change", function () { $("rec-hint").textContent = metric(sel.value).hint; });
    $("rec-form").addEventListener("submit", function (e) {
      e.preventDefault();
      const id = sel.value;
      const v = parseFloat($("rec-value").value);
      const d = $("rec-date").value || wi.todayKey;
      const msg = $("rec-msg");
      if (!(v > 0)) { msg.textContent = "Please enter a number above zero."; msg.className = "form-msg err"; return; }
      const had = (records[id] || []).length > 0, prev = best(id);
      addRecord(id, v, d, $("rec-note").value.trim(), "manual");
      renderProgress();
      if (had && v > prev) showToasts(["New personal best! " + metric(id).label + ": " + fmtVal(id, v) + " (was " + fmtVal(id, prev) + ")."]);
      else showToasts(["Saved: " + metric(id).label + ", " + fmtVal(id, v) + "."]);
      renderGoals();
    });
    $("progress-body").querySelectorAll("[data-del-rec]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("Delete this entry?")) return;
        const m = b.dataset.delRec;
        records[m] = (records[m] || []).filter(function (e) { return e.id !== b.dataset.id; });
        saveRecords();
        renderProgress();
        renderGoals();
      });
    });
  }

  // ——— Goals ———
  function renderGoals() {
    const r = readiness();
    let h = "";
    h += '<section class="card goals-list"><h3>What we\'re building toward</h3><ol>' +
      "<li><strong>Running:</strong> from walk and jog intervals to about 30 minutes of easy, continuous jogging.</li>" +
      "<li><strong>General strength:</strong> feeling strong and capable in everyday life.</li>" +
      "<li><strong>Backcountry hiking:</strong> longer hikes, then a light pack, working toward multi-day trips.</li>" +
      "<li><strong>Drawing your bow:</strong> the back and shoulder strength to draw and hold your " + r.target + " lb bow.</li></ol></section>";

    // About you + hips
    h += '<section class="card"><h3>About you</h3><div class="about-grid">' +
      '<label class="field"><span>Name</span><input type="text" value="' + esc(profile.name || "Casandra") + '" disabled /></label>' +
      '<label class="field"><span>Age</span><input type="number" inputmode="numeric" min="16" max="99" id="pf-age" value="' + esc(profile.age || "") + '" /></label>' +
      '<label class="field"><span>Bow type</span><select id="pf-bowtype"><option value="Compound"' + (isCompound() ? " selected" : "") + '>Compound</option><option value="Recurve"' + (!isCompound() ? " selected" : "") + ">Recurve</option></select></label>" +
      '<label class="field"><span>Draw weight (lb)</span><input type="number" inputmode="numeric" min="10" max="80" id="pf-bowweight" value="' + esc(profile.bowWeight || 35) + '" /></label>' +
      '</div><p class="form-msg" id="pf-msg"></p></section>';
    h += '<section class="card note-card"><h3>Hips</h3><p>Two hip labrum repairs, more than a year out. The plan keeps squats to a box, skips deep hip stretches, and builds running and pack weight gradually.</p>' +
      '<p class="card-intro">If your physical therapist gave you lasting limits, those come first. ' + esc(PAIN_RULE) + "</p>" +
      '<p class="card-intro">After each workout you\'ll be asked how your hips felt. "A little achy" keeps your legs, running and hiking on the same step; "Pinchy or sore" eases them back a step. Your bow and upper-body path isn\'t affected.</p></section>';

    // Bow readiness
    h += '<section class="card readiness"><p class="eyebrow">Bow draw readiness toward ' + r.target + " lb (" + (isCompound() ? "compound" : "recurve") + " bow)</p>" +
      '<div class="ring-row"><div class="ring" style="--p:' + r.pct + '"><span>' + r.pct + '%</span></div><div><h3>' + esc(r.stage) + "</h3><p>" + r.met + " of " + r.markers.length + " markers reached.</p></div></div>";
    r.markers.forEach(function (m) {
      h += '<div class="marker' + (m.value >= m.target ? " met" : "") + '"><div class="marker-head"><span>' + esc(m.label) + "</span><span>" + (Math.round(m.value * 10) / 10) + " / " + m.target + " " + esc(m.unit) + (m.value >= m.target ? " ✓" : "") + '</span></div><div class="progress-bar small"><div class="progress-fill" style="width:' + Math.round(m.frac * 100) + '%"></div></div></div>';
    });
    if (r.pct === 0) h += '<p class="card-intro"><strong>Everyone starts at zero.</strong> Your bow-strength sessions and the gentle check-in fill these in automatically.</p>';
    if (r.ready) h += '<p class="ready-msg"><strong>Your strength markers say you\'re likely ready to try drawing your bow.</strong> When you\'re ready, have an archery shop check your draw length and set the draw weight, and start with a few smooth draws and slow let-downs.</p>';
    h += '<p class="card-intro">' + esc(bowIntro()) + "</p>";
    h += '<p class="card-intro">The workouts build that strength with rows, Y-T-W raises, shoulder rotations, hangs, grip and core work. There are no exercises with your bow inside the workouts. This tracker is a guide based on common strength markers, not a guarantee; every body and every bow is different.</p>';
    h += '<p class="card-intro">' + (isCompound() ? "Most compound bows can be turned down, so an archery shop can set a lighter draw weight to start and check your draw length." : "If your bow's draw weight can be adjusted, an archery shop can set a lighter weight to start and check your draw length.") + " Never dry-fire a bow (release it without an arrow). Hips matter too: a stable, tall stance and a strong core help you control the draw.</p></section>";

    // Paths
    h += '<section class="card"><h3>Where you are on each path</h3><p class="card-intro">Each path moves up when a workout feels easy (or just right twice in a row), stays put when it\'s just right, and eases back when it feels too hard. You can nudge it yourself too.</p>';
    Object.keys(PILLARS).forEach(function (p) {
      const L = lvl(p);
      h += '<div class="path"><div class="path-head"><strong>' + esc(PILLARS[p].name) + '</strong><span>Step ' + L + " of " + PILLARS[p].max + '</span></div><p>' + esc(stepText(p, L)) + '</p><div class="path-btns">' +
        '<button type="button" class="btn-small" data-level="' + p + '" data-dir="-1"' + (L <= 1 ? " disabled" : "") + '>Easier step</button>' +
        '<button type="button" class="btn-small" data-level="' + p + '" data-dir="1"' + (L >= PILLARS[p].max ? " disabled" : "") + ">Harder step</button></div></div>";
    });
    h += "</section>";

    // Plan settings
    h += '<section class="card"><h3>Training days per week</h3><p class="card-intro">Main workouts are the ones the week is built around. Everything else is bonus easy movement, and rest days are always welcome.</p><div class="seg" role="group" aria-label="Training days per week">';
    [2, 3, 4, 5].forEach(function (n) { h += '<button type="button" class="seg-btn' + (profile.trainingDays === n ? " on" : "") + '" data-days="' + n + '">' + n + "</button>"; });
    h += '</div><p class="field-hint">' + esc(daysExplainer(profile.trainingDays)) + "</p></section>";

    // Equipment
    h += '<section class="card"><h3>Equipment</h3><p class="card-intro">Workouts swap exercises to match what you have. For example, turning on light dumbbells adds reverse flys and lateral raises, and turning on bands adds pull-aparts, face pulls and band shoulder rotations.</p>';
    EQUIPMENT.forEach(function (e) {
      h += '<label class="toggle"><input type="checkbox" data-eq="' + e.id + '"' + (profile.equipment[e.id] ? " checked" : "") + " /><span>" + esc(e.label) + "</span></label>";
    });
    h += "</section>";

    h += '<section class="card"><h3>Safety, kindly</h3><ul class="plain-list"><li>Easy effort means you could chat in full sentences.</li><li>If anything hurts sharply, stop that exercise and skip it for today. A little muscle soreness a day or two later is normal.</li><li>This app is a friendly guide, not medical advice.</li></ul></section>';

    h += '<section class="card"><h3>Your data</h3><p class="card-intro">Everything is saved only in this browser on this device.</p><button type="button" class="btn-danger-ghost" id="btn-erase">Erase everything and start over</button></section>';
    $("goals-body").innerHTML = h;

    const saveAbout = function () {
      const age = parseInt($("pf-age").value, 10);
      const bw = parseFloat($("pf-bowweight").value);
      const msg = $("pf-msg");
      if (!(age >= 16 && age <= 99)) { msg.textContent = "Age should be a number between 16 and 99."; msg.className = "form-msg err"; return; }
      if (!(bw >= 10 && bw <= 80)) { msg.textContent = "Draw weight should be between 10 and 80 lb."; msg.className = "form-msg err"; return; }
      profile.age = age; profile.bowWeight = bw; profile.bowType = $("pf-bowtype").value === "Recurve" ? "Recurve" : "Compound";
      saveProfile();
      render();
      const m2 = $("pf-msg"); if (m2) { m2.textContent = "Saved."; m2.className = "form-msg"; }
    };
    ["pf-age", "pf-bowweight", "pf-bowtype"].forEach(function (id) { $(id).addEventListener("change", saveAbout); });
    $("goals-body").querySelectorAll("[data-level]").forEach(function (b) {
      b.addEventListener("click", function () {
        const p = b.dataset.level;
        levels[p].level = Math.max(1, Math.min(PILLARS[p].max, lvl(p) + Number(b.dataset.dir)));
        levels[p].justRight = 0;
        saveLevels();
        render();
      });
    });
    $("goals-body").querySelectorAll("[data-days]").forEach(function (b) {
      b.addEventListener("click", function () { profile.trainingDays = Number(b.dataset.days); saveProfile(); render(); });
    });
    $("goals-body").querySelectorAll("[data-eq]").forEach(function (c) {
      c.addEventListener("change", function () { profile.equipment[c.dataset.eq] = c.checked; saveProfile(); render(); });
    });
    $("btn-erase").addEventListener("click", function () {
      if (!confirm("Erase all workouts, levels and personal bests on this device? This can't be undone.")) return;
      Object.keys(KEYS).forEach(function (k) { localStorage.removeItem(KEYS[k]); });
      location.reload();
    });
  }
  function daysExplainer(n) {
    const names = { strengthA: "full-body strength", run1: "walk and jog", strengthB: "bow strength", run2: "a second walk and jog", hike: "a hike or long walk" };
    const main = PRIORITY.slice(0, n).map(function (s) { return names[s]; });
    const bonus = PRIORITY.slice(n).map(function (s) { return names[s]; }).concat(["stretching"]);
    return "With " + n + " days, the main workouts are " + listJoin(main) + ". Bonus options: " + listJoin(bonus) + ".";
  }
  function listJoin(a) { return a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }

  // ——— Toasts ———
  let toastQueue = [], toastBusy = false;
  function showToasts(msgs) { toastQueue = toastQueue.concat(msgs); if (!toastBusy) nextToast(); }
  function nextToast() {
    const el = $("toast");
    if (!toastQueue.length) { toastBusy = false; el.classList.add("hidden"); return; }
    toastBusy = true;
    const m = toastQueue.shift();
    $("toast-msg").textContent = m;
    $("toast-label").textContent = /personal best/i.test(m) ? "🎉" : "✓";
    el.classList.remove("hidden");
    setTimeout(nextToast, 3800);
  }

  // ——— Guard rails: no banned equipment / jargon in the built workouts ———
  function assertCleanContent() {
    const banned = [/kettlebell/i, /cable/i, /ab wheel/i, /landmine/i, /med(icine)? ball/i, /\bexpress\b/i, /\bblast\b/i, /back-to-back/i, /1RM/, /\bRPE\b/, /\bday 2\b/i,
      // Hip-friendly rules: no deep squats or forced end-range hip stretches
      /pigeon/i, /figure-four/i, /figure 4/i, /child's pose/i, /knee-to-chest/i, /goblet/i, /deep squat/i, /walking lunge/i, /chair squat/i, /mid-shin/i, /toward your heels/i,
      // No exercises with the actual bow (or band draw practice) inside workouts
      /practice draw/i, /band draw/i, /nocked/i, /dry.?fir/i, /full draw/i, /on your bow/i];
    if (!eq("bands")) banned.push(/\bband\b/i);
    const problems = [];
    Object.keys(SLOTS).forEach(function (sid) {
      ["full", "short"].forEach(function (v) {
        const txt = JSON.stringify(buildWorkout(sid, v));
        banned.forEach(function (re) { if (re.test(txt)) problems.push(sid + "/" + v + " matches " + re); });
      });
    });
    if (problems.length) console.error("Content check failed:", problems);
  }

  // ——— Bind + start ———
  function bind() {
    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () { render(); setTab(t.dataset.view); });
    });
    document.addEventListener("click", function (e) {
      const o = e.target.closest("[data-open]");
      if (o && !o.disabled) { openDetail(o.dataset.open, o.dataset.variant || "full"); }
    });
    $("detail").addEventListener("click", function (e) { if (e.target.closest("[data-close]")) closeDetail(); });
    $("btn-start").addEventListener("click", function () { if (detailCtx) startWorkout(detailCtx.slotId, detailCtx.variant); });
    $("active-body").addEventListener("input", onActiveInput);
    $("active-body").addEventListener("change", onActiveInput);
    $("active-body").addEventListener("click", onActiveClick);
    $("btn-active-back").addEventListener("click", function () { hideActive(); setTab("today"); render(); });
    $("btn-active-abandon").addEventListener("click", abandonWorkout);
    $("btn-finish").addEventListener("click", openRating);
    $("rating").addEventListener("click", function (e) {
      const r = e.target.closest("[data-rate]");
      if (r) { ratingSel = r.dataset.rate; updateRatingUi(); return; }
      const hp = e.target.closest("[data-hips]");
      if (hp) { hipsSel = hp.dataset.hips; updateRatingUi(); return; }
      if (e.target.closest("#btn-save-rating")) { if (ratingSel && hipsSel) finishWorkout(ratingSel, hipsSel); return; }
      if (e.target.closest("[data-close-rating]")) closeRating();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeDetail(); closeRating(); } });
    // Week rolls over at midnight: re-render when the app comes back into view
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      if (week.weekId !== weekInfo().id && !week.activeSession) { week = defaultWeek(); saveWeek(); }
      if (!week.activeSession || $("view-active").hidden) render();
    });
  }

  bind();
  render();
  setTab("today");
  if (week.activeSession) showActive();
  assertCleanContent();

  // Small hook for local testing in the console
  window.casandraCoach = { planWeek: planWeek, buildWorkout: buildWorkout, readiness: readiness, openDetail: openDetail, startWorkout: startWorkout, levels: function () { return levels; } };
})();
