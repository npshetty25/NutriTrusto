const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

const pres = new PptxGenJS();
pres.defineLayout({ name: 'LAYOUT_16x9', width: 10, height: 5.625 });
pres.layout = 'LAYOUT_16x9';
pres.author = 'NutriTrusto Team';
pres.company = 'HM 2026';
pres.subject = 'Stanford d.School Phase 1: Empathize & Define';
pres.title = 'NutriTrusto - Your Smart Pantry Companion';

const C = {
  dark: '0D1B2A',
  teal: '0D9488',
  tealLt: '14B8A6',
  mint: 'CCFBF1',
  white: 'FFFFFF',
  offWht: 'F0FDFA',
  grey: '94A3B8',
  greyLt: 'E2E8F0',
  greyDk: '334155',
  amber: 'F59E0B',
  red: 'EF4444',
  green: '10B981',
  darkCard: '112233',
  blue: '3B82F6',
  tealFill: 'E1F5EE',
  amberFill: 'FEF3C7',
  blueFill: 'EFF6FF',
  redFill: 'FEE2E2',
};

const FONT = 'Calibri';
const makeShadow = () => undefined;

function addTopBar(slide) {
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 10,
    h: 0.07,
    fill: { color: C.teal },
    line: { color: C.teal, pt: 0 },
  });
}

function addSectionLabel(slide, text, dark) {
  slide.addText(text.toUpperCase(), {
    x: 0.5,
    y: 0.18,
    w: 9,
    h: 0.18,
    fontFace: FONT,
    fontSize: 8,
    bold: true,
    color: dark ? C.tealLt : C.teal,
    charSpace: 4,
    margin: 0,
  });
}

function addTitle(slide, text, dark) {
  slide.addText(text, {
    x: 0.45,
    y: 0.38,
    w: 9.1,
    h: 0.48,
    fontFace: FONT,
    fontSize: 25,
    bold: true,
    color: dark ? C.white : C.greyDk,
    margin: 0,
  });
}

function darkSlide(section, title) {
  const s = pres.addSlide();
  s.background = { color: C.dark };
  addTopBar(s);
  addSectionLabel(s, section, true);
  addTitle(s, title, true);
  return s;
}

function lightSlide(section, title) {
  const s = pres.addSlide();
  s.background = { color: C.offWht };
  addTopBar(s);
  addSectionLabel(s, section, false);
  addTitle(s, title, false);
  return s;
}

function card(slide, dark, x, y, w, h, borderColor) {
  slide.addShape('rect', {
    x,
    y,
    w,
    h,
    fill: { color: dark ? C.darkCard : C.white },
    line: { color: borderColor || (dark ? C.teal : C.greyLt), pt: dark ? 0.8 : 0.5 },
    shadow: makeShadow(),
  });
}

function bulletText(slide, x, y, w, h, items, color, size) {
  const runs = items.map((it, idx) => ({
    text: it,
    options: {
      bullet: true,
      breakLine: idx < items.length - 1,
      fontFace: FONT,
      fontSize: size,
      color,
    },
  }));
  slide.addText(runs, { x, y, w, h, margin: 0, paraSpaceAfterPt: 5 });
}

// Slide 1
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  addTopBar(s);
  s.addShape('rect', { x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  s.addShape('ellipse', { x: 0.55, y: 0.45, w: 1.0, h: 1.0, fill: { color: C.teal }, line: { color: C.tealLt, pt: 1 } });
  s.addText('NT', { x: 0.55, y: 0.45, w: 1.0, h: 1.0, fontFace: FONT, fontSize: 26, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });

  s.addText('NutriTrusto', { x: 1.78, y: 0.48, w: 7.8, h: 0.65, fontFace: FONT, fontSize: 40, bold: true, color: C.white, margin: 0 });
  s.addText('Your Smart Pantry Companion', { x: 1.8, y: 1.12, w: 7.8, h: 0.35, fontFace: FONT, fontSize: 15, italic: true, color: C.tealLt, margin: 0 });
  s.addShape('rect', { x: 0.45, y: 1.62, w: 9.1, h: 0.025, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  s.addText('The Impact of Real-Time Nutritional Transparency and Smart Pantry Management\non Food Waste Reduction and Health Awareness Among Urban Consumers', {
    x: 0.45, y: 1.75, w: 9.1, h: 0.75, fontFace: FONT, fontSize: 11.5, italic: true, color: C.grey, margin: 0,
  });

  card(s, true, 0.45, 2.65, 5.55, 2.55);
  card(s, true, 6.2, 2.65, 3.35, 2.55);
  s.addText('TEAM MEMBERS', { x: 0.6, y: 2.83, w: 5.2, h: 0.16, fontFace: FONT, fontSize: 8, bold: true, color: C.tealLt, charSpace: 4, margin: 0 });
  ['Nirav P Shetty - 230905213', 'Prisha ___________ - ___________', 'Sumit ___________ - ___________', 'Abhyudith ___________ - ___________'].forEach((m, i) => {
    s.addText(m, { x: 0.62, y: 3.05 + i * 0.42, w: 5.2, h: 0.2, fontFace: FONT, fontSize: 10, color: C.grey, margin: 0 });
  });

  s.addText('PROJECT DETAILS', { x: 6.35, y: 2.83, w: 3.05, h: 0.16, fontFace: FONT, fontSize: 8, bold: true, color: C.tealLt, charSpace: 4, margin: 0 });
  [['Branch', 'CSE'], ['Guide', "Guide's Name"], ['Year', 'H&M 2026'], ['Phase', 'Empathize & Define']].forEach((r, i) => {
    const y = 3.08 + i * 0.42;
    s.addText(r[0] + ':', { x: 6.35, y, w: 0.85, h: 0.2, fontFace: FONT, fontSize: 9.5, bold: true, color: C.tealLt, margin: 0 });
    s.addText(r[1], { x: 7.25, y, w: 2.05, h: 0.2, fontFace: FONT, fontSize: 9.5, color: C.grey, margin: 0 });
  });
}

// Slide 2
{
  const s = lightSlide('OUTLINE', 'Contents');
  const rows = [
    ['01', 'Abstract', 'Research context and concept'],
    ['02', 'Introduction', 'Motivation and Why Us'],
    ['03', 'User Research & ICP', 'Target profile and methods'],
    ['04', 'Empathy Artifacts', 'Empathy map synthesis'],
    ['05', 'Problem Discovery Methods', 'Observation to definition'],
    ['06', 'Survey Findings', '79-respondent evidence'],
    ['07', 'Final Problem Definition', 'POV and validated sub-problems'],
    ['08', 'Objectives & Hypotheses', 'Research direction'],
  ];
  rows.forEach((r, i) => {
    const x = i < 4 ? 0.45 : 5.1;
    const y = 1.12 + (i % 4) * 1.1;
    card(s, false, x, y, 4.45, 0.88);
    s.addShape('rect', { x, y, w: 0.52, h: 0.88, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
    s.addText(r[0], { x, y: y + 0.24, w: 0.52, h: 0.24, fontFace: FONT, fontSize: 14, bold: true, color: C.white, align: 'center', margin: 0 });
    s.addText(r[1], { x: x + 0.65, y: y + 0.14, w: 3.65, h: 0.22, fontFace: FONT, fontSize: 13, bold: true, color: C.greyDk, margin: 0 });
    s.addText(r[2], { x: x + 0.65, y: y + 0.46, w: 3.65, h: 0.18, fontFace: FONT, fontSize: 9, color: C.grey, margin: 0 });
  });
}

// Slide 3
{
  const s = darkSlide('ABSTRACT', 'Abstract');
  card(s, true, 0.45, 1.05, 9.1, 1.45);
  s.addText('NutriTrusto is a mobile-first web application addressing two interconnected problems faced by urban consumers across India: inability to evaluate nutritional quality of packaged food at point of purchase, and lack of a system to manage perishable grocery inventory. By combining real-time barcode-based health ratings with an AI-powered smart pantry tracker, NutriTrusto enables informed food choices while reducing household food waste.', {
    x: 0.62, y: 1.22, w: 8.75, h: 1.08, fontFace: FONT, fontSize: 11, color: C.grey, margin: 0,
  });

  [['Problem Space', 'Health + Waste'], ['Target Users', 'All Urban Consumers'], ['Survey Size', '79 Respondents'], ['Phase', 'Empathize & Define']].forEach((m, i) => {
    const x = 0.45 + i * 2.2;
    card(s, true, x, 2.65, 2.1, 1.05);
    s.addText(m[0], { x: x + 0.08, y: 2.8, w: 1.94, h: 0.16, fontFace: FONT, fontSize: 8, bold: true, color: C.tealLt, charSpace: 1, align: 'center', margin: 0 });
    s.addText(m[1], { x: x + 0.08, y: 3.08, w: 1.94, h: 0.28, fontFace: FONT, fontSize: 13, bold: true, color: C.white, align: 'center', margin: 0 });
  });

  card(s, true, 0.45, 3.85, 4.45, 1.1);
  card(s, true, 5.1, 3.85, 4.45, 1.1);
  s.addText('Barcode Health Scanner', { x: 0.62, y: 4.03, w: 4.1, h: 0.2, fontFace: FONT, fontSize: 12, bold: true, color: C.white, margin: 0 });
  s.addText('Scan barcode -> instant NutriTrust score, ingredient risk flags, diet conflict alerts, globally banned ingredient checks.', { x: 0.62, y: 4.3, w: 4.1, h: 0.5, fontFace: FONT, fontSize: 9.5, color: C.grey, margin: 0 });
  s.addText('Smart Pantry Manager', { x: 5.28, y: 4.03, w: 4.1, h: 0.2, fontFace: FONT, fontSize: 12, bold: true, color: C.white, margin: 0 });
  s.addText('Track groceries, monitor expiry countdowns, upload receipts, and get AI recipes before items spoil.', { x: 5.28, y: 4.3, w: 4.1, h: 0.5, fontFace: FONT, fontSize: 9.5, color: C.grey, margin: 0 });
}

// Slide 4
{
  const s = lightSlide('INTRODUCTION', 'Motivation & Why Us?');
  s.addText('Motivation to Solve This Problem', { x: 0.45, y: 1.05, w: 4.45, h: 0.2, fontFace: FONT, fontSize: 12, bold: true, color: C.greyDk, margin: 0 });
  const m = [
    ['Living the problem', 'As urban consumers ourselves, we experienced buying packaged food with limited knowledge, forgetting perishables, and struggling to decode additive names.'],
    ['Market gap identified', 'FactsScan and TruthIn stop at scan-level interpretation. No Indian app combines barcode health rating and smart pantry management together.'],
    ['Real social impact', 'Across households and occupations, consumers need tools to make informed food choices and reduce avoidable grocery waste.'],
  ];
  m.forEach((r, i) => {
    const y = 1.38 + i * 1.24;
    card(s, false, 0.45, y, 4.45, 1.12);
    s.addShape('rect', { x: 0.45, y, w: 0.06, h: 1.12, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
    s.addText(r[0], { x: 0.6, y: y + 0.14, w: 4.15, h: 0.2, fontFace: FONT, fontSize: 12, bold: true, color: C.greyDk, margin: 0 });
    s.addText(r[1], { x: 0.6, y: y + 0.42, w: 4.15, h: 0.56, fontFace: FONT, fontSize: 10, color: C.grey, margin: 0 });
  });

  s.addText('Why Us?', { x: 5.1, y: 1.05, w: 4.45, h: 0.2, fontFace: FONT, fontSize: 12, bold: true, color: C.greyDk, margin: 0 });
  const why = [
    ['Domain proximity', 'We face this problem daily as urban consumers managing our own kitchens and groceries.'],
    ['Technical capability', 'Built with Next.js, Supabase, Gemini AI and Open Food Facts; deployed on Vercel.'],
    ['Unique insight', 'Barcode scanning and pantry management are two sides of one behavior loop.'],
    ['Validation-first', '79-respondent survey completed before build; decisions are evidence-driven.'],
  ];
  why.forEach((w, i) => {
    const y = 1.38 + i * 0.94;
    s.addShape('ellipse', { x: 5.1, y, w: 0.32, h: 0.32, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
    s.addText(String(i + 1), { x: 5.1, y, w: 0.32, h: 0.32, fontFace: FONT, fontSize: 10, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });
    s.addText(w[0], { x: 5.55, y: y - 0.01, w: 3.88, h: 0.17, fontFace: FONT, fontSize: 12, bold: true, color: C.greyDk, margin: 0 });
    s.addText(w[1], { x: 5.55, y: y + 0.17, w: 3.88, h: 0.28, fontFace: FONT, fontSize: 10, color: C.grey, margin: 0 });
  });
}

// Slide 5
{
  const s = darkSlide('EMPATHIZE', 'User Research & Ideal Customer Profile');
  card(s, true, 0.45, 1.05, 4.45, 4.1);
  s.addShape('rect', { x: 0.45, y: 1.05, w: 4.45, h: 0.35, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  s.addText('IDEAL CUSTOMER PROFILE', { x: 0.45, y: 1.15, w: 4.45, h: 0.18, fontFace: FONT, fontSize: 9, bold: true, color: C.white, charSpace: 2, align: 'center', margin: 0 });

  const icp = [
    ['Who', 'Urban consumer 18-60 in Tier 1 and Tier 2 Indian cities'],
    ['Location', 'Bengaluru, Mumbai, Delhi, Hyderabad, Pune, Chennai'],
    ['Behaviour', 'Buys packaged food regularly, uses delivery apps, no pantry system'],
    ['Occupation', 'Students, professionals, homemakers, self-employed, retired'],
    ['Pain 1', 'Cannot decode E-numbers/additives; avg label understanding 2.9/5'],
    ['Pain 2', 'Groceries expire before use; 73% waste food regularly'],
    ['Goal', 'Make informed choices and reduce waste with minimal effort'],
  ];
  icp.forEach((r, i) => {
    const y = 1.52 + i * 0.49;
    s.addText(r[0], { x: 0.58, y, w: 1.05, h: 0.2, fontFace: FONT, fontSize: 9, bold: true, color: C.tealLt, margin: 0 });
    s.addText(r[1], { x: 1.68, y, w: 3.1, h: 0.2, fontFace: FONT, fontSize: 9.5, color: C.grey, margin: 0 });
  });

  s.addText('Research Methods Used', { x: 5.1, y: 1.05, w: 4.45, h: 0.2, fontFace: FONT, fontSize: 12, bold: true, color: C.white, margin: 0 });
  const methods = [
    ['Empathy Interviews', 'Qualitative', '1:1 conversations with 8 urban consumers across occupations'],
    ['Observational Study', 'Qualitative', 'Observed grocery behavior and label-reading patterns'],
    ['Online Survey', 'Quantitative', '30-question form; 79 respondents across 6 occupation groups'],
    ['Competitive Analysis', 'Secondary', 'FactsScan, TruthIn, Yuka, KitchenPal gap mapping'],
  ];
  methods.forEach((m, i) => {
    const y = 1.35 + i * 1.0;
    card(s, true, 5.1, y, 4.45, 0.95);
    s.addText(m[0], { x: 5.25, y: y + 0.12, w: 2.9, h: 0.2, fontFace: FONT, fontSize: 11, bold: true, color: C.white, margin: 0 });
    s.addShape('rect', { x: 8.52, y: y + 0.1, w: 0.88, h: 0.22, fill: { color: C.mint }, line: { color: C.mint, pt: 0 } });
    s.addText(m[1], { x: 8.52, y: y + 0.15, w: 0.88, h: 0.12, fontFace: FONT, fontSize: 8, bold: true, color: C.teal, align: 'center', margin: 0 });
    s.addText(m[2], { x: 5.25, y: y + 0.43, w: 4.1, h: 0.36, fontFace: FONT, fontSize: 9, color: C.grey, margin: 0 });
  });
}

// Slide 6
{
  const s = lightSlide('EMPATHIZE', 'ICP Validation - Survey First-Cut Results (n=79)');
  const top = [
    ['47%', 'consume packaged food weekly or daily'],
    ['94%', 'have NO structured pantry tracking system'],
    ['71%', 'scored 4 or 5 likelihood to use NutriTrusto'],
    ['84%', 'find labels confusing (Q9)'],
  ];
  top.forEach((t, i) => {
    const x = 0.45 + i * 2.2;
    card(s, false, x, 1.05, 2.1, 0.92);
    s.addText(t[0], { x: x + 0.12, y: 1.2, w: 0.9, h: 0.25, fontFace: FONT, fontSize: 22, bold: true, color: C.teal, margin: 0 });
    s.addText(t[1], { x: x + 0.12, y: 1.53, w: 1.85, h: 0.28, fontFace: FONT, fontSize: 9, color: C.greyDk, margin: 0 });
  });

  s.addText('Top 8 Features Wanted by Respondents (Q29)', { x: 0.45, y: 2.1, w: 9.1, h: 0.18, fontFace: FONT, fontSize: 11, bold: true, color: C.greyDk, margin: 0 });
  const bars = [
    ['Ingredient Scanner/Explainer', 81, 4.46],
    ['Weekly Health Summary', 61, 3.36],
    ['Health Risk Alerts', 54, 2.97],
    ['Expiry Date Reminders', 54, 2.97],
    ['Banned Ingredient Alerts', 48, 2.64],
    ['Digital Pantry Tracker', 42, 2.31],
    ['AI Recipe Suggestions', 41, 2.26],
    ['Dietary Filters', 38, 2.09],
  ];
  bars.forEach((b, i) => {
    const y = 2.38 + i * 0.33;
    s.addText(b[0], { x: 0.45, y: y + 0.04, w: 3.3, h: 0.16, fontFace: FONT, fontSize: 9.5, color: C.greyDk, margin: 0 });
    s.addShape('rect', { x: 3.8, y: y + 0.03, w: 5.5, h: 0.2, fill: { color: C.greyLt }, line: { color: C.greyLt, pt: 0 } });
    s.addShape('rect', { x: 3.8, y: y + 0.03, w: b[2], h: 0.2, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
    s.addText(String(b[1]) + '%', { x: 9.35, y: y + 0.04, w: 0.2, h: 0.14, fontFace: FONT, fontSize: 9, bold: true, color: C.teal, margin: 0 });
  });

  card(s, false, 0.45, 4.72, 9.1, 0.42);
  s.addShape('rect', { x: 0.45, y: 4.72, w: 0.06, h: 0.42, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  s.addText('Survey validates demand across all demographics - 71% expressed high intent to use NutriTrusto.', { x: 0.58, y: 4.85, w: 8.9, h: 0.18, fontFace: FONT, fontSize: 10, bold: true, color: C.teal, margin: 0 });
}

// Slide 7 light
{
  const s = lightSlide('EMPATHIZE', 'Empathy Artifacts - Empathy Map');
  s.addText('Empathy Map - Urban Consumer (Packaged Food User)', { x: 0.45, y: 1.02, w: 9.1, h: 0.18, fontFace: FONT, fontSize: 11, bold: true, color: C.greyDk, margin: 0 });

  const quads = [
    ['THINKS & FEELS', 0.45, 1.35, C.tealFill, C.teal, ['Should eat healthier but labels are too complex', 'Feels guilty wasting food but forgets purchases', 'Unsure whether common snacks are harmful']],
    ['HEARS', 5.1, 1.35, C.amberFill, C.amber, ['That ingredient is banned abroad', 'You should track food but no easy tool exists', 'Family/roommate complaints about spoiled groceries']],
    ['SAYS & DOES', 0.45, 3.35, C.blueFill, C.blue, ['Buys familiar brands without checking labels', 'Forgets perishables until late-stage spoilage', 'Orders delivery when pantry appears empty']],
    ['PAIN POINTS', 5.1, 3.35, C.redFill, C.red, ['84% find labels confusing (Q9)', '73% waste food regularly (Q23)', '94% have no structured pantry system (Q19)']],
  ];
  quads.forEach((q) => {
    s.addShape('rect', { x: q[1], y: q[2], w: 4.45, h: 1.88, fill: { color: q[3] }, line: { color: q[4], pt: 1 }, shadow: makeShadow() });
    s.addShape('rect', { x: q[1], y: q[2], w: 4.45, h: 0.32, fill: { color: q[4] }, line: { color: q[4], pt: 0 } });
    s.addText(q[0], { x: q[1] + 0.12, y: q[2] + 0.1, w: 4.2, h: 0.14, fontFace: FONT, fontSize: 9, bold: true, color: C.white, charSpace: 2, margin: 0 });
    bulletText(s, q[1] + 0.12, q[2] + 0.42, 4.2, 1.3, q[5], C.greyDk, 10);
  });
}

// Slide 8 dark
{
  const s = darkSlide('DEFINE', 'Problem Discovery & Definition - Methods Used');
  const cx = [0.75, 2.65, 4.55, 6.45, 8.35];
  const labels = ['Observe', 'Interview', 'Survey', 'Analyse', 'Define'];
  const desc = [
    'Watched 8 consumers in stores; 9/10 did not read nutrition labels',
    '8 empathy interviews across occupations; all reported recent food waste',
    '30-Q survey, 79 respondents; Q4 confirms label-check inconsistency',
    'Clustered responses into two themes: health ignorance and waste habits',
    'Synthesised findings into validated POV problem statement',
  ];
  cx.forEach((x, i) => {
    s.addShape('ellipse', { x: x - 0.475, y: 1.08, w: 0.95, h: 0.95, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
    s.addText('0' + String(i + 1), { x: x - 0.475, y: 1.08, w: 0.95, h: 0.95, fontFace: FONT, fontSize: 16, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });
    s.addText(labels[i], { x: x - 0.65, y: 2.08, w: 1.3, h: 0.17, fontFace: FONT, fontSize: 10, bold: true, color: C.tealLt, align: 'center', margin: 0 });
    card(s, true, x - 0.3, 2.35, 1.55, 1.25);
    s.addText(desc[i], { x: x - 0.22, y: 2.48, w: 1.39, h: 1.0, fontFace: FONT, fontSize: 8.2, color: C.grey, margin: 0 });
  });
  [1.75, 3.65, 5.55, 7.45].forEach((x) => s.addShape('rect', { x, y: 1.47, w: 0.85, h: 0.06, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } }));

  const quotes = [
    ['I just grab what I have had before. I have no idea what is actually in it.', 'Consumer, 20'],
    ['I threw away a full bag of vegetables last week. I forgot I bought them.', 'Working Professional, 34'],
    ['I never check expiry dates until something smells off.', 'Homemaker, 42'],
  ];
  quotes.forEach((q, i) => {
    const x = 0.45 + i * 2.95;
    card(s, true, x, 3.75, 2.85, 1.12);
    s.addText('"' + q[0] + '"', { x: x + 0.12, y: 3.92, w: 2.6, h: 0.58, fontFace: FONT, fontSize: 9.5, italic: true, color: C.grey, margin: 0 });
    s.addText('- ' + q[1], { x: x + 0.12, y: 4.62, w: 2.6, h: 0.14, fontFace: FONT, fontSize: 8.5, color: C.tealLt, align: 'right', margin: 0 });
  });
}

// Slide 9 light Ishikawa
{
  const s = lightSlide('DEFINE', 'Root Cause Analysis - Ishikawa Fishbone Diagram');
  s.addText('Why do urban consumers make uninformed food choices and waste groceries?', { x: 0.45, y: 1.02, w: 9.1, h: 0.16, fontFace: FONT, fontSize: 10, bold: true, color: C.greyDk, margin: 0 });

  s.addShape('rect', { x: 0.45, y: 2.85, w: 7.8, h: 0.04, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  card(s, false, 8.3, 2.45, 1.65, 0.88, C.tealLt);
  s.addShape('rect', { x: 8.3, y: 2.45, w: 1.65, h: 0.88, fill: { color: C.teal }, line: { color: C.tealLt, pt: 1 } });
  s.addText('Poor Food Decisions + Grocery Waste', { x: 8.42, y: 2.63, w: 1.4, h: 0.5, fontFace: FONT, fontSize: 8, bold: true, color: C.white, align: 'center', margin: 0 });

  const labelsTop = [['Manpower', 'No nutrition education', 0.45], ['Method', 'Labels for compliance', 3.2], ['Machine', 'No instant decoder tool', 5.8]];
  labelsTop.forEach((l) => {
    card(s, false, l[2], 1.22, 1.55, 0.52);
    s.addText(l[0], { x: l[2] + 0.1, y: 1.31, w: 1.35, h: 0.14, fontFace: FONT, fontSize: 10, bold: true, color: C.greyDk, margin: 0 });
    s.addText(l[1], { x: l[2] + 0.1, y: 1.49, w: 1.35, h: 0.14, fontFace: FONT, fontSize: 8.5, color: C.grey, margin: 0 });
  });
  [1.5, 3.9, 6.5].forEach((x) => s.addShape('line', { x, y: 1.72, w: 1.4, h: 1.15, line: { color: C.teal, pt: 1.5 } }));

  const labelsBottom = [['Material', 'Complex additive mixtures', 0.45], ['Measurement', 'No freshness tracking', 3.2], ['Environment', 'Limited food guidance', 5.8]];
  labelsBottom.forEach((l) => {
    card(s, false, l[2], 3.85, 1.55, 0.52);
    s.addText(l[0], { x: l[2] + 0.1, y: 3.94, w: 1.35, h: 0.14, fontFace: FONT, fontSize: 10, bold: true, color: C.greyDk, margin: 0 });
    s.addText(l[1], { x: l[2] + 0.1, y: 4.12, w: 1.35, h: 0.14, fontFace: FONT, fontSize: 8.5, color: C.grey, margin: 0 });
  });
  [1.5, 3.9, 6.5].forEach((x) => s.addShape('line', { x, y: 2.88, w: 1.4, h: 0.78, line: { color: C.teal, pt: 1.5 } }));
}

// Slide 10 dark 5 whys
{
  const s = darkSlide('DEFINE', '5 Whys Technique - Root Cause Drill-Down');
  s.addText('The 5 Whys technique (HUM 4412 Module 5) asks why repeatedly to uncover root cause.', { x: 0.45, y: 1.02, w: 9.1, h: 0.18, fontFace: FONT, fontSize: 9, italic: true, color: C.grey, margin: 0 });

  s.addShape('rect', { x: 0.45, y: 1.38, w: 4.45, h: 0.32, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  s.addText('Chain 1 - Nutritional Ignorance', { x: 0.45, y: 1.47, w: 4.45, h: 0.14, fontFace: FONT, fontSize: 10, bold: true, color: C.white, align: 'center', margin: 0 });
  s.addShape('rect', { x: 5.1, y: 1.38, w: 4.45, h: 0.32, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  s.addText('Chain 2 - Food Waste', { x: 5.1, y: 1.47, w: 4.45, h: 0.14, fontFace: FONT, fontSize: 10, bold: true, color: C.white, align: 'center', margin: 0 });

  const left = [
    'Consumers buy unhealthy food without knowing ingredient risks',
    'They do not check ingredient labels before purchase',
    'Labels are complex (2.9/5 understanding, 84% confusion)',
    'No simple real-time decoding tool exists',
    'ROOT CAUSE: No accessible food intelligence tool for Indian consumers',
  ];
  const right = [
    'Consumers waste groceries regularly (73% at least sometimes)',
    'They forget pantry items and expiry timelines',
    '94% have no tracking system (Q19)',
    'No pantry app for everyday Indian household behavior',
    'ROOT CAUSE: No purchase-to-pantry expiry-aware management app',
  ];

  left.forEach((t, i) => {
    const y = 1.78 + i * 0.6;
    card(s, true, 0.45, y, 4.45, 0.54, i === 4 ? C.teal : C.teal);
    s.addShape('rect', { x: 0.45, y, w: 0.42, h: 0.54, fill: { color: i === 4 ? C.teal : C.teal }, line: { color: C.teal, pt: 0 } });
    s.addText(String(i + 1), { x: 0.45, y: y + 0.17, w: 0.42, h: 0.16, fontFace: FONT, fontSize: 14, bold: true, color: C.white, align: 'center', margin: 0 });
    s.addText(t, { x: 1.02, y: y + 0.16, w: 3.75, h: 0.2, fontFace: FONT, fontSize: 9.3, color: C.grey, bold: i === 4, margin: 0 });
  });

  right.forEach((t, i) => {
    const y = 1.78 + i * 0.6;
    card(s, true, 5.1, y, 4.45, 0.54);
    s.addShape('rect', { x: 5.1, y, w: 0.42, h: 0.54, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
    s.addText(String(i + 1), { x: 5.1, y: y + 0.17, w: 0.42, h: 0.16, fontFace: FONT, fontSize: 14, bold: true, color: C.white, align: 'center', margin: 0 });
    s.addText(t, { x: 5.67, y: y + 0.16, w: 3.75, h: 0.2, fontFace: FONT, fontSize: 9.3, color: C.grey, bold: i === 4, margin: 0 });
  });

  s.addShape('rect', { x: 0.45, y: 5.1, w: 9.1, h: 0.32, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  s.addText('Both root causes are solved by a single solution - NutriTrusto', { x: 0.45, y: 5.19, w: 9.1, h: 0.14, fontFace: FONT, fontSize: 10, bold: true, color: C.white, align: 'center', margin: 0 });
}

// Slide 11 light nutritional awareness
{
  const s = lightSlide('SURVEY FINDINGS', 'Survey Findings - Nutritional Awareness (n=79)');
  const stats = [['33%', 'rarely or never check ingredients (Q4 scores 1-2)'], ['84%', 'find ingredient labels moderately to very confusing (Q9)'], ['2.9/5', 'average label comprehension score (Q8)'], ['80%', 'compare brands before buying (Q6)']];
  stats.forEach((st, i) => {
    const x = 0.45 + i * 2.2;
    card(s, false, x, 1.05, 2.1, 1.05);
    s.addText(st[0], { x: x + 0.1, y: 1.18, w: 1.0, h: 0.28, fontFace: FONT, fontSize: 24, bold: true, color: C.teal, margin: 0 });
    s.addText(st[1], { x: x + 0.1, y: 1.53, w: 1.9, h: 0.36, fontFace: FONT, fontSize: 10, color: C.grey, margin: 0 });
  });

  s.addText('How often do you check ingredients? (Q4 - scale 1 to 5)', { x: 0.45, y: 2.25, w: 9.1, h: 0.16, fontFace: FONT, fontSize: 10, bold: true, color: C.greyDk, margin: 0 });
  const d = [['Score 1 - Never', 13, 0.845], ['Score 2', 20, 1.3], ['Score 3 - Sometimes', 41, 2.67], ['Score 4', 18, 1.17], ['Score 5 - Always', 9, 0.585]];
  d.forEach((r, i) => {
    const y = 2.48 + i * 0.46;
    s.addText(r[0], { x: 0.45, y: y + 0.08, w: 1.3, h: 0.14, fontFace: FONT, fontSize: 9, color: C.greyDk, margin: 0 });
    s.addShape('rect', { x: 1.8, y: y + 0.05, w: 6.5, h: 0.28, fill: { color: C.greyLt }, line: { color: C.greyLt, pt: 0 } });
    s.addShape('rect', { x: 1.8, y: y + 0.05, w: r[2], h: 0.28, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
    s.addText(String(r[1]) + '%', { x: 1.8 + r[2] + 0.06, y: y + 0.11, w: 0.35, h: 0.12, fontFace: FONT, fontSize: 9, bold: true, color: C.teal, margin: 0 });
  });

  card(s, false, 0.45, 4.52, 9.1, 0.55);
  s.addShape('rect', { x: 0.45, y: 4.52, w: 0.06, h: 0.55, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  s.addText('Key insight: Despite 76% having some awareness of additive risks, 73% do not consistently check labels. The barrier is label complexity, not awareness.', { x: 0.58, y: 4.7, w: 8.9, h: 0.22, fontFace: FONT, fontSize: 10.5, color: C.greyDk, margin: 0 });
}

// Slide 12 dark waste and expiry
{
  const s = darkSlide('SURVEY FINDINGS', 'Survey Findings - Food Waste & Expiry (n=79)');
  const st = [['39%', 'consumed expired food\n(unknowingly or knowingly)'], ['73%', 'waste food at least\nsometimes (Q23)'], ['94%', 'no structured pantry\ntracking system (Q19)'], ['4.0/5', 'expiry reminders rated\nhelpful (Q21 avg)']];
  st.forEach((r, i) => {
    const x = 0.45 + i * 2.2;
    card(s, true, x, 1.05, 2.1, 1.05);
    s.addText(r[0], { x: x + 0.1, y: 1.18, w: 1.9, h: 0.22, fontFace: FONT, fontSize: 22, bold: true, color: C.tealLt, align: 'center', margin: 0 });
    s.addText(r[1], { x: x + 0.1, y: 1.47, w: 1.9, h: 0.42, fontFace: FONT, fontSize: 8.5, color: C.grey, align: 'center', margin: 0 });
  });

  s.addText('How respondents currently track groceries (Q19)', { x: 0.45, y: 2.25, w: 9.1, h: 0.16, fontFace: FONT, fontSize: 10, bold: true, color: C.tealLt, margin: 0 });
  const bars = [['Try to remember', 56, 3.64], ['Just check the fridge', 38, 2.47], ['Write it down', 5, 0.325], ['Use an app', 1, 0.065]];
  bars.forEach((b, i) => {
    const y = 2.48 + i * 0.34;
    s.addText(b[0] + ' (' + b[1] + '%)', { x: 0.45, y: y + 0.07, w: 1.95, h: 0.14, fontFace: FONT, fontSize: 9, color: C.grey, margin: 0 });
    s.addShape('rect', { x: 2.5, y: y + 0.04, w: 5.2, h: 0.2, fill: { color: C.greyDk }, line: { color: C.greyDk, pt: 0 } });
    s.addShape('rect', { x: 2.5, y: y + 0.04, w: b[2], h: 0.2, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  });

  s.addText('Food waste frequency (Q23)', { x: 0.45, y: 3.62, w: 9.1, h: 0.16, fontFace: FONT, fontSize: 10, bold: true, color: C.tealLt, margin: 0 });
  const waste = [['Never', 11], ['Rarely', 15], ['Sometimes', 35], ['Often', 32], ['Very often', 6]];
  waste.forEach((w, i) => {
    const y = 3.82 + i * 0.25;
    const ww = (w[1] / 35) * 2.8;
    s.addText(w[0] + ' ' + w[1] + '%', { x: 0.45, y: y + 0.05, w: 1.2, h: 0.12, fontFace: FONT, fontSize: 8.5, color: C.grey, margin: 0 });
    s.addShape('rect', { x: 1.72, y: y + 0.02, w: 2.9, h: 0.16, fill: { color: C.greyDk }, line: { color: C.greyDk, pt: 0 } });
    s.addShape('rect', { x: 1.72, y: y + 0.02, w: ww, h: 0.16, fill: { color: C.amber }, line: { color: C.amber, pt: 0 } });
  });

  card(s, true, 0.45, 5.0, 9.1, 0.38, C.red);
  s.addText('94% have no pantry system - the issue is not willingness, but absence of a simple, accessible tool.', { x: 0.6, y: 5.12, w: 8.8, h: 0.14, fontFace: FONT, fontSize: 10, color: C.grey, margin: 0 });
}

// Slide 13 light personas
{
  const s = lightSlide('EMPATHIZE', 'User Personas - Derived from Survey & Research');
  s.addText('Based on HUM 4412 Customer Persona framework - research-backed profiles of target users.', { x: 0.45, y: 1.02, w: 9.1, h: 0.16, fontFace: FONT, fontSize: 9, italic: true, color: C.grey, margin: 0 });

  card(s, false, 0.45, 1.18, 4.45, 4.0);
  card(s, false, 5.1, 1.18, 4.45, 4.0);

  s.addShape('rect', { x: 0.45, y: 1.18, w: 4.45, h: 0.38, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  s.addText('PERSONA 1 - THE ACTIVE CONSUMER', { x: 0.58, y: 1.31, w: 4.15, h: 0.14, fontFace: FONT, fontSize: 9, bold: true, color: C.white, margin: 0 });
  s.addShape('ellipse', { x: 0.65, y: 1.7, w: 0.72, h: 0.72, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  s.addText('RP', { x: 0.65, y: 1.7, w: 0.72, h: 0.72, fontFace: FONT, fontSize: 14, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });
  s.addText('Rahul P.', { x: 1.5, y: 1.82, w: 3.2, h: 0.18, fontFace: FONT, fontSize: 13, bold: true, color: C.greyDk, margin: 0 });
  s.addText('Age 20 · Bengaluru · Undergrad Student', { x: 1.5, y: 2.08, w: 3.2, h: 0.14, fontFace: FONT, fontSize: 9, color: C.grey, margin: 0 });
  s.addShape('rect', { x: 0.65, y: 2.32, w: 4.05, h: 0.01, fill: { color: C.greyLt }, line: { color: C.greyLt, pt: 0 } });
  bulletText(s, 0.65, 2.42, 4.05, 2.0, ['Buys packaged food daily', 'Rarely checks labels (score 1-2)', 'Tracks pantry by visual fridge checks', 'Goal: quick, low-effort healthy decisions', 'Pain: additive names are unclear'], C.greyDk, 9);
  s.addShape('rect', { x: 0.65, y: 4.52, w: 3.65, h: 0.52, fill: { color: C.mint }, line: { color: C.teal, pt: 1 } });
  s.addText('"I just grab what I know. I need instant ingredient clarity."', { x: 0.78, y: 4.68, w: 3.35, h: 0.18, fontFace: FONT, fontSize: 8.5, italic: true, color: C.greyDk, margin: 0 });

  s.addShape('rect', { x: 5.1, y: 1.18, w: 4.45, h: 0.38, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  s.addText('PERSONA 2 - THE MINDFUL HOMEMAKER', { x: 5.23, y: 1.31, w: 4.15, h: 0.14, fontFace: FONT, fontSize: 9, bold: true, color: C.white, margin: 0 });
  s.addShape('ellipse', { x: 5.3, y: 1.7, w: 0.72, h: 0.72, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  s.addText('SK', { x: 5.3, y: 1.7, w: 0.72, h: 0.72, fontFace: FONT, fontSize: 14, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });
  s.addText('Sujata K.', { x: 6.15, y: 1.82, w: 3.2, h: 0.18, fontFace: FONT, fontSize: 13, bold: true, color: C.greyDk, margin: 0 });
  s.addText('Age 38 · Mumbai · Homemaker', { x: 6.15, y: 2.08, w: 3.2, h: 0.14, fontFace: FONT, fontSize: 9, color: C.grey, margin: 0 });
  s.addShape('rect', { x: 5.3, y: 2.32, w: 4.05, h: 0.01, fill: { color: C.greyLt }, line: { color: C.greyLt, pt: 0 } });
  bulletText(s, 5.3, 2.42, 4.05, 2.0, ['Buys packaged products occasionally', 'Checks labels sometimes (score 3)', 'Tracks groceries by memory/list notes', 'Goal: reduce monthly household waste', 'Pain: expiry and label complexity'], C.greyDk, 9);
  s.addShape('rect', { x: 5.3, y: 4.52, w: 3.65, h: 0.52, fill: { color: C.mint }, line: { color: C.teal, pt: 1 } });
  s.addText('"I want better decisions, but labels are hard to decode quickly."', { x: 5.43, y: 4.68, w: 3.35, h: 0.18, fontFace: FONT, fontSize: 8.5, italic: true, color: C.greyDk, margin: 0 });
}

// Slide 14 dark data to insights
{
  const s = darkSlide('DEFINE', 'From Data to Robust Insights');
  s.addText('Problem definition journey - raw data to validated POV', { x: 0.45, y: 1.02, w: 9.1, h: 0.16, fontFace: FONT, fontSize: 9, italic: true, color: C.grey, margin: 0 });
  const boxes = [['RAW DATA', '79 surveys + 8 interviews + notes'], ['CLUSTERING', 'Affinity mapping'], ['THEMES', '2 core themes'], ['INSIGHT', 'Evidence-based'], ['POV STATEMENT', 'Validated']];
  boxes.forEach((b, i) => {
    const x = 0.45 + i * 1.75;
    card(s, true, x, 1.35, 1.62, 0.78);
    s.addText(b[0], { x: x + 0.08, y: 1.53, w: 1.46, h: 0.14, fontFace: FONT, fontSize: 8, bold: true, color: C.tealLt, align: 'center', charSpace: 1, margin: 0 });
    s.addText(b[1], { x: x + 0.08, y: 1.73, w: 1.46, h: 0.14, fontFace: FONT, fontSize: 8, color: C.grey, align: 'center', margin: 0 });
    if (i < 4) s.addShape('rect', { x: 2.12 + i * 1.75, y: 1.57, w: 0.08, h: 0.25, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  });

  card(s, true, 0.45, 2.28, 4.45, 0.68);
  s.addText('Theme 1: Nutritional Blindness at Purchase', { x: 0.62, y: 2.43, w: 4.1, h: 0.16, fontFace: FONT, fontSize: 10, bold: true, color: C.white, margin: 0 });
  s.addText('73% do not consistently check labels; 84% report confusion.', { x: 0.62, y: 2.65, w: 4.1, h: 0.16, fontFace: FONT, fontSize: 9, color: C.grey, margin: 0 });

  card(s, true, 5.1, 2.28, 4.45, 0.68);
  s.addText('Theme 2: Reactive Pantry Management', { x: 5.27, y: 2.43, w: 4.1, h: 0.16, fontFace: FONT, fontSize: 10, bold: true, color: C.white, margin: 0 });
  s.addText('94% rely on memory/fridge checks; 73% waste food regularly.', { x: 5.27, y: 2.65, w: 4.1, h: 0.16, fontFace: FONT, fontSize: 9, color: C.grey, margin: 0 });

  const insights = ['94% no pantry system -> reactive, not proactive behavior', '33% never check labels -> complexity barrier', '39% consumed expired food -> present safety risk', '71% high intent to use NutriTrusto -> validated demand'];
  insights.forEach((t, i) => {
    const x = i % 2 === 0 ? 0.45 : 5.1;
    const y = 3.08 + Math.floor(i / 2) * 0.75;
    card(s, true, x, y, 4.45, 0.65);
    s.addShape('rect', { x, y, w: 0.06, h: 0.65, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
    s.addText(t, { x: x + 0.15, y: y + 0.23, w: 4.2, h: 0.16, fontFace: FONT, fontSize: 9, color: C.grey, margin: 0 });
  });

  s.addShape('rect', { x: 0.45, y: 4.58, w: 9.1, h: 0.4, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
  s.addText('Insights directly shaped the final POV statement and NutriTrusto core features', { x: 0.45, y: 4.71, w: 9.1, h: 0.14, fontFace: FONT, fontSize: 10, color: C.white, align: 'center', margin: 0 });
}

// Slide 15 light final problem
{
  const s = lightSlide('DEFINE', 'Final Problem Definition');
  s.addText('Point of View (POV) Statement', { x: 0.45, y: 1.02, w: 9.1, h: 0.16, fontFace: FONT, fontSize: 11, bold: true, color: C.greyDk, margin: 0 });
  s.addShape('rect', { x: 0.45, y: 1.22, w: 9.1, h: 0.98, fill: { color: C.teal }, line: { color: C.teal, pt: 0 }, shadow: makeShadow() });
  s.addText('Urban consumers need a way to make informed food choices and avoid waste - because they shop with limited nutritional knowledge and have no system to track what they own or when it expires.', { x: 0.62, y: 1.54, w: 8.75, h: 0.32, fontFace: FONT, fontSize: 13, italic: true, color: C.white, align: 'center', margin: 0 });

  s.addText('Validated Problem Statement', { x: 0.45, y: 2.32, w: 9.1, h: 0.16, fontFace: FONT, fontSize: 11, bold: true, color: C.greyDk, margin: 0 });
  card(s, false, 0.45, 2.52, 9.1, 0.88);
  s.addShape('rect', { x: 0.45, y: 2.52, w: 0.06, h: 0.88, fill: { color: C.red }, line: { color: C.red, pt: 0 } });
  s.addText('Urban consumers across India lack accessible tools to evaluate packaged-food nutrition at point of purchase and systematically track perishable groceries, resulting in uninformed dietary choices and avoidable waste.', { x: 0.58, y: 2.82, w: 8.8, h: 0.32, fontFace: FONT, fontSize: 11.5, color: C.greyDk, margin: 0 });

  s.addText('Contributing Sub-Problems (Survey-Validated)', { x: 0.45, y: 3.55, w: 9.1, h: 0.16, fontFace: FONT, fontSize: 11, bold: true, color: C.greyDk, margin: 0 });
  const subs = [['P1', 'No real-time tool to decode Indian packaged food labels at purchase', 'Q4,Q8,Q9'], ['P2', 'No integrated system connecting purchase to expiry-aware pantry tracking', 'Q19,Q21'], ['P3', 'Low awareness of additives, processing levels, and banned ingredients', 'Q11,Q13'], ['P4', 'No AI recipe guidance to utilize food before spoilage', 'Q23,Q26']];
  subs.forEach((r, i) => {
    const y = 3.78 + i * 0.43;
    s.addShape('rect', { x: 0.45, y, w: 0.48, h: 0.35, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
    s.addText(r[0], { x: 0.45, y: y + 0.11, w: 0.48, h: 0.12, fontFace: FONT, fontSize: 10, bold: true, color: C.white, align: 'center', margin: 0 });
    card(s, false, 1.05, y, 7.38, 0.35);
    s.addText(r[1], { x: 1.2, y: y + 0.11, w: 7.05, h: 0.12, fontFace: FONT, fontSize: 9, color: C.greyDk, margin: 0 });
    s.addShape('rect', { x: 8.45, y, w: 1.1, h: 0.35, fill: { color: C.mint }, line: { color: C.teal, pt: 0.5 } });
    s.addText(r[2], { x: 8.45, y: y + 0.11, w: 1.1, h: 0.12, fontFace: FONT, fontSize: 8, bold: true, color: C.teal, align: 'center', margin: 0 });
  });
}

// Slide 16 dark objectives + hypotheses
{
  const s = darkSlide('OBJECTIVES', 'Research Objectives & Hypotheses');
  s.addText('Research Objectives', { x: 0.45, y: 1.05, w: 4.45, h: 0.16, fontFace: FONT, fontSize: 12, bold: true, color: C.white, margin: 0 });
  const obj = ['Assess impact of real-time ratings on informed purchase behavior', 'Evaluate smart pantry tracking + expiry alerts in reducing waste', 'Examine AI recipe suggestion effect on ingredient utilization', 'Measure acceptance of NutriTrusto using TAM'];
  obj.forEach((o, i) => {
    const y = 1.35 + i * 0.92;
    card(s, true, 0.45, y, 4.45, 0.82);
    s.addShape('ellipse', { x: 0.52, y: y + 0.26, w: 0.3, h: 0.3, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
    s.addText(String(i + 1), { x: 0.52, y: y + 0.26, w: 0.3, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });
    s.addText('O' + String(i + 1) + ': ' + o, { x: 1.05, y: y + 0.3, w: 3.72, h: 0.18, fontFace: FONT, fontSize: 9.5, color: C.grey, margin: 0 });
  });

  s.addText('Research Hypotheses', { x: 5.1, y: 1.05, w: 4.45, h: 0.16, fontFace: FONT, fontSize: 12, bold: true, color: C.white, margin: 0 });
  const h = [['H1', 'Real-time barcode info -> informed healthier purchase decisions', 'HBM'], ['H2', 'Expiry alerts -> significantly reduced food wastage', 'Nudge'], ['H3', 'AI recipes from expiring ingredients -> higher utilization', 'Nudge'], ['H4', 'Diet-preference filtering -> improved trust and engagement', 'TAM'], ['H5', 'Visual ratings outperform raw labels in influencing choice', 'HBM+TAM']];
  h.forEach((r, i) => {
    const y = 1.35 + i * 0.76;
    card(s, true, 5.1, y, 4.45, 0.68);
    s.addShape('rect', { x: 5.1, y, w: 0.55, h: 0.68, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
    s.addText(r[0], { x: 5.1, y: y + 0.22, w: 0.55, h: 0.16, fontFace: FONT, fontSize: 14, bold: true, color: C.white, align: 'center', margin: 0 });
    s.addText(r[1], { x: 5.75, y: y + 0.22, w: 3.2, h: 0.16, fontFace: FONT, fontSize: 10, color: C.grey, margin: 0 });
    s.addShape('rect', { x: 8.98, y: y + 0.1, w: 0.48, h: 0.22, fill: { color: C.mint }, line: { color: C.mint, pt: 0 } });
    s.addText(r[2], { x: 8.98, y: y + 0.16, w: 0.48, h: 0.1, fontFace: FONT, fontSize: 8, bold: true, color: C.teal, align: 'center', margin: 0 });
  });

  s.addText('HBM = Health Belief Model  |  TAM = Technology Acceptance Model  |  Nudge = Nudge Theory', { x: 0.45, y: 5.28, w: 9.1, h: 0.14, fontFace: FONT, fontSize: 9, italic: true, color: C.grey, align: 'center', margin: 0 });
}

// Slide 17 dark methodology
{
  const s = darkSlide('METHODOLOGY', 'Research Methodology & Questionnaire Design');
  const cards = [
    ['Research Design', 'Descriptive + Exploratory mixed-method design'],
    ['Research Approach', 'Quantitative survey + Qualitative interviews & observation'],
    ['Target Population', 'Urban consumers 18-60 across all occupation types'],
    ['Sampling Method', 'Purposive + Snowball via networks and communities'],
    ['Sample Size', '79 respondents achieved (target: 100+)'],
    ['Data Collection', '30-Q form + interviews + observational study'],
    ['Data Analysis', 'Descriptive stats, Likert scale, thematic coding, affinity mapping'],
    ['Tech Stack', 'Next.js, Supabase, Open Food Facts API, Gemini AI, Vercel'],
  ];
  cards.forEach((c, i) => {
    const x = i % 2 === 0 ? 0.45 : 5.1;
    const y = [1.05, 1.87, 2.69, 3.51][Math.floor(i / 2)];
    card(s, true, x, y, 4.45, 0.72);
    s.addText(c[0], { x: x + 0.14, y: y + 0.1, w: 4.1, h: 0.12, fontFace: FONT, fontSize: 8, bold: true, color: C.tealLt, charSpace: 1, margin: 0 });
    s.addText(c[1], { x: x + 0.14, y: y + 0.37, w: 4.1, h: 0.2, fontFace: FONT, fontSize: 11, color: C.white, margin: 0 });
  });

  s.addText('Survey Structure - 30 Questions across 4 Stages', { x: 0.45, y: 4.42, w: 9.1, h: 0.14, fontFace: FONT, fontSize: 9, bold: true, color: C.tealLt, margin: 0 });
  const st = [['Stage 1', 'Food Habits · Q1-Q9'], ['Stage 2', 'Safety & Expiry · Q10-Q22'], ['Stage 3', 'Waste Behaviour · Q23-Q26'], ['Stage 4', 'App Intent · Q27-Q30']];
  st.forEach((r, i) => {
    const x = [0.45, 2.66, 4.87, 7.08][i];
    card(s, true, x, 4.62, 2.15, 0.48);
    s.addShape('rect', { x, y: 4.62, w: 2.15, h: 0.26, fill: { color: C.teal }, line: { color: C.teal, pt: 0 } });
    s.addText(r[0], { x, y: 4.71, w: 2.15, h: 0.12, fontFace: FONT, fontSize: 9, bold: true, color: C.white, align: 'center', margin: 0 });
    s.addText(r[1], { x, y: 4.92, w: 2.15, h: 0.1, fontFace: FONT, fontSize: 8, color: C.grey, align: 'center', margin: 0 });
  });
}

async function writeFiles() {
  const cwd = process.cwd();
  const local = path.join(cwd, 'NutriTrusto_Final.pptx');
  const homeDir = path.join('C:\\', 'home', 'claude');
  const outDir = path.join('C:\\', 'mnt', 'user-data', 'outputs');
  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  await pres.writeFile({ fileName: local });
  fs.copyFileSync(local, path.join(homeDir, 'NutriTrusto_Final.pptx'));
  fs.copyFileSync(local, path.join(outDir, 'NutriTrusto_Final.pptx'));
  console.log('Created:', local);
  console.log('Slides:', pres._slides.length);
}

writeFiles().catch((e) => {
  console.error(e);
  process.exit(1);
});
