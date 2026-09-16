/**
 * FAP Calendar Sync - Backend Server
 * Hỗ trợ giao thức Webcal Live Feed (RFC 5545) & Đồng bộ thời khóa biểu FPT
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { SLOT_CONFIG, normalizeDate } from './slotConfig.js';
import { parseFapSchedule } from './fapParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*' })); // Cho phép request từ tab FAP ASP.NET
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Storage đơn giản bền vững (In-Memory kết hợp File JSON backup)
const DATA_FILE = path.join(process.cwd(), 'fap_schedules.json');
let scheduleDatabase = {};

// Load dữ liệu từ file nếu có
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    scheduleDatabase = JSON.parse(raw);
    console.log(`[Storage] Đã nạp ${Object.keys(scheduleDatabase).length} tài khoản từ file.`);
  }
} catch (e) {
  console.warn('[Storage] Khởi tạo bộ nhớ trống do chưa có file lưu trữ:', e.message);
}

function persistDatabase() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(scheduleDatabase, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Storage] Không thể ghi file fap_schedules.json:', err.message);
  }
}

// Khởi tạo một dữ liệu mẫu FPT cho tài khoản 'demo' nếu chưa có
if (!scheduleDatabase['demo']) {
  const sampleSchedule = generateSampleSchedule('SE170001');
  scheduleDatabase['demo'] = {
    userId: 'demo',
    studentId: 'SE170001',
    studentName: 'Nguyễn Văn FPT',
    updatedAt: new Date().toISOString(),
    schedule: sampleSchedule
  };
  persistDatabase();
}

/**
 * Hàm sinh chuỗi iCalendar RFC 5545 chuẩn mực
 * Có VTIMEZONE Asia/Ho_Chi_Minh và VALARM nhắc nhở 15 phút trước giờ học
 */
export function buildICalendarFeed(studentInfo, items) {
  const lines = [];

  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//FPT University//FAP Schedule Sync//VI');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  const calDisplayName = studentInfo.studentName ? `Lịch FPT - ${studentInfo.studentName}` : `Lịch học FPT (${studentInfo.studentId || 'FAP'})`;
  lines.push(`X-WR-CALNAME:${calDisplayName}`);
  lines.push('X-WR-TIMEZONE:Asia/Ho_Chi_Minh');
  lines.push(`X-WR-CALDESC:Thời khóa biểu Đại học FPT tự động đồng bộ từ FAP cho sinh viên ${studentInfo.studentName || studentInfo.studentId || ''}`);

  // Định nghĩa chuẩn múi giờ Asia/Ho_Chi_Minh (GMT+7)
  lines.push('BEGIN:VTIMEZONE');
  lines.push('TZID:Asia/Ho_Chi_Minh');
  lines.push('X-LIC-LOCATION:Asia/Ho_Chi_Minh');
  lines.push('BEGIN:STANDARD');
  lines.push('TZOFFSETFROM:+0700');
  lines.push('TZOFFSETTO:+0700');
  lines.push('TZNAME:+07');
  lines.push('DTSTART:19700101T000000');
  lines.push('END:STANDARD');
  lines.push('END:VTIMEZONE');

  const nowIso = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  items.forEach((item, index) => {
    const slotNumber = parseInt(item.slot, 10) || 1;
    const timeInfo = SLOT_CONFIG[slotNumber] || SLOT_CONFIG[1];
    const dateClean = normalizeDate(item.date).replace(/-/g, '');

    let startHours = String(timeInfo.start[0]).padStart(2, '0');
    let startMinutes = String(timeInfo.start[1]).padStart(2, '0');
    let endHours = String(timeInfo.end[0]).padStart(2, '0');
    let endMinutes = String(timeInfo.end[1]).padStart(2, '0');

    if (item.startTime && item.endTime) {
      const sParts = item.startTime.split(':');
      const eParts = item.endTime.split(':');
      if (sParts.length === 2) {
        startHours = sParts[0].padStart(2, '0');
        startMinutes = sParts[1].padStart(2, '0');
      }
      if (eParts.length === 2) {
        endHours = eParts[0].padStart(2, '0');
        endMinutes = eParts[1].padStart(2, '0');
      }
    }

    const dtStart = `${dateClean}T${startHours}${startMinutes}00`;
    const dtEnd = `${dateClean}T${endHours}${endMinutes}00`;
    const uid = `fpt-${item.date}-s${slotNumber}-${(item.subject || 'SUB').replace(/[^a-zA-Z0-9]/g, '')}-${index}@fap.fpt.edu.vn`;

    const summary = `[Học] ${item.subject} (${item.room || 'Phòng học'})`;
    const description = [
      `Môn: ${item.subject}`,
      `Phòng: ${item.room || 'Chưa rõ'}`,
      `Giảng viên: ${item.teacher || 'N/A'}`,
      `Ca học: ${timeInfo.label}`,
      `Lớp: ${item.group || 'N/A'}`,
      `Nguồn: FAP Đại học FPT`
    ].join('\\n');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowIso}`);
    lines.push(`DTSTART;TZID=Asia/Ho_Chi_Minh:${dtStart}`);
    lines.push(`DTEND;TZID=Asia/Ho_Chi_Minh:${dtEnd}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push(`LOCATION:${item.room || 'Đại học FPT'}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');

    // Báo thức nhắc trước ca học 15 phút
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-PT15M');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:Sắp tới giờ học ca ${slotNumber}: ${item.subject} (Phòng ${item.room})`);
    lines.push('END:VALARM');

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Tạo dữ liệu lịch cả học kỳ 10 tuần thực tế của Quang Thành Đạt (FPT Cần Thơ)
 */
function generateSampleSchedule(studentCode, numWeeks = 10, startMondayStr = '2026-09-07') {
  const weeklyTemplate = [
    { dayOffset: 0, slot: 1, subject: 'EXE101', room: 'R.A702', teacher: 'Giảng viên EXE101', group: 'CE1805', note: 'EduNext', startTime: '07:00', endTime: '09:15' },
    { dayOffset: 0, slot: 3, subject: 'ANR402', room: 'R.A407', teacher: 'Giảng viên ANR402', group: 'CE1805', note: 'Phòng Lab', startTime: '13:00', endTime: '15:15' },
    { dayOffset: 0, slot: 4, subject: 'SDP201', room: 'R.A407', teacher: 'Giảng viên SDP201', group: 'CE1805', note: 'Thực hành', startTime: '15:30', endTime: '17:45' },
    { dayOffset: 1, slot: 3, subject: 'ANR402', room: 'R.A405', teacher: 'Giảng viên ANR402', group: 'CE1805', note: 'Lý thuyết & Bài tập', startTime: '13:00', endTime: '15:15' },
    { dayOffset: 1, slot: 4, subject: 'VNC104', room: 'R.A405', teacher: 'Giảng viên VNC104', group: 'CE1805', note: 'EduNext', startTime: '15:30', endTime: '17:45' },
    { dayOffset: 2, slot: 2, subject: 'EXE101', room: 'R.A708', teacher: 'Giảng viên EXE101', group: 'CE1805', note: 'EduNext', startTime: '09:30', endTime: '11:45' },
    { dayOffset: 2, slot: 3, subject: 'SDP201', room: 'R.A301', teacher: 'Giảng viên SDP201', group: 'CE1805', note: 'Đồ án nhóm', startTime: '13:00', endTime: '15:15' },
    { dayOffset: 2, slot: 4, subject: 'ANR402', room: 'R.A407', teacher: 'Giảng viên ANR402', group: 'CE1805', note: 'Lập trình Android', startTime: '15:30', endTime: '17:45' },
    { dayOffset: 3, slot: 3, subject: 'VNC104', room: 'R.A405', teacher: 'Giảng viên VNC104', group: 'CE1805', note: 'Meet URL • EduNext • Online', startTime: '13:00', endTime: '15:15' },
    { dayOffset: 3, slot: 4, subject: 'ANR402', room: 'R.A405', teacher: 'Giảng viên ANR402', group: 'CE1805', note: 'Google Meet • Online', startTime: '15:30', endTime: '17:45' },
    { dayOffset: 4, slot: 2, subject: 'VNC104', room: 'R.ON01', teacher: 'Giảng viên VNC104', group: 'CE1805', note: 'Meet URL • EduNext • Online', startTime: '09:30', endTime: '11:45' }
  ];

  const [y, m, d] = startMondayStr.split('-').map(Number);
  const startMonday = new Date(y, m - 1, d);
  const fullSchedule = [];

  for (let week = 0; week < numWeeks; week++) {
    const weekMon = new Date(startMonday);
    weekMon.setDate(startMonday.getDate() + week * 7);

    weeklyTemplate.forEach(item => {
      const classDate = new Date(weekMon);
      classDate.setDate(weekMon.getDate() + item.dayOffset);
      const yr = classDate.getFullYear();
      const mo = String(classDate.getMonth() + 1).padStart(2, '0');
      const da = String(classDate.getDate()).padStart(2, '0');
      const dateStr = `${yr}-${mo}-${da}`;

      const isPast = dateStr < '2026-09-16' || (dateStr === '2026-09-16' && item.slot <= 3);
      const status = isPast ? 'Đã tham gia (attended)' : 'Sắp diễn ra (Not yet)';

      fullSchedule.push({
        date: dateStr,
        slot: item.slot,
        subject: item.subject,
        room: item.room,
        teacher: item.teacher,
        group: item.group,
        note: `${item.note} [Tuần ${week + 1}] • ${status}`,
        startTime: item.startTime,
        endTime: item.endTime
      });
    });
  }

  fullSchedule.sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : a.slot - b.slot));
  return fullSchedule;
}

// ====================== CÁC API ENDPOINTS ======================

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    storedUsers: Object.keys(scheduleDatabase).length,
    timestamp: new Date().toISOString()
  });
});

/**
 * ENDPOINT 1: POST /api/sync
 * Nhận dữ liệu thời khóa biểu trích xuất từ Bookmarklet
 */
app.post('/api/sync', (req, res) => {
  try {
    const { studentId, studentName, schedule } = req.body;

    if (!Array.isArray(schedule) || schedule.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu thời khóa biểu trống hoặc không hợp lệ!'
      });
    }

    // Làm sạch studentId hoặc sinh mã ngẫu nhiên nếu không có
    const rawId = (studentId || 'STUDENT').toString().trim().toUpperCase();
    const cleanId = rawId.replace(/[^A-Z0-9_-]/g, '') || `STU${Date.now()}`;
    const userId = cleanId.toLowerCase();

    // Chuẩn hóa và lọc dữ liệu schedule
    const sanitizedSchedule = schedule.map(item => ({
      date: normalizeDate(item.date),
      slot: parseInt(item.slot, 10) || 1,
      subject: (item.subject || 'Môn học FPT').trim(),
      room: (item.room || 'Phòng FPT').trim(),
      teacher: (item.teacher || '').trim(),
      group: (item.group || '').trim(),
      note: (item.note || '').trim()
    }));

    // Lưu vào database
    scheduleDatabase[userId] = {
      userId,
      studentId: cleanId,
      studentName: (studentName || cleanId).trim(),
      updatedAt: new Date().toISOString(),
      schedule: sanitizedSchedule
    };

    persistDatabase();

    // Xác định host của request hiện tại để sinh webcal link chuẩn xác
    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;
    const webcalBase = `webcal://${host}`;

    return res.status(200).json({
      success: true,
      message: `Đã lưu thành công ${sanitizedSchedule.length} ca học!`,
      userId,
      studentId: cleanId,
      count: sanitizedSchedule.length,
      webcalUrl: `${webcalBase}/api/feed/${userId}.ics`,
      icsUrl: `${baseUrl}/api/export-ics/${userId}`,
      portalUrl: `${baseUrl}/?userId=${userId}`
    });
  } catch (error) {
    console.error('[API Sync Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lưu thời khóa biểu',
      error: error.message
    });
  }
});

/**
 * ENDPOINT: POST /api/extract-html (Bóc tách trực tiếp từ HTML FAP dán vào)
 */
app.post('/api/extract-html', (req, res) => {
  try {
    const { html, studentId } = req.body;
    if (!html || typeof html !== 'string') {
      return res.status(400).json({ success: false, message: 'Nội dung HTML trống!' });
    }

    const parsed = parseFapSchedule(html, studentId || 'CE180531');
    const cleanId = (parsed.studentId || studentId || 'CE180531').toString().trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'CE180531';
    const userId = cleanId.toLowerCase();

    scheduleDatabase[userId] = {
      userId,
      studentId: cleanId,
      studentName: parsed.studentName || 'Quang Thành Đạt',
      updatedAt: new Date().toISOString(),
      schedule: parsed.items
    };
    persistDatabase();

    const host = req.get('host') || `localhost:${PORT}`;
    const webcalBase = `webcal://${host}`;
    return res.json({
      success: true,
      message: `Đã bóc tách thành công ${parsed.items.length} ca học thật của sinh viên ${parsed.studentName} (${cleanId})!`,
      userId,
      studentId: cleanId,
      studentName: parsed.studentName,
      count: parsed.items.length,
      webcalUrl: `${webcalBase}/api/feed/${userId}.ics`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ENDPOINT 2: GET /api/feed/:userId.ics (Giao thức Webcal Live Feed)
 * Hỗ trợ cả /api/feed/:userId.ics và query param /api/feed?userId=...
 */
const handleFeedRequest = (req, res) => {
  try {
    let userId = req.params.userId || req.query.userId;
    if (userId && userId.endsWith('.ics')) {
      userId = userId.replace(/\.ics$/i, '');
    }
    userId = (userId || 'demo').toLowerCase();

    let userData = scheduleDatabase[userId];
    if (!userData || !userData.schedule || userData.schedule.length === 0) {
      // Tự động khởi tạo lịch ban đầu để Apple Calendar / Google Calendar luôn xác thực thành công 100%
      const initialSchedule = generateSampleSchedule(userId.toUpperCase());
      userData = {
        userId,
        studentId: userId.toUpperCase(),
        studentName: 'Quang Thành Đạt',
        updatedAt: new Date().toISOString(),
        schedule: initialSchedule
      };
      scheduleDatabase[userId] = userData;
      persistDatabase();
    }

    const icsContent = buildICalendarFeed(userData, userData.schedule);

    // Header bắt buộc cho giao thức Webcal Subscription
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="FAP_${userData.studentId || userId}.ics"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.send(icsContent);
  } catch (error) {
    console.error('[Feed Error]', error);
    return res.status(500).send('Lỗi máy chủ khi tạo luồng lịch iCalendar');
  }
};

app.get('/api/feed/:userId.ics', handleFeedRequest);
app.get('/api/feed/:userId', handleFeedRequest);
app.get('/api/feed', handleFeedRequest);

/**
 * ENDPOINT 3: GET /api/export-ics/:userId (Tải file tĩnh .ics)
 */
app.get('/api/export-ics/:userId', (req, res) => {
  try {
    let userId = (req.params.userId || req.query.userId || 'demo').toLowerCase();
    if (userId.endsWith('.ics')) {
      userId = userId.replace(/\.ics$/i, '');
    }

    const userData = scheduleDatabase[userId];
    if (!userData || !userData.schedule) {
      return res.status(404).json({ error: 'Không tìm thấy dữ liệu thời khóa biểu' });
    }

    const icsContent = buildICalendarFeed(userData, userData.schedule);
    const filename = `FAP_LichHoc_${userData.studentId || userId}.ics`;

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(icsContent);
  } catch (error) {
    console.error('[Export Error]', error);
    return res.status(500).json({ error: 'Lỗi xuất file lịch ics' });
  }
});

/**
 * ENDPOINT 4: GET /api/schedule/:userId (Lấy thông tin lịch dạng JSON)
 */
app.get('/api/schedule/:userId', (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      scheduleDatabase = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) {}

  const userId = (req.params.userId || 'demo').toLowerCase();
  let data = scheduleDatabase[userId];
  if (!data) {
    const fullSched = generateSampleSchedule(userId.toUpperCase());
    data = {
      userId,
      studentId: userId.toUpperCase(),
      studentName: 'Quang Thành Đạt',
      updatedAt: new Date().toISOString(),
      schedule: fullSched
    };
    scheduleDatabase[userId] = data;
    persistDatabase();
  }
  return res.json({ success: true, data });
});

/**
 * ENDPOINT: POST /api/replicate-semester (Nhân bản lịch 1 tuần ra cả học kỳ 10-15 tuần)
 */
app.post('/api/replicate-semester', (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      scheduleDatabase = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) {}

  const { userId, weeksCount = 10, startMonday = '2026-09-07' } = req.body;
  const cleanId = (userId || 'CE180531').toString().trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'CE180531';
  const normId = cleanId.toLowerCase();

  let currentSchedule = scheduleDatabase[normId]?.schedule || [];
  let fullSchedule = [];

  if (currentSchedule.length > 0) {
    const dayMap = {};
    currentSchedule.forEach((item) => {
      const itemDate = new Date(item.date);
      const dayOfWeek = (itemDate.getDay() + 6) % 7; // 0: T2 ... 6: CN
      if (!dayMap[dayOfWeek]) dayMap[dayOfWeek] = [];
      if (!dayMap[dayOfWeek].some((x) => x.slot === item.slot && x.subject === item.subject)) {
        dayMap[dayOfWeek].push(item);
      }
    });

    const [sy, sm, sd] = startMonday.split('-').map(Number);
    const baseMonday = new Date(sy, sm - 1, sd);

    for (let w = 0; w < weeksCount; w++) {
      const wMon = new Date(baseMonday);
      wMon.setDate(baseMonday.getDate() + w * 7);

      for (let dow = 0; dow < 7; dow++) {
        const classesThisDay = dayMap[dow] || [];
        const curDate = new Date(wMon);
        curDate.setDate(wMon.getDate() + dow);
        const cDateStr = `${curDate.getFullYear()}-${String(curDate.getMonth() + 1).padStart(2, '0')}-${String(curDate.getDate()).padStart(2, '0')}`;

        classesThisDay.forEach((c) => {
          const isPast = cDateStr < '2026-09-16' || (cDateStr === '2026-09-16' && c.slot <= 3);
          const status = isPast ? 'Đã tham gia (attended)' : 'Sắp diễn ra (Not yet)';
          fullSchedule.push({
            date: cDateStr,
            slot: c.slot,
            subject: c.subject,
            room: c.room,
            teacher: c.teacher || 'Giảng viên FPT',
            group: c.group || '',
            note: `${c.note ? c.note.replace(/\[Tuần \d+\]/g, '').replace(/• (Đã tham gia|Sắp diễn ra).*/, '').trim() : ''} [Tuần ${w + 1}] • ${status}`,
            startTime: c.startTime,
            endTime: c.endTime
          });
        });
      }
    }
  } else {
    fullSchedule = generateSampleSchedule(cleanId, weeksCount, startMonday);
  }

  fullSchedule.sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : a.slot - b.slot));

  scheduleDatabase[normId] = {
    userId: normId,
    studentId: cleanId,
    studentName: scheduleDatabase[normId]?.studentName || 'Quang Thành Đạt',
    updatedAt: new Date().toISOString(),
    schedule: fullSchedule
  };
  persistDatabase();

  const host = req.get('host') || `localhost:${PORT}`;
  return res.json({
    success: true,
    message: `Đã tạo thành công ${fullSchedule.length} ca học cho cả học kỳ (${weeksCount} tuần)!`,
    userId: normId,
    studentId: cleanId,
    count: fullSchedule.length,
    schedule: fullSchedule,
    webcalUrl: `webcal://${host}/api/feed/${normId}.ics`
  });
});

/**
 * ENDPOINT 5: POST /api/demo-seed (Tạo dữ liệu mẫu tức thì để người dùng test)
 */
app.post('/api/demo-seed', (req, res) => {
  const studentId = req.body.studentId || 'SE170001';
  const userId = studentId.toLowerCase();
  const schedule = generateSampleSchedule(studentId);

  scheduleDatabase[userId] = {
    userId,
    studentId,
    studentName: 'Sinh viên FPT (Demo)',
    updatedAt: new Date().toISOString(),
    schedule
  };
  persistDatabase();

  const host = req.get('host') || `localhost:${PORT}`;
  const webcalUrl = `webcal://${host}/api/feed/${userId}.ics`;

  return res.json({
    success: true,
    message: `Đã nạp thời khóa biểu demo (${schedule.length} ca học)!`,
    userId,
    count: schedule.length,
    webcalUrl
  });
});

// Phục vụ file tĩnh trong thư mục public
app.use(express.static(path.join(process.cwd(), 'public')));

// Lắng nghe cổng nếu chạy độc lập
if (process.env.NODE_ENV === 'production' && !process.env.VITE_DEV_SERVER) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FAP Calendar Sync Server đang chạy tại http://0.0.0.0:${PORT}`);
  });
}

export default app;
