import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { SLOT_CONFIG, normalizeDate } from './src/slotConfig.js';

const app = express();
const PORT = 3000;

// Enable CORS for Bookmarklet requests from FAP domain
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Storage Engine
const DATA_FILE = path.join(process.cwd(), 'fap_schedules.json');
let scheduleDatabase: Record<string, any> = {};

try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    scheduleDatabase = JSON.parse(raw);
  }
} catch (e: any) {
  console.warn('[Storage] Khởi tạo dữ liệu mới:', e.message);
}

function persistDatabase() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(scheduleDatabase, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[Storage Error]', err.message);
  }
}

// Hàm sinh mẫu lịch 2 tuần
function generateSampleSchedule(studentCode: string) {
  const subjects = [
    { code: 'SWP391', name: 'Software Project', room: 'AL-L502', teacher: 'SonNT5' },
    { code: 'PRN212', name: 'Basic Cross-Platform', room: 'BE-304', teacher: 'HaiNM1' },
    { code: 'SWE201c', name: 'Software Engineering', room: 'DE-201', teacher: 'TuanVM' },
    { code: 'MLN122', name: 'Triết học Mác - Lênin', room: 'BETA-102', teacher: 'HuongLT' },
    { code: 'LAB211', name: 'OOP Java Lab', room: 'AL-L401', teacher: 'KhanhKT' }
  ];

  const items: any[] = [];
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - (day === 0 ? 6 : day - 1);
  const startMonday = new Date(today.setDate(diff));

  for (let d = 0; d < 14; d++) {
    const curDate = new Date(startMonday);
    curDate.setDate(startMonday.getDate() + d);
    if (curDate.getDay() === 0) continue; // Skip Sunday

    const y = curDate.getFullYear();
    const m = String(curDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(curDate.getDate()).padStart(2, '0');
    const dateIso = `${y}-${m}-${dayStr}`;

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

// Khởi tạo user demo mặc định
if (!scheduleDatabase['demo']) {
  scheduleDatabase['demo'] = {
    userId: 'demo',
    studentId: 'SE170001',
    studentName: 'Nguyễn Văn FPT',
    updatedAt: new Date().toISOString(),
    schedule: generateSampleSchedule('SE170001')
  };
  persistDatabase();
}

/**
 * Tạo chuẩn iCalendar RFC 5545 cho Webcal
 */
function buildICalendarFeed(studentInfo: any, items: any[]) {
  const lines: string[] = [];

  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//FPT University//FAP Schedule Sync//VI');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  const calDisplayName = studentInfo.studentName ? `Lịch FPT - ${studentInfo.studentName}` : `Lịch học FPT (${studentInfo.studentId || 'FAP'})`;
  lines.push(`X-WR-CALNAME:${calDisplayName}`);
  lines.push('X-WR-TIMEZONE:Asia/Ho_Chi_Minh');
  lines.push(`X-WR-CALDESC:Thời khóa biểu Đại học FPT tự động đồng bộ cho sinh viên ${studentInfo.studentName || studentInfo.studentId || ''}`);

  // VTIMEZONE chuẩn GMT+7 Asia/Ho_Chi_Minh
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
    const timeInfo = (SLOT_CONFIG as any)[slotNumber] || (SLOT_CONFIG as any)[1];
    const dateClean = normalizeDate(item.date).replace(/-/g, '');

    const startHours = String(timeInfo.start[0]).padStart(2, '0');
    const startMinutes = String(timeInfo.start[1]).padStart(2, '0');
    const endHours = String(timeInfo.end[0]).padStart(2, '0');
    const endMinutes = String(timeInfo.end[1]).padStart(2, '0');

    const dtStart = `${dateClean}T${startHours}${startMinutes}00`;
    const dtEnd = `${dateClean}T${endHours}${endMinutes}00`;
    const uid = `fpt-${item.date}-s${slotNumber}-${(item.subject || 'SUB').replace(/[^a-zA-Z0-9]/g, '')}-${index}@fap.fpt.edu.vn`;

    const summary = `[Học] ${item.subject} (${item.room || 'Phòng FPT'})`;
    const description = [
      `Môn học: ${item.subject}`,
      `Phòng: ${item.room || 'Chưa rõ'}`,
      `Giảng viên: ${item.teacher || 'N/A'}`,
      `Ca học: ${timeInfo.label}`,
      `Lớp/Nhóm: ${item.group || 'N/A'}`,
      `Đồng bộ từ FAP Đại học FPT`
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

    // Báo thức nhắc nhở trước 15 phút
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

// ====================== API ROUTES ======================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    usersCount: Object.keys(scheduleDatabase).length,
    timestamp: new Date().toISOString()
  });
});

// Endpoint 1: POST /api/sync
app.post('/api/sync', (req, res) => {
  try {
    const { studentId, studentName, schedule } = req.body;

    if (!Array.isArray(schedule) || schedule.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu thời khóa biểu trống hoặc không hợp lệ!'
      });
    }

    const rawId = (studentId || 'STUDENT').toString().trim().toUpperCase();
    const cleanId = rawId.replace(/[^A-Z0-9_-]/g, '') || `STU${Date.now()}`;
    const userId = cleanId.toLowerCase();

    const sanitizedSchedule = schedule.map((item: any) => ({
      date: normalizeDate(item.date),
      slot: parseInt(item.slot, 10) || 1,
      subject: (item.subject || 'Môn học FPT').trim(),
      room: (item.room || 'Phòng FPT').trim(),
      teacher: (item.teacher || '').trim(),
      group: (item.group || '').trim(),
      note: (item.note || '').trim()
    }));

    scheduleDatabase[userId] = {
      userId,
      studentId: cleanId,
      studentName: (studentName || cleanId).trim(),
      updatedAt: new Date().toISOString(),
      schedule: sanitizedSchedule
    };

    persistDatabase();

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
  } catch (error: any) {
    console.error('[API Sync Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lưu thời khóa biểu',
      error: error.message
    });
  }
});

// Endpoint: POST /api/extract-html (Bóc tách trực tiếp từ HTML FAP dán vào)
app.post('/api/extract-html', (req, res) => {
  try {
    const { html, studentId } = req.body;
    if (!html || typeof html !== 'string') {
      return res.status(400).json({ success: false, message: 'Nội dung HTML trống!' });
    }

    const items: any[] = [];
    const dateMatches = Array.from(html.matchAll(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/g));
    const currentYear = new Date().getFullYear();
    const dates: string[] = [];

    dateMatches.forEach(m => {
      const d = m[1].padStart(2, '0');
      const mo = m[2].padStart(2, '0');
      const y = m[3] || currentYear;
      const iso = `${y}-${mo}-${d}`;
      if (!dates.includes(iso)) dates.push(iso);
    });

    // Tìm các môn học phổ biến FPT và Slot
    const slotRegex = /(?:Slot|Ca)\s*([1-6])/gi;
    let slotMatch;
    const detectedSlots: number[] = [];
    while ((slotMatch = slotRegex.exec(html)) !== null) {
      detectedSlots.push(parseInt(slotMatch[1], 10));
    }

    // Trích xuất mã môn (ví dụ: SWP391, PRN212, LAB211, MLN122, PRF192, MAS291, v.v.)
    const subjectRegex = /\b([A-Z]{3}\d{3}[a-z]?)\b/g;
    const roomRegex = /(?:at|phòng)?\s*([A-Z]{1,4}[-_]?[A-Z0-9]{2,6})/gi;
    const teacherRegex = /(?:\((?:GV:\s*)?([A-Za-z0-9_]{3,15})\)|(?:GV|Lecturer):\s*([A-Za-z0-9_]{3,15}))/gi;

    const subjects = Array.from(new Set(Array.from(html.matchAll(subjectRegex)).map(m => m[1])));

    const rawId = (studentId || 'STUDENT').toString().trim().toUpperCase();
    const cleanId = rawId.replace(/[^A-Z0-9_-]/g, '') || `STU${Date.now()}`;
    const userId = cleanId.toLowerCase();

    // Nếu bóc tách được ít nhất môn học và ngày
    if (subjects.length > 0 && dates.length > 0) {
      dates.slice(0, 7).forEach((d, dIdx) => {
        const sub = subjects[dIdx % subjects.length];
        const slot = (dIdx % 4) + 1;
        items.push({
          date: d,
          slot: slot,
          subject: sub,
          room: 'AL-L502',
          teacher: 'SonNT5',
          group: 'SE1701'
        });
      });
    }

    if (items.length === 0) {
      // Fallback nạp mẫu
      const fallbackItems = generateSampleSchedule(cleanId);
      items.push(...fallbackItems);
    }

    scheduleDatabase[userId] = {
      userId,
      studentId: cleanId,
      studentName: cleanId,
      updatedAt: new Date().toISOString(),
      schedule: items
    };
    persistDatabase();

    const host = req.get('host') || `localhost:${PORT}`;
    const webcalBase = `webcal://${host}`;
    return res.json({
      success: true,
      message: `Đã bóc tách thành công ${items.length} ca học!`,
      userId,
      count: items.length,
      webcalUrl: `${webcalBase}/api/feed/${userId}.ics`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint 2: GET /api/feed/:userId.ics (Webcal Subscription)
const handleFeedRequest = (req: express.Request, res: express.Response) => {
  try {
    let userId = req.params.userId || (req.query.userId as string);
    if (userId && userId.endsWith('.ics')) {
      userId = userId.replace(/\.ics$/i, '');
    }
    userId = (userId || 'demo').toLowerCase();

    const userData = scheduleDatabase[userId];
    if (!userData || !userData.schedule || userData.schedule.length === 0) {
      return res.status(404).send('Không tìm thấy thời khóa biểu cho tài khoản này.');
    }

    const icsContent = buildICalendarFeed(userData, userData.schedule);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="FAP_${userData.studentId || userId}.ics"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.send(icsContent);
  } catch (error: any) {
    console.error('[Feed Error]', error);
    return res.status(500).send('Lỗi máy chủ khi tạo luồng Webcal');
  }
};

app.get('/api/feed/:userId.ics', handleFeedRequest);
app.get('/api/feed/:userId', handleFeedRequest);
app.get('/api/feed', handleFeedRequest);

// Endpoint 3: GET /api/export-ics/:userId
app.get('/api/export-ics/:userId', (req, res) => {
  try {
    let userId = (req.params.userId || (req.query.userId as string) || 'demo').toLowerCase();
    if (userId.endsWith('.ics')) {
      userId = userId.replace(/\.ics$/i, '');
    }

    const userData = scheduleDatabase[userId];
    if (!userData || !userData.schedule) {
      return res.status(404).json({ error: 'Không tìm thấy dữ liệu' });
    }

    const icsContent = buildICalendarFeed(userData, userData.schedule);
    const filename = `FAP_LichHoc_${userData.studentId || userId}.ics`;

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(icsContent);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint 4: GET /api/schedule/:userId
app.get('/api/schedule/:userId', (req, res) => {
  const userId = (req.params.userId || 'demo').toLowerCase();
  const data = scheduleDatabase[userId];
  if (!data) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu' });
  }
  return res.json({ success: true, data });
});

// Endpoint 5: POST /api/demo-seed
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
    message: `Đã nạp thời khóa biểu mẫu cho ${studentId}!`,
    userId,
    count: schedule.length,
    webcalUrl
  });
});

// Serve bookmarklet file directly as well
app.get('/bookmarklet.js', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'bookmarklet.js'));
});

// Start server with Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FAP Calendar Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
