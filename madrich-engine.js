/* =====================================================================
   מנוע "המדריך" — מדריך לימוד מתוסרט בשיטת שאלות הכוונה
   ---------------------------------------------------------------------
   מבוסס על המנוע הפדגוגי של ה-Gems (חלק א'), בגרסה סטטית:
   • בלי בינה מלאכותית, בלי שרת ובלי הזדהות — רק לימוד היחידה.
   • כל שלב: שאלת פתיחה (לפני ההסבר) ← הסבר בחלקים ← דוגמה ←
     בדיקת הבנה (שני ניסיונות + רמז) ← השוואה לתשובה שכתבת ← מעבר.
   • שש פקודות קבועות: המשך · תסביר שוב · לא מבין · עבור נושא ·
     סכם את החומר · שיעורי בית.
   • ההתקדמות נשמרת בדפדפן בלבד (localStorage) — לא נשלח שום מידע.
   התוכן של כל מדריך מוגדר ב-window.MADRICH בדף עצמו.
   ===================================================================== */
(function () {
  'use strict';
  const D = window.MADRICH;
  const N = D.stages.length;
  const KEY = 'madrich_' + D.id;
  const COMMANDS = ['המשך', 'תסביר שוב', 'לא מבין', 'עבור נושא', 'סכם את החומר', 'שיעורי בית'];
  const ALIASES = {
    'המשך': ['המשך', 'תמשיך', 'להמשיך', 'הלאה', 'הבא', 'כן', 'יאללה', 'נמשיך', 'מוכן', 'מוכנה'],
    'תסביר שוב': ['תסביר שוב', 'תסביר', 'הסבר שוב', 'תסבירי', 'שוב', 'עוד פעם', 'תחזור', 'הסבר'],
    'לא מבין': ['לא מבין', 'לא מבינה', 'לא הבנתי', 'לא ברור', 'מה?', 'לא יודע', 'לא יודעת'],
    'עבור נושא': ['עבור נושא', 'נושא הבא', 'עבור', 'דלג', 'תדלג', 'שלב הבא'],
    'סכם את החומר': ['סכם את החומר', 'סכם', 'סיכום', 'תסכם', 'סכמי'],
    'שיעורי בית': ['שיעורי בית', 'שיעורים', 'שאלות לבית', 'ש"ב', 'שב']
  };

  // ---------- מצב ----------
  let S = load() || fresh();
  function fresh() { return { stage: 0, phase: 'intro', chunk: 0, tries: 0, done: [], skipped: [], answers: {}, lastExplained: -1 }; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }

  // ---------- DOM ----------
  const $ = (s) => document.querySelector(s);
  const log = $('#mdLog');
  function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function scroll() { requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; }); }

  // ---------- הקראה (Text-to-Speech בדפדפן, בלי שרת) ----------
  const TTS = (function () {
    const ok = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    let on = false, voice = null, rate = 1;
    try { on = localStorage.getItem('madrich_tts') === '1'; rate = Number(localStorage.getItem('madrich_tts_rate')) || 1; } catch (e) {}
    function pickVoice() {
      if (!ok) return;
      const v = speechSynthesis.getVoices().filter((x) => /^(he|iw)/i.test(x.lang));
      voice = v.find((x) => /google|natural|online/i.test(x.name)) || v[0] || null;
    }
    if (ok) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
    function clean(node) {
      const c = node.cloneNode(true);
      c.querySelectorAll('button, .md-actions, .md-copy, .md-tts').forEach((x) => x.remove());
      c.querySelectorAll('td, th, li, p, b, div').forEach((x) => x.append('. '));
      return c.textContent
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{FE0F}]/gu, ' ')
        .replace(/—/g, ', ').replace(/([.!?:,])\s*\./g, '$1').replace(/\s*\.\s*(\.\s*)+/g, '. ').replace(/\s+/g, ' ').trim();
    }
    function chunks(t) { // Chrome קוטע הקראות ארוכות — מפצלים למשפטים
      const parts = t.match(/[^.!?:]+[.!?:]*/g) || [t]; const out = []; let cur = '';
      parts.forEach((p) => { if ((cur + p).length > 180 && cur) { out.push(cur); cur = p; } else cur += p; });
      if (cur.trim()) out.push(cur); return out;
    }
    function speakText(t) {
      if (!ok || !t) return;
      chunks(t).forEach((c) => {
        const u = new SpeechSynthesisUtterance(c.trim()); u.lang = 'he-IL'; u.rate = rate;
        if (voice) u.voice = voice; speechSynthesis.speak(u);
      });
    }
    return {
      ok: ok,
      get on() { return on; },
      hasHebrew() { pickVoice(); return !!voice; },
      toggle() { on = !on; try { localStorage.setItem('madrich_tts', on ? '1' : '0'); } catch (e) {} if (!on) this.stop(); return on; },
      setRate(r) { rate = r; try { localStorage.setItem('madrich_tts_rate', String(r)); } catch (e) {} },
      get rate() { return rate; },
      stop() { if (ok) speechSynthesis.cancel(); },
      read(node) { this.stop(); speakText(clean(node)); },
      auto(node) { if (on) speakText(clean(node)); }
    };
  })();
  function addSpeaker(bubble) {
    if (!TTS.ok) return;
    const b = document.createElement('button'); b.className = 'md-tts'; b.type = 'button';
    b.title = 'הקראה'; b.setAttribute('aria-label', 'הקראת ההודעה'); b.textContent = '🔊';
    b.onclick = (e) => { e.stopPropagation(); TTS.read(bubble); };
    bubble.prepend(b);
  }

  function bot(html, cls) {
    const m = document.createElement('div'); m.className = 'md-msg';
    m.innerHTML = '<div class="ic">' + (D.emoji || '🧭') + '</div><div class="md-b ' + (cls || '') + '">' + html + '</div>';
    log.appendChild(m); scroll();
    const bb = m.querySelector('.md-b'); addSpeaker(bb);
    setTimeout(() => TTS.auto(bb), 0); // אחרי שנוספו כפתורים/אפשרויות
    return bb;
  }
  function me(text) {
    TTS.stop();
    const m = document.createElement('div'); m.className = 'md-msg me';
    m.innerHTML = '<div class="ic">אני</div><div class="md-b"></div>';
    m.querySelector('.md-b').textContent = text; log.appendChild(m); scroll();
  }
  function actions(bubble, list) {
    const box = document.createElement('div'); box.className = 'md-actions';
    list.forEach(([label, fn, alt]) => {
      const b = document.createElement('button'); b.className = 'md-act' + (alt ? ' alt' : ''); b.textContent = label;
      b.onclick = () => { box.querySelectorAll('button').forEach((x) => (x.disabled = true)); box.remove(); me(label); fn(); };
      box.appendChild(b);
    });
    bubble.appendChild(box); scroll();
  }
  function clearPendingButtons() { log.querySelectorAll('.md-actions').forEach((b) => b.remove()); }

  function progress() {
    const bar = $('#mdProgress'); bar.innerHTML = '';
    for (let i = 0; i < N; i++) {
      const s = document.createElement('span');
      if (S.done.includes(i)) s.className = 'done'; else if (i === S.stage && S.phase !== 'end') s.className = 'now';
      s.title = (i + 1) + '. ' + D.stages[i].title; bar.appendChild(s);
    }
    $('#mdProgressText').textContent = S.phase === 'end' ? 'המדריך הושלם ✓' : 'שלב ' + Math.min(S.stage + 1, N) + ' מתוך ' + N + ' · ' + D.stages[Math.min(S.stage, N - 1)].title;
  }

  // ---------- תסריט פתיחה (עיקרון 4) ----------
  function commandsText() {
    return '<p>בכל שלב אפשר להשתמש בפקודות האלה (בכפתורים למטה או בהקלדה):</p><ul>' +
      '<li><strong>המשך</strong> — להמשיך בהסבר או לעבור הלאה</li>' +
      '<li><strong>תסביר שוב</strong> — הסבר נוסף, במילים אחרות</li>' +
      '<li><strong>לא מבין</strong> — אם משהו לא ברור</li>' +
      '<li><strong>עבור נושא</strong> — מעבר לנושא/שלב הבא</li>' +
      '<li><strong>סכם את החומר</strong> — סיכום נקודות להעתקה למחברת</li>' +
      '<li><strong>שיעורי בית</strong> — שאלות סיכום ליחידה</li></ul>';
  }
  function intro() {
    const resumed = S.phase !== 'intro' && (S.done.length || S.stage > 0 || S.phase !== 'open');
    if (S.phase === 'end') {
      bot('<p>שלום שוב! כבר סיימת את המדריך <strong>' + esc(D.title) + '</strong>. 🎉</p>');
      const b = bot('<p>מה תרצה לעשות?</p>');
      actions(b, [['סכם את החומר', summary], ['שיעורי בית', homework], ['להתחיל מההתחלה', restart, true]]);
      return;
    }
    if (resumed) {
      const b = bot('<p>שלום שוב! עצרת ב<strong>שלב ' + (S.stage + 1) + ' — ' + esc(D.stages[S.stage].title) + '</strong>.</p><p>להמשיך מאותה נקודה?</p>');
      actions(b, [['כן, להמשיך', () => enterStage(S.stage, true)], ['להתחיל מההתחלה', restart, true]]);
      return;
    }
    bot('<p>שלום, אני <strong>' + esc(D.persona) + '</strong>. ' + D.story + '</p><p>עכשיו אנחנו נעסוק ב<strong>' + esc(D.stages[0].title) + '</strong>.</p>');
    const b = bot(commandsText() + '<p>מוכן להתחיל?</p>');
    actions(b, [['בוא נתחיל!', () => enterStage(0)]]);
  }
  function restart() { S = fresh(); save(); log.innerHTML = ''; progress(); enterStage(0); }

  // ---------- לולאת שלב (עיקרון 5) ----------
  function enterStage(i, resumed) {
    S.stage = i; S.phase = 'open'; S.chunk = 0; S.tries = 0; save(); progress();
    const st = D.stages[i];
    const sb = bot('<div class="stage">📍 שלב ' + (i + 1) + ' מתוך ' + N + ': ' + esc(st.title) + '</div>' +
      (i > 0 && !resumed ? '<p>עכשיו אנחנו נעסוק ב<strong>' + esc(st.title) + '</strong>.</p>' : '') +
      '<p class="q">לפני שאסביר — מה דעתך?</p><p>' + st.open.q + '</p><p style="font-size:13.5px;color:var(--ink-soft)">כתוב את מה שאתה חושב בתיבה למטה. אין תשובה לא נכונה בשלב הזה — בסוף השלב נשווה.</p>');
    actions(sb, [['אין לי מושג — תסביר', () => afterOpen('')]]);
    if (window.matchMedia('(min-width: 700px)').matches) $('#mdText').focus();
  }
  function afterOpen(text) {
    clearPendingButtons();
    S.answers[S.stage] = text; S.phase = 'explain'; S.chunk = 0; save();
    bot(text ? '<p>' + pick(['תודה! בוא נבדוק את זה יחד.', 'מחשבה טובה — עכשיו נראה מה נכון בה.', 'יפה שניסית. בוא נלמד ונחזור לזה בסוף.']) + '</p>'
      : '<p>זה בסדר גמור — בשביל זה אנחנו כאן. בוא נתחיל.</p>');
    explainNext();
  }
  function explainNext() {
    const st = D.stages[S.stage];
    const parts = st.explain.concat([st.example ? '<div class="ex">💡 <strong>דוגמה:</strong> ' + st.example + '</div>' : null]).filter(Boolean);
    if (st.visual) parts.splice(Math.min(1, parts.length), 0, st.visual);
    if (S.chunk < parts.length) {
      S.lastExplained = S.stage;
      const b = bot(parts[S.chunk]); S.chunk++; save();
      if (S.chunk < parts.length) actions(b, [['המשך', explainNext], ['לא מבין', notUnderstood, true]]);
      else setTimeout(askCheck, 450);
    } else askCheck();
  }

  // ---------- בדיקת הבנה (עיקרון 7) ----------
  function askCheck() {
    const c = D.stages[S.stage].check; S.phase = 'check'; S.tries = 0; save();
    const b = bot('<p class="q">✏️ בדיקת הבנה:</p><p>' + c.q + '</p>');
    const box = document.createElement('div'); box.className = 'md-opts';
    shuffle(c.options.map((o, k) => [o, k])).forEach(([o]) => {
      const btn = document.createElement('button'); btn.className = 'md-opt'; btn.innerHTML = o.t;
      if (o.ok) btn.dataset.ok = '1';
      btn.onclick = () => answer(o, btn, box); box.appendChild(btn);
    });
    b.appendChild(box); b.dataset.check = '1'; scroll();
  }
  function answer(o, btn, box) {
    if (S.phase !== 'check') return;
    const c = D.stages[S.stage].check;
    me(btn.textContent);
    if (o.ok) {
      btn.classList.add('right'); box.querySelectorAll('button').forEach((x) => (x.disabled = true));
      bot('<p>✅ <strong>' + pick(['נכון מאוד!', 'בדיוק!', 'מצוין!', 'תשובה נכונה!']) + '</strong> ' + (o.fb || '') + '</p>', 'ok');
      finishStage();
    } else {
      S.tries++; save(); btn.classList.add('wrong'); btn.disabled = true;
      if (S.tries === 1) {
        bot('<p>❌ ' + (o.fb || 'לא בדיוק.') + '</p><p>💡 <strong>רמז:</strong> ' + c.hint + '</p><p>נסה שוב.</p>', 'hint');
      } else {
        box.querySelectorAll('button').forEach((x) => { x.disabled = true; });
        const right = box.querySelector('button[data-ok]');
        if (right) right.classList.add('right');
        bot('<p>❌ ' + (o.fb || '') + '</p><p>התשובה הנכונה: <strong>' + c.options.find((z) => z.ok).t + '</strong></p><p>' + c.why + '</p>', 'bad');
        finishStage();
      }
    }
  }
  function finishStage() {
    const st = D.stages[S.stage];
    if (!S.done.includes(S.stage)) S.done.push(S.stage);
    S.phase = 'decide'; save(); progress();
    const mine = S.answers[S.stage];
    bot((mine ? '<p>🔁 <strong>בתחילת השלב כתבת:</strong> "' + esc(mine) + '"</p>' : '<p>🔁 <strong>נחזור לשאלת הפתיחה:</strong> ' + st.open.q + '</p>') +
      '<p><strong>תשובה לדוגמה:</strong> ' + st.open.model + '</p>' + (mine ? '<p style="font-size:13.5px;color:var(--ink-soft)">השווה: מה היה נכון אצלך, ומה היית מוסיף עכשיו?</p>' : ''));
    if (S.stage === N - 1) { setTimeout(endGuide, 500); return; }
    const b = bot('<p>מוכן להמשיך לשלב הבא — <strong>' + esc(D.stages[S.stage + 1].title) + '</strong>?</p>');
    actions(b, [['המשך', () => enterStage(S.stage + 1)], ['תסביר שוב', explainAgain, true]]);
  }

  // ---------- סיום (עיקרון 11) ----------
  function endGuide() {
    S.phase = 'end'; save(); progress();
    bot('<p>🎉 <strong>כל הכבוד! סיימת את כל ' + N + ' השלבים של "' + esc(D.title) + '".</strong></p>' +
      (D.finalReview ? '<p><strong>סקירה של כל היחידה (שלושת המדריכים):</strong></p><ul>' + D.finalReview.map((x) => '<li>' + x + '</li>').join('') + '</ul>' : ''));
    summary(true); homework(true);
    if (D.next) {
      const b = bot('<p>בפעם הבאה: ' + esc(D.next.teaser) + '</p>');
      const a = document.createElement('a'); a.className = 'md-next'; a.href = D.next.href;
      a.innerHTML = '<span>➜</span> ' + esc(D.next.title); b.appendChild(a); scroll();
    }
  }
  function summary(auto) {
    const list = S.done.slice().sort((a, b) => a - b);
    if (!list.length) { bot('<p>עדיין לא סיימנו אף שלב, אז אין מה לסכם. נמשיך ללמוד ונסכם בהמשך!</p>'); return reprompt(); }
    const lines = []; list.forEach((i) => { lines.push('■ ' + D.stages[i].title); D.stages[i].summary.forEach((s) => lines.push('  • ' + s)); });
    const b = bot('<p>📒 <strong>סיכום נקודות להעתקה למחברת' + (list.length < N ? ' (מה שלמדנו עד עכשיו)' : '') + ':</strong></p>' +
      list.map((i) => '<p><strong>' + esc(D.stages[i].title) + '</strong></p><ul>' + D.stages[i].summary.map((s) => '<li>' + s + '</li>').join('') + '</ul>').join(''));
    copyBtn(b, D.title + ' — סיכום\n' + lines.join('\n').replace(/<[^>]+>/g, ''));
    if (!auto) reprompt();
  }
  function homework(auto) {
    const list = S.done.slice().sort((a, b) => a - b);
    if (!list.length) { bot('<p>שיעורי בית יגיעו אחרי שנלמד לפחות שלב אחד. 🙂</p>'); return reprompt(); }
    let qs = []; list.forEach((i) => (qs = qs.concat(D.stages[i].homework)));
    const target = Math.max(4, Math.min(10, list.length + 3));
    qs = qs.slice(0, target);
    const b = bot('<p>📝 <strong>שיעורי בית' + (auto ? ' לסיום היחידה' : '') + '</strong> — ענה במחברת:</p><ol>' + qs.map((q) => '<li>' + q + '</li>').join('') + '</ol>');
    copyBtn(b, D.title + ' — שיעורי בית\n' + qs.map((q, k) => (k + 1) + '. ' + q.replace(/<[^>]+>/g, '')).join('\n'));
    if (!auto) reprompt();
  }
  function copyBtn(b, text) {
    const c = document.createElement('button'); c.className = 'md-copy'; c.textContent = '📋 העתקה';
    c.onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => (c.textContent = '✓ הועתק'), () => (c.textContent = 'סמן והעתק ידנית')); };
    b.appendChild(c);
  }

  // ---------- פקודות (עיקרון 6) ----------
  function command(cmd) {
    clearPendingButtons();
    switch (cmd) {
      case 'המשך':
        if (S.phase === 'open') return afterOpen('');
        if (S.phase === 'explain') return explainNext();
        if (S.phase === 'decide') return S.stage < N - 1 ? enterStage(S.stage + 1) : endGuide();
        if (S.phase === 'check') { bot('<p>קודם נסה לענות על שאלת הבדיקה למעלה 👆 — או כתוב <strong>לא מבין</strong> לרמז, או <strong>עבור נושא</strong> כדי לדלג.</p>'); return; }
        if (S.phase === 'end') { bot('<p>סיימת את המדריך! אפשר לבקש <strong>סכם את החומר</strong> או <strong>שיעורי בית</strong>.</p>'); return; }
        return intro();
      case 'תסביר שוב': return explainAgain();
      case 'לא מבין': return notUnderstood();
      case 'עבור נושא':
        if (S.phase === 'end') { bot('<p>זה היה השלב האחרון 🙂</p>'); return; }
        if (!S.done.includes(S.stage)) { S.skipped.push(S.stage); }
        bot('<p>בסדר, ממשיכים הלאה. ⏭️</p>');
        if (S.stage < N - 1) return enterStage(S.stage + 1);
        return endGuide();
      case 'סכם את החומר': return summary(false);
      case 'שיעורי בית': return homework(false);
    }
  }
  function lastTopic() { return S.phase === 'open' && S.stage > 0 ? S.stage - 1 : (S.lastExplained >= 0 ? S.lastExplained : S.stage); }
  function explainAgain() {
    const i = (S.phase === 'open' && S.stage === 0) ? 0 : lastTopic();
    if (S.phase === 'open' && S.stage === 0) { bot('<p>עוד לא הסברתי כלום 🙂 נסה לענות על שאלת הפתיחה, או לחץ "אין לי מושג — תסביר".</p>'); return reprompt(); }
    bot('<p>🔄 <strong>' + esc(D.stages[i].title) + '</strong> — במילים אחרות:</p>' + D.stages[i].again);
    reprompt();
  }
  function notUnderstood() {
    if (S.phase === 'check') { bot('<p>💡 <strong>רמז:</strong> ' + D.stages[S.stage].check.hint + '</p><p>נסה לבחור תשובה.</p>', 'hint'); return; }
    if (S.phase === 'open') { bot('<p>זו לא שאלה של "נכון/לא נכון" — רק תכתוב מה עולה לך בראש. ואם אין לך מושג, זה גם בסדר:</p>'); return reprompt(); }
    const i = lastTopic();
    bot('<p>🧩 בוא ננסה הכי פשוט שיש:</p>' + D.stages[i].simple);
    reprompt();
  }
  function reprompt() {
    if (S.phase === 'open') { const b = bot('<p>מה דעתך על שאלת הפתיחה? כתוב למטה, או:</p>'); actions(b, [['אין לי מושג — תסביר', () => afterOpen('')]]); }
    else if (S.phase === 'explain') { const b = bot('<p>נמשיך?</p>'); actions(b, [['המשך', explainNext]]); }
    else if (S.phase === 'decide') { const b = bot('<p>מוכן להמשיך?</p>'); actions(b, [['המשך', () => (S.stage < N - 1 ? enterStage(S.stage + 1) : endGuide())]]); }
    else if (S.phase === 'check') { bot('<p>השאלה עדיין מחכה לך למעלה 👆</p>'); }
  }

  // ---------- קלט טקסט ----------
  function matchCommand(t) {
    const s = t.trim().replace(/[.!?,]+$/g, '').replace(/\s+/g, ' ');
    for (const cmd of COMMANDS) if (ALIASES[cmd].some((a) => s === a)) return cmd;
    return null;
  }
  function onText() {
    const ta = $('#mdText'); const t = ta.value.trim(); if (!t) return;
    ta.value = ''; grow(); me(t);
    const cmd = matchCommand(t);
    if (S.phase === 'open' && !(cmd && cmd !== 'המשך')) return cmd === 'המשך' ? afterOpen('') : afterOpen(t);
    if (cmd) return command(cmd);
    if (S.phase === 'check') { bot('<p>בשאלה הזו בוחרים אחת מהתשובות בכפתורים למעלה 👆</p>'); return; }
    bot('<p>לא נכתבה הנחיה נכונה. אפשר לכתוב: <strong>' + COMMANDS.join(' · ') + '</strong></p>');
  }
  function grow() { const t = $('#mdText'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; }

  // ---------- עזרים ----------
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- אתחול ----------
  COMMANDS.forEach((c) => { const b = document.createElement('button'); b.className = 'md-cmd'; b.textContent = c; b.onclick = () => { me(c); command(c); }; $('#mdCmds').appendChild(b); });
  $('#mdSend').onclick = onText;
  $('#mdText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onText(); } });
  $('#mdText').addEventListener('input', grow);
  $('#mdRestart').onclick = () => { me('להתחיל מההתחלה'); restart(); };
  (function ttsControls() {
    const box = $('#mdTtsBox'); if (!box) return;
    if (!TTS.ok) { box.innerHTML = '<span class="md-tts-note">הדפדפן הזה לא תומך בהקראה</span>'; return; }
    const tg = document.createElement('button'); tg.type = 'button'; tg.className = 'md-tts-toggle';
    const paint = () => { tg.textContent = TTS.on ? '🔊 הקראה פעילה' : '🔈 הקראה'; tg.classList.toggle('on', TTS.on); tg.setAttribute('aria-pressed', TTS.on); };
    tg.onclick = () => {
      const now = TTS.toggle(); paint();
      if (now) {
        if (!TTS.hasHebrew()) bot('<p>⚠️ לא נמצא במכשיר הזה קול בעברית, אז ההקראה עלולה להישמע לא טוב. ב-Windows אפשר להוסיף קול עברי בהגדרות ← שעה ושפה ← דיבור. בטלפונים בדרך כלל יש קול עברי מובנה.</p>');
        const last = [...log.querySelectorAll('.md-msg:not(.me) .md-b')].pop(); if (last) TTS.read(last);
      }
    };
    const sp = document.createElement('select'); sp.className = 'md-tts-rate'; sp.setAttribute('aria-label', 'מהירות הקראה');
    [['0.8', 'איטי'], ['1', 'רגיל'], ['1.25', 'מהיר']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; if (Number(v) === TTS.rate) o.selected = true; sp.appendChild(o); });
    sp.onchange = () => TTS.setRate(Number(sp.value));
    box.append(tg, sp); paint();
  })();
  progress(); intro();
})();
