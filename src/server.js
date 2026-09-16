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
  lines.push(`X-WR-CALNAME:Lịch học FPT (${studentInfo.studentId || 'FAP'})`);
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

    const startHours = String(timeInfo.start[0]).padStart(2, '0');
    const startMinutes = String(timeInfo.start[1]).padStart(2, '0');
    const endHours = String(timeInfo.end[0]).padStart(2, '0');
    const endMinutes = String(timeInfo.end[1]).padStart(2, '0');

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
 * Tạo dữ liệu lịch mẫu trong 2 tuần tiếp theo để kiểm thử
 */
function generateSampleSchedule(studentCode) {
  const subjects = [
    { code: 'SWP391', name: 'Software Project', room: 'AL-L502', teacher: 'SonNT5' },
    { code: 'PRN212', name: 'Basic Cross-Platform', room: 'BE-304', teacher: 'HaiNM1' },
    { code: 'SWE201c', name: 'Software Engineering', room: 'DE-201', teacher: 'TuanVM' },
    { code: 'MLN122', name: 'Triết học Mác - Lênin', room: 'BETA-102', teacher: 'HuongLT' },
    { code: 'LAB211', name: 'OOP Java Lab', room: 'AL-L401', teacher: 'KhanhKT' }
  ];

  const items = [];
  const today = new Date();
  // Bắt đầu từ thứ 2 tuần này
  const day = today.getDay();
  const diff = today.getDate() - (day === 0 ? 6 : day - 1);
  const startMonday = new Date(today.setDate(diff));

  // Tạo 14 ngày (2 tuần)
  for (let d = 0; d < 14; d++) {
    const curDate = new Date(startMonday);
    curDate.setDate(startMonday.getDate() + d);
    
    // Bỏ qua Chủ nhật
    if (curDate.getDay() === 0) continue;

    const y = curDate.getFullYear();
    const m = String(curDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(curDate.getDate()).padStart(2, '0');
    const dateIso = `${y}-${m}-${dayStr}`;

    // Thứ 2, 4, 6: Slot 1 & 3
    // Thứ 3, 5, 7: Slot 2 & 4
    if (curDate.getDay() % 2 === 1) {
      items.push({
        date: dateIso,
        slot: 1,
        subject: subjects[0].code,
        room: subjects[0].room,
        teacher: subjects[0].teacher,
        group: 'SE1701'
      });
      items.push({
        date: dateIso,
        slot: 3,
        subject: subjects[1].code,
        room: subjects[1].room,
        teacher: subjects[1].teacher,
        group: 'SE1701'
      });
    } else {
      items.push({
        date: dateIso,
        slot: 2,
        subject: subjects[2].code,
        room: subjects[2].room,
        teacher: subjects[2].teacher,
        group: 'SE1701'
      });
      items.push({
        date: dateIso,
        slot: 4,
        subject: subjects[3].code,
        room: subjects[3].room,
        teacher: subjects[3].teacher,
        group: 'SE1701'
      });
    }
  }

  return items;
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

    const userData = scheduleDatabase[userId];
    if (!userData || !userData.schedule || userData.schedule.length === 0) {
      return res.status(404).send('Không tìm thấy dữ liệu thời khóa biểu cho người dùng này. Vui lòng chạy Bookmarklet để đồng bộ lại!');
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
  const userId = (req.params.userId || 'demo').toLowerCase();
  const data = scheduleDatabase[userId];
  if (!data) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu' });
  }
  return res.json({ success: true, data });
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
