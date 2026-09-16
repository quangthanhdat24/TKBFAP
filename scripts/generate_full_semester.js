import fs from 'fs';
import path from 'path';

// Mẫu lịch 1 tuần chuẩn của Quang Thành Đạt (FPT Cần Thơ - CE180531)
const weeklyTemplate = [
  // Thứ 2 (offset 0)
  {
    dayOffset: 0,
    slot: 1,
    subject: 'EXE101',
    room: 'R.A702',
    teacher: 'Giảng viên EXE101',
    group: 'CE1805',
    note: 'EduNext • Tuần',
    startTime: '07:00',
    endTime: '09:15'
  },
  {
    dayOffset: 0,
    slot: 3,
    subject: 'ANR402',
    room: 'R.A407',
    teacher: 'Giảng viên ANR402',
    group: 'CE1805',
    note: 'Phòng Lab',
    startTime: '13:00',
    endTime: '15:15'
  },
  {
    dayOffset: 0,
    slot: 4,
    subject: 'SDP201',
    room: 'R.A407',
    teacher: 'Giảng viên SDP201',
    group: 'CE1805',
    note: 'Thực hành',
    startTime: '15:30',
    endTime: '17:45'
  },
  // Thứ 3 (offset 1)
  {
    dayOffset: 1,
    slot: 3,
    subject: 'ANR402',
    room: 'R.A405',
    teacher: 'Giảng viên ANR402',
    group: 'CE1805',
    note: 'Lý thuyết & Bài tập',
    startTime: '13:00',
    endTime: '15:15'
  },
  {
    dayOffset: 1,
    slot: 4,
    subject: 'VNC104',
    room: 'R.A405',
    teacher: 'Giảng viên VNC104',
    group: 'CE1805',
    note: 'EduNext',
    startTime: '15:30',
    endTime: '17:45'
  },
  // Thứ 4 (offset 2)
  {
    dayOffset: 2,
    slot: 2,
    subject: 'EXE101',
    room: 'R.A708',
    teacher: 'Giảng viên EXE101',
    group: 'CE1805',
    note: 'EduNext',
    startTime: '09:30',
    endTime: '11:45'
  },
  {
    dayOffset: 2,
    slot: 3,
    subject: 'SDP201',
    room: 'R.A301',
    teacher: 'Giảng viên SDP201',
    group: 'CE1805',
    note: 'Đồ án nhóm',
    startTime: '13:00',
    endTime: '15:15'
  },
  {
    dayOffset: 2,
    slot: 4,
    subject: 'ANR402',
    room: 'R.A407',
    teacher: 'Giảng viên ANR402',
    group: 'CE1805',
    note: 'Lập trình Android',
    startTime: '15:30',
    endTime: '17:45'
  },
  // Thứ 5 (offset 3)
  {
    dayOffset: 3,
    slot: 3,
    subject: 'VNC104',
    room: 'R.A405',
    teacher: 'Giảng viên VNC104',
    group: 'CE1805',
    note: 'Meet URL • EduNext • Online',
    startTime: '13:00',
    endTime: '15:15'
  },
  {
    dayOffset: 3,
    slot: 4,
    subject: 'ANR402',
    room: 'R.A405',
    teacher: 'Giảng viên ANR402',
    group: 'CE1805',
    note: 'Google Meet • Online',
    startTime: '15:30',
    endTime: '17:45'
  },
  // Thứ 6 (offset 4)
  {
    dayOffset: 4,
    slot: 2,
    subject: 'VNC104',
    room: 'R.ON01',
    teacher: 'Giảng viên VNC104',
    group: 'CE1805',
    note: 'Meet URL • EduNext • Online',
    startTime: '09:30',
    endTime: '11:45'
  }
];

// Tạo 10 tuần học của học kỳ (Bắt đầu từ Thứ 2: 07/09/2026 đến hết 15/11/2026)
const startMonday = new Date(2026, 8, 7); // 07/09/2026
const fullSemesterSchedule = [];

for (let week = 0; week < 10; week++) {
  const weekMonday = new Date(startMonday);
  weekMonday.setDate(startMonday.getDate() + (week * 7));

  weeklyTemplate.forEach(item => {
    const classDate = new Date(weekMonday);
    classDate.setDate(weekMonday.getDate() + item.dayOffset);

    const y = classDate.getFullYear();
    const m = String(classDate.getMonth() + 1).padStart(2, '0');
    const d = String(classDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // Xác định trạng thái đã học hay sắp diễn ra (mốc hiện tại 16/09/2026)
    const isPast = dateStr < '2026-09-16' || (dateStr === '2026-09-16' && item.slot <= 3);
    const statusNote = isPast ? 'Đã tham gia (attended)' : 'Sắp diễn ra (Not yet)';

    fullSemesterSchedule.push({
      date: dateStr,
      slot: item.slot,
      subject: item.subject,
      room: item.room,
      teacher: item.teacher,
      group: item.group,
      note: `${item.note} [Tuần ${week + 1}] • ${statusNote}`,
      startTime: item.startTime,
      endTime: item.endTime
    });
  });
}

// Sắp xếp tăng dần theo ngày và slot
fullSemesterSchedule.sort((a, b) => {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return a.slot - b.slot;
});

const dataFile = path.join(process.cwd(), 'fap_schedules.json');
let db = {};
if (fs.existsSync(dataFile)) {
  try {
    db = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  } catch (e) {}
}

const userObj = {
  studentId: 'CE180531',
  studentName: 'Quang Thành Đạt',
  updatedAt: new Date().toISOString(),
  schedule: fullSemesterSchedule
};

db['ce180531'] = { userId: 'ce180531', ...userObj };
db['datqtce180531'] = { userId: 'datqtce180531', ...userObj };
db['demo'] = { userId: 'demo', ...userObj };

fs.writeFileSync(dataFile, JSON.stringify(db, null, 2), 'utf-8');
console.log(`Đã tạo thành công ${fullSemesterSchedule.length} ca học cho cả học kỳ 10 tuần!`);
