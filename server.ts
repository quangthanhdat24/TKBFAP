import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { SLOT_CONFIG, normalizeDate } from './src/slotConfig.js';
import { parseFapSchedule } from './src/fapParser.js';

const app = express();
const PORT = 3000;

// Enable CORS for Bookmarklet requests from FAP domain
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Storage Engine
const DATA_FILE = path.join(process.cwd(), 'fap_schedules.json');
let scheduleDatabase: Record<string, any> = {};

function loadDatabase() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      scheduleDatabase = JSON.parse(raw);
    }
  } catch (e: any) {
    console.warn('[Storage] Lỗi đọc database:', e.message);
  }
}

// Khởi tạo đọc từ file
loadDatabase();

function persistDatabase() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(scheduleDatabase, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[Storage Error]', err.message);
  }
}

// Hàm sinh lịch cả học kỳ 10 tuần thực tế của Quang Thành Đạt (FPT Cần Thơ)
function generateSampleSchedule(studentCode: string, numWeeks = 10, startMondayStr = '2026-09-07') {
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
  const fullSchedule: any[] = [];

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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint 2: GET /api/feed/:userId.ics (Webcal Subscription)
const handleFeedRequest = (req: express.Request, res: express.Response) => {
  try {
    loadDatabase();
    let userId = req.params.userId || (req.query.userId as string);
    if (userId && userId.endsWith('.ics')) {
      userId = userId.replace(/\.ics$/i, '');
    }
    userId = (userId || '').trim().toLowerCase();

    // Nếu không truyền userId
    if (!userId) {
      userId = 'demo';
    }

    let userData = scheduleDatabase[userId];
    if (!userData || !userData.schedule || userData.schedule.length === 0) {
      // Chỉ tự động nạp lịch mẫu nếu là tài khoản demo hoặc tài khoản gốc
      if (userId === 'demo' || userId === 'ce180531' || userId === 'datqtce180531') {
        const initialSchedule = generateSampleSchedule('CE180531');
        userData = {
          userId,
          studentId: 'CE180531',
          studentName: 'Quang Thành Đạt',
          updatedAt: new Date().toISOString(),
          schedule: initialSchedule
        };
        scheduleDatabase[userId] = userData;
        persistDatabase();
      } else {
        // Sinh viên khác chưa trích xuất FAP -> Trả về sự kiện nhắc nhở thay vì lịch của người khác
        const studentCode = userId.toUpperCase();
        const noticeIcs = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//FAP FPT Calendar Sync//VI',
          `X-WR-CALNAME:Lịch học FAP - ${studentCode}`,
          'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
          'CALSCALE:GREGORIAN',
          'METHOD:PUBLISH',
          'BEGIN:VEVENT',
          `UID:notice-${userId}-${Date.now()}@fap.fpt.edu.vn`,
          'DTSTAMP:20260916T000000Z',
          'DTSTART:20260916T070000',
          'DTEND:20260916T091500',
          `SUMMARY:⚠️ ${studentCode} chưa đồng bộ thời khóa biểu FAP`,
          'DESCRIPTION:Bạn chưa trích xuất thời khóa biểu FAP của mình lên hệ thống. Vui lòng mở trang FAP Weekly Timetable và bấm Bookmarklet để đồng bộ lịch riêng của bạn nhé!',
          'LOCATION:FAP FPT',
          'STATUS:CONFIRMED',
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          'DESCRIPTION:Nhắc nhở đồng bộ lịch FAP',
          'TRIGGER:-PT15M',
          'END:VALARM',
          'END:VEVENT',
          'END:VCALENDAR'
        ].join('\r\n');

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="FAP_${studentCode}.ics"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(noticeIcs);
      }
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
    loadDatabase();
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
  loadDatabase();
  const userId = (req.params.userId || '').trim().toLowerCase();
  
  if (!userId) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã sinh viên' });
  }

  let data = scheduleDatabase[userId];
  if (!data) {
    // Chỉ tạo demo cho tài khoản mẫu
    if (userId === 'demo' || userId === 'ce180531' || userId === 'datqtce180531') {
      const fullSched = generateSampleSchedule('CE180531');
      data = {
        userId,
        studentId: 'CE180531',
        studentName: 'Quang Thành Đạt',
        updatedAt: new Date().toISOString(),
        schedule: fullSched
      };
      scheduleDatabase[userId] = data;
      persistDatabase();
      return res.json({ success: true, data });
    }
    // Đối với người khác chưa có dữ liệu
    return res.status(404).json({
      success: false,
      exists: false,
      studentId: userId.toUpperCase(),
      message: `Chưa có dữ liệu thời khóa biểu cho sinh viên ${userId.toUpperCase()}. Bạn hãy bấm Bookmarklet trên FAP hoặc dán HTML để tải lên lịch của bạn nhé!`
    });
  }
  return res.json({ success: true, data });
});

// Endpoint: POST /api/replicate-semester (Nhân bản lịch 1 tuần ra cả học kỳ 10-15 tuần)
app.post('/api/replicate-semester', (req, res) => {
  try {
    loadDatabase();
    const { userId, weeksCount = 10, startMonday = '2026-09-07' } = req.body;
    const cleanId = (userId || 'CE180531').toString().trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'CE180531';
    const normId = cleanId.toLowerCase();

    let currentSchedule = scheduleDatabase[normId]?.schedule || [];
    let fullSchedule: any[] = [];

    if (currentSchedule.length > 0) {
      const dayMap: Record<number, any[]> = {};
      currentSchedule.forEach((item: any) => {
        const itemDate = new Date(item.date);
        const dayOfWeek = (itemDate.getDay() + 6) % 7; // 0: T2 ... 6: CN
        if (!dayMap[dayOfWeek]) dayMap[dayOfWeek] = [];
        if (!dayMap[dayOfWeek].some((x: any) => x.slot === item.slot && x.subject === item.subject)) {
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

          classesThisDay.forEach((c: any) => {
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
      if (normId === 'ce180531' || normId === 'datqtce180531' || normId === 'demo') {
        fullSchedule = generateSampleSchedule('CE180531', weeksCount, startMonday);
      } else {
        return res.status(400).json({
          success: false,
          message: `Sinh viên ${cleanId} chưa có lịch tuần nào trong hệ thống để nhân bản cả kỳ. Vui lòng quét FAP trước!`
        });
      }
    }

    fullSchedule.sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : a.slot - b.slot));

    scheduleDatabase[normId] = {
      userId: normId,
      studentId: cleanId,
      studentName: scheduleDatabase[normId]?.studentName || cleanId,
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
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
