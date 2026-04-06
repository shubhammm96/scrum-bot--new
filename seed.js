/**
 * StandupPro v11 — Seed Script
 * KPIT LRT PF26 — Honda
 *
 * Usage:  node seed.js
 *
 * Credentials:
 *   Admin    : ADM001 / admin@kpit
 *   All else : emp_id / kpit@123
 */

require('dotenv').config();
const bcrypt  = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const { randomBytes } = require('crypto');

const DB_PATH = path.join(__dirname, 'standup.db');
const db = new sqlite3.Database(DB_PATH);

function uid(p = 'U') { return p + randomBytes(4).toString('hex').toUpperCase(); }
function run(sql, params = []) {
  return new Promise((res, rej) =>
    db.run(sql, params, function(err) { if (err) rej(err); else res(this); })
  );
}
function get(sql, params = []) {
  return new Promise((res, rej) =>
    db.get(sql, params, (err, row) => { if (err) rej(err); else res(row); })
  );
}
function all(sql, params = []) {
  return new Promise((res, rej) =>
    db.all(sql, params, (err, rows) => { if (err) rej(err); else res(rows); })
  );
}

const PASS_DEFAULT = bcrypt.hashSync('kpit@123', 12);
const PASS_ADMIN   = bcrypt.hashSync('admin@kpit', 12);

async function seed() {

  /* ── Schema (idempotent) ── */
  const tables = [
    `CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT DEFAULT '', standup_time TEXT DEFAULT '09:00', standup_timezone TEXT DEFAULT 'Asia/Kolkata', window_duration INTEGER DEFAULT 30, productivity_threshold REAL DEFAULT 3.0, planned_actual_gap_threshold REAL DEFAULT 0.20, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, emp_id TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'te', manager_id TEXT, team_id TEXT, theme TEXT NOT NULL DEFAULT 'dark', avatar_color TEXT DEFAULT '#38bdf8', job_title TEXT DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS standups (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, date TEXT NOT NULL, completed TEXT NOT NULL, planned TEXT NOT NULL, blockers TEXT DEFAULT '', blocker_description TEXT DEFAULT '', blocker_type TEXT DEFAULT '', blocker_resolved INTEGER DEFAULT 0, productivity_gap TEXT DEFAULT '', other_activity TEXT DEFAULT '', goals TEXT DEFAULT '', tags TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, date))`,
    `CREATE TABLE IF NOT EXISTS reactions (id INTEGER PRIMARY KEY AUTOINCREMENT, standup_id INTEGER NOT NULL, user_id TEXT NOT NULL, emoji TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(standup_id, user_id, emoji))`,
    `CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, standup_id INTEGER NOT NULL, user_id TEXT NOT NULL, text TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS leaves (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, date TEXT NOT NULL, reason TEXT DEFAULT '', leave_type TEXT DEFAULT 'other', half_day INTEGER DEFAULT 0, approved INTEGER DEFAULT 0, approver_id TEXT DEFAULT NULL, approved_at DATETIME DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, date))`,
    `CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, link_view TEXT DEFAULT '', read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS holidays (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS working_saturdays (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL UNIQUE, label TEXT NOT NULL DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, team_id TEXT DEFAULT NULL, description TEXT DEFAULT '', created_by TEXT NOT NULL, active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT DEFAULT '', activity_id INTEGER NOT NULL, assigned_to TEXT DEFAULT NULL, created_by TEXT NOT NULL, team_id TEXT DEFAULT NULL, due_date TEXT DEFAULT NULL, priority TEXT DEFAULT 'medium', status TEXT DEFAULT 'open', weight_percent REAL DEFAULT 100, productivity_score REAL DEFAULT NULL, expected_count REAL DEFAULT NULL, notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS standup_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, standup_id INTEGER NOT NULL, task_id INTEGER NOT NULL, user_id TEXT NOT NULL, date TEXT NOT NULL, actual_count REAL DEFAULT 0, is_planned INTEGER DEFAULT 0, planned_count REAL DEFAULT NULL, task_description TEXT DEFAULT '', task_feature_id TEXT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(standup_id, task_id, is_planned))`,
    `CREATE TABLE IF NOT EXISTS task_features (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL, name TEXT NOT NULL, created_by TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(task_id, name))`,
    `CREATE TABLE IF NOT EXISTS productivity_targets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, date TEXT NOT NULL, defined_value REAL NOT NULL, unit TEXT NOT NULL DEFAULT 'TC Dev', defined_by TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, date))`,
    `CREATE TABLE IF NOT EXISTS productivity_plans (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, date TEXT NOT NULL, planned_value REAL NOT NULL, unit TEXT NOT NULL DEFAULT 'TC Dev', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, date))`,
    `CREATE TABLE IF NOT EXISTS productivity_actuals (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, date TEXT NOT NULL, actual_value REAL NOT NULL, unit TEXT NOT NULL DEFAULT 'TC Dev', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, date))`,
  ];
  for (const t of tables) await run(t);

  /* ── Purge inactive and old demo users ── */
  await run(`DELETE FROM users WHERE active = 0`);
  const keepEmpIds = [
    'ADM001',
    '135750','125122','140486','151229','154825','153839','145107','145014',
    '144232','158584','141418','153655','158986','158292','153152','150425',
    '155741','150429','149817','150421','153893','154874','155014','155015',
    '156550','156555','154870','159191','127207','158894','154351','152451',
    '144553','143915','144192','159095','159757','159747','159772',
  ];
  const kph = keepEmpIds.map(() => '?').join(',');
  await run(`DELETE FROM users WHERE emp_id NOT IN (${kph})`, keepEmpIds);

  /* ── Keep only TC Development and TC Execution ── */
  await run(`DELETE FROM teams WHERE name NOT IN ('TC Development','TC Execution')`);

  /* ── Clean tasks/features/activities — full replace ── */
  await run(`DELETE FROM task_features`);
  await run(`DELETE FROM tasks`);
  await run(`DELETE FROM activities`);

  /* ────────────────────────────────────────────────────────────
     IDs
  ──────────────────────────────────────────────────────────── */
  const adminId    = uid('U');
  const mgrArpit   = uid('U');
  const mgrDisha   = uid('U');
  const mgrVidya   = uid('U');
  const stlPankaj  = uid('U');
  const stlUtkarsh = uid('U');
  const tlRanjeet  = uid('U');
  const tlSubhada  = uid('U');
  const teIds = {};
  const teEmpIds = [
    '135750','125122','151229','154825','145107','145014','144232','158584',
    '153655','158986','158292','153152','150425','155741','150429','149817',
    '150421','153893','154874','155014','155015','156550','156555','154870',
    '159191','152451','144553','143915','144192','159757','159747','159772',
  ];
  for (const e of teEmpIds) teIds[e] = uid('U');

  /* ── Teams ── */
  const tDevId = uid('T');
  const tExeId = uid('T');
  await run(
    `INSERT OR IGNORE INTO teams (id,name,description,standup_time,standup_timezone,window_duration,productivity_threshold) VALUES (?,?,?,?,?,?,?)`,
    [tDevId, 'TC Development', 'Test case development – KPIT LRT PF26 Honda', '09:30', 'Asia/Kolkata', 30, 15.0]
  );
  await run(
    `INSERT OR IGNORE INTO teams (id,name,description,standup_time,standup_timezone,window_duration,productivity_threshold) VALUES (?,?,?,?,?,?,?)`,
    [tExeId, 'TC Execution', 'Test case execution – KPIT LRT PF26 Honda', '09:30', 'Asia/Kolkata', 30, 15.0]
  );

  /* ── Users ── */
  const users = [
    [adminId,    'Admin',                         'ADM001', PASS_ADMIN,    'admin',   null,    null,    'System Administrator'],
    [mgrArpit,   'Arpit Sharma',                  '159095', PASS_DEFAULT,  'manager', adminId, tDevId,  'Manager'],
    [mgrDisha,   'Disha Chinmay Nanoty',           '158894', PASS_DEFAULT,  'manager', adminId, tDevId,  'Manager'],
    [mgrVidya,   'Vidya Kadam',                   '127207', PASS_DEFAULT,  'manager', adminId, tDevId,  'Manager'],
    [stlPankaj,  'Pankaj Gudmewar',               '140486', PASS_DEFAULT,  'stl',     adminId, tDevId,  'Senior Test Lead'],
    [stlUtkarsh, 'Utkarsh Atre',                  '154351', PASS_DEFAULT,  'stl',     adminId, tDevId,  'Senior Test Lead'],
    [tlRanjeet,  'Ranjeet Nalawade',               '153839', PASS_DEFAULT,  'tl',      adminId, tDevId,  'Test Lead'],
    [tlSubhada,  'Subhada Raosaheb Taktode',       '141418', PASS_DEFAULT,  'tl',      adminId, tDevId,  'Test Lead'],
    [teIds['135750'], 'Swati Narayan Lokhande',    '135750', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['125122'], 'Damyanti Belgaonkar',       '125122', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['151229'], 'Ajit Pandian',              '151229', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['154825'], 'Ashwin Nanjundaiah',        '154825', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['145107'], 'Kartik Koppalkar',          '145107', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['145014'], 'Anuradha Kolhar',           '145014', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['144232'], 'Tabbasum Tamboli',          '144232', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['158584'], 'Bhavik Ranjendrakumar Lakhani', '158584', PASS_DEFAULT, 'te',   adminId, tDevId,  'Test Engineer'],
    [teIds['153655'], 'Md Salman Khan',            '153655', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['158986'], 'Garishma Bhatia',           '158986', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['158292'], 'Amruta Kubsad',             '158292', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['153152'], 'Priyanka Kakade',           '153152', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['150425'], 'Vedant Mahajan',            '150425', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['155741'], 'Ashish Gupta',              '155741', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['150429'], 'Shubham Jadhav',            '150429', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['149817'], 'Gourav Gupta',              '149817', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['150421'], 'Tohid Mulla',               '150421', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['153893'], 'Nikhil Jadhav',             '153893', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['154874'], 'Hujef Shaikh',              '154874', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['155014'], 'Aashutosh Dalvi',           '155014', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['155015'], 'PRATHAMESH DOUNDKAR',       '155015', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['156550'], 'Pravin Khandage',           '156550', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['156555'], 'Yuvraj Ghatage',            '156555', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['154870'], 'MAITHILI DHURI',            '154870', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['159191'], 'Karnika Kankshi',           '159191', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['152451'], 'Sharath G',                 '152451', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['144553'], 'Rohini Mahalle',            '144553', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['143915'], 'Shweta Lohar',              '143915', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['144192'], 'Sohail Shaikh',             '144192', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['159757'], 'Tejas Bibekar',             '159757', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['159747'], 'Shubham Salunkhe',          '159747', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
    [teIds['159772'], 'Harish Pareek',             '159772', PASS_DEFAULT,  'te',      adminId, tDevId,  'Test Engineer'],
  ];

  for (const [id, name, emp_id, password, role, manager_id, team_id, job_title] of users) {
    await run(
      `INSERT OR IGNORE INTO users (id,name,emp_id,password,role,manager_id,team_id,theme,job_title) VALUES (?,?,?,?,?,?,?,'dark',?)`,
      [id, name, emp_id, password, role, manager_id, team_id, job_title]
    );
    // Correct any existing user with wrong role/manager/team
    await run(
      `UPDATE users SET role=?, manager_id=?, team_id=?, job_title=?, password=? WHERE emp_id=?`,
      [role, manager_id, team_id, job_title, password, emp_id]
    );
  }

  /* ── Activity ── */
  const actId = (await run(
    `INSERT INTO activities (name,description,created_by) VALUES (?,?,?)`,
    ['TC Development', 'Honda LRT PF26 test case activities', adminId]
  )).lastID;

  /* ── 9 Tasks ── */
  const taskTitles = [
    'TC Development', 'TC Modification', 'TC Comparison', 'Feasibility',
    'Defect Analysis', 'Defect/ QA Follow Up', 'TC Review', 'TC Rework', 'Other',
  ];
  for (const title of taskTitles) {
    await run(
      `INSERT INTO tasks (title,activity_id,created_by,priority,weight_percent,productivity_score,status) VALUES (?,?,?,?,?,?,?)`,
      [title, actId, adminId, 'medium', 100, 5, 'open']
    );
  }

  /* ── Features on all 9 tasks ── */
  const featureNames = [
    '3rd Party App','Active Noise Control','ActiveAerodynamicsSystem','Air Conditioner',
    'Analog Radio','Android Auto','AntiTheft','App Center','Audio operations','Bluetooth',
    'Bluetooth Audio','BSI CTM','Car Play','Clock','Common','Connecting your own device',
    'Dealer Diag','Developer Diag','Driver Distraction','DSAC (Digital Service Enable/Disable System)',
    'Emergency Support Service','EV Settings','FCTW','Field strength display',
    'Hands Free Telephone','Hard Key','HondaDigitalStore','In-car Wi-Fi',
    'Information-related OTA','Inline Diag','IVI Settings','HondaLink','Language',
    'METER Cooperation','Multi View Camera','NAVI','Parking Sensor',
    'Personal Information Protection Law (PPP/GDPR)','Personal Settings','Power Flow',
    'Power outage service','Profile management','Rear Seat Reminder',
    'Remote deletion of personal information','Remote Destination Setting (POI)',
    'Remote Multi View','RGB Lighting Customization','Seat vibration',
    'Send the vehicle information','Set-Up Wizard','Sharing service','Shoulder Tap','Sound',
    'Speech Recognition','StartStopSwitch','SXM','System Error','System startup complete',
    'System UI','TCU Diagnostics','Touch operations','TPMS tire pressure monitor',
    'Trip Computer','USB','User authentication','UX Selector','Vehicle Control SW',
    'Vehicle Settings','Vendor Extension/ExternalAccessoryProtcol','Wake Up Word (WuW)',
    'Wi-Fi(Station)','Wireless Charger','TCU DAQ','HondaTrailInfotainment','ETC',
    'Rear Wide Camera','InterNavi (KJ)','DAB','Map-linked vehicle control','DTV',
    'Vehicle Media Remote Controler','TrailerSettings','Profile Sync','MultiDisplayControl',
    'IVI Analytics','Image Entry','Cabin Talk','Auto Parking',
    'Linking with the home appliances','LET','External interface specifications',
    'Factory Support','Development assisting functions','Android Features',
  ];

  const insertedTasks = await all(
    `SELECT id, title FROM tasks WHERE activity_id=? ORDER BY id`,
    [actId]
  );
  for (const task of insertedTasks) {
    for (const f of featureNames) {
      await run(
        `INSERT OR IGNORE INTO task_features (task_id,name,created_by) VALUES (?,?,?)`,
        [task.id, f, adminId]
      );
    }
  }

  /* ── Holidays ── */
  const holidays = [
    ['2026-01-01', "New Year's Day"],
    ['2026-01-26', 'Republic Day'],
    ['2026-08-15', 'Independence Day'],
    ['2026-10-02', 'Gandhi Jayanti'],
    ['2026-11-01', 'Diwali Holiday'],
    ['2026-12-25', 'Christmas Day'],
  ];
  for (const [date, name] of holidays) {
    await run(`INSERT OR IGNORE INTO holidays (date,name) VALUES (?,?)`, [date, name]);
  }

  db.close();
  console.log('\n✅  Seed complete!\n');
  console.log('Teams: TC Development, TC Execution');
  console.log('Users: ' + users.length + ' (Admin + 3 Managers + 2 STL + 2 TL + 32 TE)');
  console.log('Tasks: ' + taskTitles.length + ' tasks × ' + featureNames.length + ' features each');
  console.log('\nLogin: emp_id / kpit@123  (Admin: ADM001 / admin@kpit)\n');
}

seed().catch(e => { console.error('Seed failed:', e.message); db.close(); process.exit(1); });
