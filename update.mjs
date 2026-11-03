// อัปเดตยอดฟอลวันละครั้ง (GitHub Actions เรียกไฟล์นี้ให้อัตโนมัติ)
//
// 1) อ่านรายชื่อจาก Google Sheets (ถ้าตั้ง SHEET_CSV_URL) หรือจาก data/people.csv
// 2) ดึงยอดอัตโนมัติ: YouTube (YOUTUBE_API_KEY) และ Instagram (IG_USER_ID + IG_ACCESS_TOKEN)
// 3) แพลตฟอร์มที่ดึงไม่ได้ ใช้ตัวเลขที่กรอกเองในชีต ถ้าไม่มีก็ใช้ตัวเลขล่าสุดที่เคยเก็บไว้
// 4) เขียน data/latest.json และเพิ่มข้อมูลวันนี้ลง data/history.json
//
// รันเองบนเครื่อง: node scripts/update.mjs   (ไม่ต้องติดตั้งอะไรเพิ่ม ใช้ Node 18 ขึ้นไป)

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const PEOPLE_CSV = path.join(DATA_DIR, 'people.csv');
const LATEST_JSON = path.join(DATA_DIR, 'latest.json');
const HISTORY_JSON = path.join(DATA_DIR, 'history.json');

export const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'x', 'facebook'];

const env = process.env;
const SHEET_CSV_URL = (env.SHEET_CSV_URL || '').trim();
const YT_KEY = (env.YOUTUBE_API_KEY || '').trim();
const IG_USER_ID = (env.IG_USER_ID || '').trim();
const IG_TOKEN = (env.IG_ACCESS_TOKEN || '').trim();
const GRAPH_VERSION = (env.GRAPH_API_VERSION || 'v25.0').trim();
const HISTORY_DAYS = Number(env.HISTORY_DAYS || 730);

// ---------- CSV ----------
export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter(r => r.some(v => v.trim() !== ''));
  if (!nonEmpty.length) return [];
  const headers = nonEmpty[0].map(h => h.trim().toLowerCase());
  return nonEmpty.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
}

// "1,234,567" / "1.2M" / "850K" / "1.2 ล้าน" / "8.5 แสน" -> ตัวเลข
export function parseCount(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/,/g, '').replace(/\s+/g, '').toLowerCase();
  if (!s) return null;
  const units = [['ล้าน', 1e6], ['แสน', 1e5], ['หมื่น', 1e4], ['พัน', 1e3], ['m', 1e6], ['k', 1e3], ['b', 1e9]];
  for (const [u, mult] of units) {
    if (s.endsWith(u)) {
      const n = parseFloat(s.slice(0, -u.length));
      return Number.isFinite(n) ? Math.round(n * mult) : null;
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// ตัด @ และลิงก์ออก เหลือแค่ชื่อบัญชี
export function cleanHandle(platform, raw) {
  let s = (raw || '').trim();
  if (!s) return '';
  s = s.replace(/^https?:\/\//i, '').replace(/^(www\.|m\.)/i, '');
  if (platform === 'youtube') {
    const ch = s.match(/youtube\.com\/channel\/(UC[\w-]{22})/i);
    if (ch) return ch[1];
  }
  s = s.replace(/^[a-z0-9.-]+\.(com|net)\//i, ''); // instagram.com/, tiktok.com/, x.com/ ...
  s = s.split(/[/?#]/)[0];
  return s.replace(/^@/, '');
}

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function bangkokDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- โหลดรายชื่อ ----------
async function loadPeopleRows() {
  if (SHEET_CSV_URL) {
    console.log('อ่านรายชื่อจาก Google Sheets');
    const res = await fetch(SHEET_CSV_URL, { redirect: 'follow' });
    if (!res.ok) throw new Error(`โหลด Google Sheets ไม่ได้ (HTTP ${res.status}) ตรวจว่าเผยแพร่ชีตเป็น CSV แล้ว`);
    const text = await res.text();
    if (/^\s*<!doctype html/i.test(text)) throw new Error('ลิงก์ Google Sheets ไม่ใช่ CSV ให้ใช้ลิงก์จากเมนู เผยแพร่ไปยังเว็บ > CSV');
    return parseCSV(text);
  }
  console.log('อ่านรายชื่อจาก data/people.csv');
  return parseCSV(await readFile(PEOPLE_CSV, 'utf8'));
}

function normalizePeople(rows) {
  const seen = new Set();
  const people = [];
  rows.forEach((r, i) => {
    const name = r.name || r['ชื่อ'] || '';
    if (!name) return;
    const handles = {};
    for (const p of PLATFORMS) handles[p] = cleanHandle(p, r[p]);
    let id = slugify(r.id) || slugify(r.name_en) || slugify(Object.values(handles).find(Boolean)) || `p${i + 1}`;
    while (seen.has(id)) id += '-2';
    seen.add(id);
    const manual = {};
    for (const p of PLATFORMS) manual[p] = parseCount(r[`${p}_count`]);
    people.push({ id, name, name_en: r.name_en || '', category: r.category || 'อื่น ๆ', handles, manual });
  });
  return people;
}

// ---------- YouTube ----------
async function fetchYouTube(people) {
  const out = new Map();
  if (!YT_KEY) { console.log('ข้าม YouTube (ยังไม่ได้ตั้ง YOUTUBE_API_KEY)'); return out; }
  const targets = people.filter(p => p.handles.youtube);
  const byId = targets.filter(p => /^UC[\w-]{22}$/.test(p.handles.youtube));
  const byHandle = targets.filter(p => !byId.includes(p));
  const base = 'https://www.googleapis.com/youtube/v3/channels?part=statistics';

  for (let i = 0; i < byId.length; i += 50) {
    const batch = byId.slice(i, i + 50);
    const url = `${base}&maxResults=50&id=${batch.map(p => p.handles.youtube).join(',')}&key=${YT_KEY}`;
    try {
      const json = await getJSON(url);
      for (const item of json.items || []) {
        const p = batch.find(b => b.handles.youtube === item.id);
        if (p && !item.statistics.hiddenSubscriberCount) out.set(p.id, Number(item.statistics.subscriberCount));
      }
    } catch (e) { console.warn(`YouTube: ${e.message}`); }
  }
  for (const p of byHandle) {
    const url = `${base}&forHandle=${encodeURIComponent('@' + p.handles.youtube)}&key=${YT_KEY}`;
    try {
      const json = await getJSON(url);
      const item = json.items?.[0];
      if (!item) console.warn(`YouTube: ไม่พบช่อง @${p.handles.youtube} (${p.name})`);
      else if (item.statistics.hiddenSubscriberCount) console.warn(`YouTube: @${p.handles.youtube} ซ่อนยอดผู้ติดตาม`);
      else out.set(p.id, Number(item.statistics.subscriberCount));
    } catch (e) { console.warn(`YouTube @${p.handles.youtube}: ${e.message}`); }
  }
  console.log(`YouTube: ดึงได้ ${out.size}/${targets.length} ช่อง`);
  return out;
}

// ---------- Instagram (Business Discovery) ----------
// ใช้ได้เฉพาะบัญชีปลายทางที่เป็น Business หรือ Creator
async function fetchInstagram(people) {
  const out = new Map();
  if (!IG_USER_ID || !IG_TOKEN) { console.log('ข้าม Instagram (ยังไม่ได้ตั้ง IG_USER_ID / IG_ACCESS_TOKEN)'); return out; }
  const targets = people.filter(p => p.handles.instagram);
  if (targets.length > 180) console.warn(`Instagram: มี ${targets.length} บัญชี อาจชนลิมิตการเรียกต่อชั่วโมง`);
  for (const p of targets) {
    const u = p.handles.instagram;
    const fields = `business_discovery.username(${u}){followers_count,username}`;
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${IG_USER_ID}?fields=${encodeURIComponent(fields)}&access_token=${IG_TOKEN}`;
    try {
      const json = await getJSON(url);
      const n = json.business_discovery?.followers_count;
      if (typeof n === 'number') out.set(p.id, n);
      else console.warn(`Instagram: @${u} ไม่มียอดผู้ติดตามในผลลัพธ์`);
    } catch (e) {
      console.warn(`Instagram @${u}: ${e.message}`);
      if (/expired|session has been invalidated|code 190/i.test(e.message)) {
        console.warn('Instagram: Access token หมดอายุ ต้องสร้างใหม่ (ดูวิธีใน README) ใช้ตัวเลขเดิมไปก่อน');
        break;
      }
    }
    await sleep(300);
  }
  console.log(`Instagram: ดึงได้ ${out.size}/${targets.length} บัญชี`);
  return out;
}

async function getJSON(url) {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const err = json.error || {};
    throw new Error(`${err.message || `HTTP ${res.status}`}${err.code ? ` (code ${err.code})` : ''}`);
  }
  return json;
}

async function readJSON(file, fallback) {
  if (!existsSync(file)) return fallback;
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

// ---------- main ----------
async function main() {
  const people = normalizePeople(await loadPeopleRows());
  if (!people.length) throw new Error('ไม่พบรายชื่อ ตรวจว่ามีคอลัมน์ name และมีข้อมูลอย่างน้อย 1 แถว');
  console.log(`รายชื่อทั้งหมด ${people.length} คน`);

  const prevLatest = await readJSON(LATEST_JSON, { people: [] });
  let history = await readJSON(HISTORY_JSON, { platforms: PLATFORMS, days: {} });
  if (prevLatest.sample) {
    console.log('ล้างข้อมูลตัวอย่าง เริ่มเก็บประวัติจริงตั้งแต่วันนี้');
    prevLatest.people = [];
    history = { platforms: PLATFORMS, days: {} };
  }
  const prevById = new Map((prevLatest.people || []).map(p => [p.id, p]));

  const [yt, ig] = await Promise.all([fetchYouTube(people), fetchInstagram(people)]);
  const api = { youtube: yt, instagram: ig };

  const outPeople = people.map(p => {
    const counts = {}, source = {};
    const prev = prevById.get(p.id);
    for (const plat of PLATFORMS) {
      if (!p.handles[plat] && p.manual[plat] == null) { counts[plat] = null; continue; }
      if (api[plat]?.has(p.id)) { counts[plat] = api[plat].get(p.id); source[plat] = 'api'; }
      else if (p.manual[plat] != null) { counts[plat] = p.manual[plat]; source[plat] = 'manual'; }
      else if (prev?.counts?.[plat] != null) { counts[plat] = prev.counts[plat]; source[plat] = 'previous'; }
      else counts[plat] = null;
    }
    return { id: p.id, name: p.name, name_en: p.name_en, category: p.category, handles: p.handles, counts, source };
  });

  const today = bangkokDate();
  history.platforms = PLATFORMS;
  history.days[today] = Object.fromEntries(outPeople.map(p => [p.id, PLATFORMS.map(k => p.counts[k])]));
  const keep = Object.keys(history.days).sort().slice(-HISTORY_DAYS);
  history.days = Object.fromEntries(keep.map(d => [d, history.days[d]]));

  const latest = { updated_at: new Date().toISOString(), date: today, platforms: PLATFORMS, people: outPeople };
  await writeFile(LATEST_JSON, JSON.stringify(latest, null, 1) + '\n');
  await writeFile(HISTORY_JSON, JSON.stringify(history) + '\n');
  console.log(`บันทึกแล้ว: ${outPeople.length} คน, ประวัติ ${keep.length} วัน`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(e => { console.error(`ผิดพลาด: ${e.message}`); process.exit(1); });
}
