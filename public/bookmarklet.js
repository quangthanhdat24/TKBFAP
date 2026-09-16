/**
 * FAP Calendar Extractor Bookmarklet
 * Tự động trích xuất Thời khóa biểu FAP (Đại học FPT) và đồng bộ vào Apple Calendar / Google Calendar
 */
(function () {
  // Tránh chạy lặp nếu đã chèn
  const OVERLAY_ID = 'fap-sync-modal-overlay';
  const existingOverlay = document.getElementById(OVERLAY_ID);
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Xác định Backend URL (tự động nhận domain hoặc dùng mặc định Render của bạn)
  const currentScript = document.currentScript;
  let BACKEND_URL = window.FAP_SYNC_BACKEND_URL;
  if (!BACKEND_URL) {
    if (currentScript && currentScript.src) {
      try {
        const parsed = new URL(currentScript.src);
        BACKEND_URL = parsed.origin;
      } catch (e) {}
    }
  }
  // Mặc định Render riêng của bạn nếu chạy trên trang fap.fpt.edu.vn
  if (!BACKEND_URL || BACKEND_URL.includes('fpt.edu.vn')) {
    BACKEND_URL = 'https://fap-calendar-sync.onrender.com';
  }

  // Helper hiển thị thông báo floating
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.id = 'fap-toast-alert';
    const bg = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999999;
      background: ${bg};
      color: white;
      padding: 14px 20px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
      transition: all 0.3s ease;
      max-width: 90vw;
    `;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // 1. Kiểm tra trang web có phải là FAP không
  const isFapSite = window.location.hostname.includes('fpt.edu.vn') || 
                    document.title.toLowerCase().includes('fap') ||
                    document.querySelector('table');

  if (!isFapSite) {
    alert('Vui lòng mở trang "Weekly Timetable" trên FAP (fap.fpt.edu.vn) trước khi chạy Bookmarklet này!');
    return;
  }

  // 2. Tìm bảng thời khóa biểu
  function findTimetableTable() {
    const tables = Array.from(document.querySelectorAll('table'));
    if (tables.length === 0) return null;

    // Tìm table chứa từ khóa Slot hoặc Ca hoặc Mon/Tue/Thứ
    for (const tbl of tables) {
      const text = tbl.innerText || '';
      if ((text.includes('Slot') || text.includes('Ca')) && 
          (text.includes('Mon') || text.includes('Thứ') || text.includes('Tuesday') || text.includes('Tuần'))) {
        return tbl;
      }
    }

    // Nếu không tìm thấy, lấy bảng có nhiều hàng và cột nhất
    let bestTable = tables[0];
    let maxCells = 0;
    tables.forEach(t => {
      const cells = t.querySelectorAll('td, th').length;
      if (cells > maxCells) {
        maxCells = cells;
        bestTable = t;
      }
    });
    return bestTable;
  }

  const table = findTimetableTable();
  if (!table) {
    showToast('❌ Không tìm thấy bảng thời khóa biểu trên trang hiện tại!', 'error');
    return;
  }

  // 3. Trích xuất thông tin sinh viên từ trang (Mã SV, Họ tên)
  let studentCode = 'STUDENT';
  let studentName = '';
  try {
    const bodyText = document.body.innerText;
    const codeMatch = bodyText.match(/\b([A-Z]{2}\d{5,7})\b/i); // e.g. HE171234, SE160000, QE180000
    if (codeMatch) {
      studentCode = codeMatch[1].toUpperCase();
    }
    const userElement = document.querySelector('#ctl00_lblUser, .user-name, #lblUser');
    if (userElement) {
      studentName = userElement.innerText.trim();
    }
    if (!studentName) {
      studentName = 'Quang Thành Đạt';
    }
  } catch (e) {
    console.warn('Không thể đọc thông tin SV:', e);
    studentName = 'Quang Thành Đạt';
  }

  // 4. Phân tích cột Header để lấy Ngày (Format YYYY-MM-DD)
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length < 2) {
    showToast('❌ Bảng lịch học không đủ dữ liệu để trích xuất!', 'error');
    return;
  }

  // Header row
  let headerRow = rows[0];
  let headerCells = Array.from(headerRow.querySelectorAll('th, td'));
  
  // Nếu row 0 chỉ chứa 1 cell gộp tiêu đề, lấy row 1
  if (headerCells.length <= 2 && rows.length > 1) {
    headerRow = rows[1];
    headerCells = Array.from(headerRow.querySelectorAll('th, td'));
  }

  // Map vị trí cột (index) -> Chuỗi ngày YYYY-MM-DD
  const columnDateMap = {};
  const currentYear = new Date().getFullYear();

  headerCells.forEach((cell, colIndex) => {
    const text = (cell.innerText || '').trim();
    // Tìm ngày dạng dd/MM/yyyy hoặc dd/MM hoặc dd-MM-yyyy
    const fullDateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    const shortDateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})/);

    if (fullDateMatch) {
      const d = fullDateMatch[1].padStart(2, '0');
      const m = fullDateMatch[2].padStart(2, '0');
      const y = fullDateMatch[3];
      columnDateMap[colIndex] = `${y}-${m}-${d}`;
    } else if (shortDateMatch) {
      const d = shortDateMatch[1].padStart(2, '0');
      const m = shortDateMatch[2].padStart(2, '0');
      columnDateMap[colIndex] = `${currentYear}-${m}-${d}`;
    }
  });

  // Nếu không nhận được ngày từ header, kiểm tra dropdown chọn tuần hoặc ngày hiện tại
  const hasDates = Object.keys(columnDateMap).length > 0;
  if (!hasDates) {
    // Thử fallback tạo 7 ngày từ thứ 2 đến CN của tuần hiện tại
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0: CN, 1: T2
    const diffToMonday = today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    const monday = new Date(today.setDate(diffToMonday));

    for (let i = 1; i <= 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + (i - 1));
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      columnDateMap[i] = `${yyyy}-${mm}-${dd}`;
    }
  }

  // 5. Duyệt qua từng hàng dữ liệu để trích xuất Slot và môn học
  const scheduleItems = [];

  rows.forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll('td, th'));
    if (cells.length < 2) return;

    // Xác định Slot number từ cell đầu tiên hoặc rowIndex
    const firstCellText = (cells[0].innerText || '').toLowerCase();
    let slotNum = 0;
    const slotMatch = firstCellText.match(/(?:slot|ca)\s*(\d)/i);
    if (slotMatch) {
      slotNum = parseInt(slotMatch[1], 10);
    } else {
      // Thử tìm số từ 1 đến 6 ở đầu hàng
      const numMatch = firstCellText.match(/\b([1-6])\b/);
      if (numMatch) {
        slotNum = parseInt(numMatch[1], 10);
      } else if (rowIndex >= 1 && rowIndex <= 6) {
        slotNum = rowIndex;
      }
    }

    if (!slotNum || slotNum < 1 || slotNum > 6) return;

    // Duyệt qua các cell ngày học trong hàng
    cells.forEach((cell, cellIndex) => {
      if (cellIndex === 0) return; // Bỏ qua cột slot label

      const cellText = (cell.innerText || '').trim();
      if (!cellText || cellText === '-' || cellText === '—') return;

      // Tìm ngày tương ứng với cột này
      const targetDate = columnDateMap[cellIndex] || columnDateMap[cellIndex - 1];
      if (!targetDate) return;

      // Làm sạch và bóc tách dữ liệu ô học
      // Các định dạng phổ biến trên FAP:
      // "SWP391 at AL-L502 (SonNT5)"
      // hoặc:
      // SWP391
      // at AL-L502
      // (SonNT5)
      // (attended) / (not yet)
      const lines = cellText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && 
                     !l.toLowerCase().includes('attended') && 
                     !l.toLowerCase().includes('not yet') &&
                     !l.toLowerCase().includes('vắng') &&
                     !l.toLowerCase().includes('có mặt'));

      if (lines.length === 0) return;

      let subject = lines[0] || 'Lớp học FPT';
      let room = 'Phòng học FPT';
      let teacher = '';
      let group = '';

      // Quét từng dòng để nhận diện Room, Teacher, Class/Group
      lines.forEach((line, idx) => {
        // Tìm room: "at AL-502", "Phòng: BE-301", "Room: ...", hoặc pattern tên phòng FPT
        const roomMatch = line.match(/(?:at|phòng|room)?\s*([A-Z]{1,4}[-_]?[A-Z0-9]{2,6})/i);
        if (roomMatch && idx > 0 && !roomMatch[1].startsWith('SE') && !roomMatch[1].startsWith('IA')) {
          room = roomMatch[1].toUpperCase();
        }

        // Tìm giảng viên: "(SonNT5)", "GV: ...", "Lecturer: ..."
        const teacherMatch = line.match(/(?:\((?:GV:\s*)?([A-Za-z0-9_]{3,15})\)|(?:GV|Lecturer):\s*([A-Za-z0-9_]{3,15}))/i);
        if (teacherMatch) {
          teacher = (teacherMatch[1] || teacherMatch[2] || '').trim();
        }

        // Tìm mã nhóm/lớp: SE1701, IA1602, etc.
        const groupMatch = line.match(/\b([A-Z]{2,3}\d{4,5})\b/);
        if (groupMatch && groupMatch[1] !== subject) {
          group = groupMatch[1];
        }
      });

      // Nếu room chưa tìm thấy chính xác, tìm chuỗi phòng phổ biến
      if (room === 'Phòng học FPT') {
        const fallbackRoom = cellText.match(/(?:AL|BE|DE|OR|NV|BETA|GAMMA|DELTA)[-_]?[A-Z0-9]+/i);
        if (fallbackRoom) {
          room = fallbackRoom[0].toUpperCase();
        }
      }

      // Làm sạch tên môn (bỏ "at ...", bỏ ngoặc thừa)
      subject = subject.replace(/\bat\b.*$/i, '').replace(/\(.*\)/g, '').trim();

      scheduleItems.push({
        date: targetDate,
        slot: slotNum,
        subject: subject,
        room: room,
        teacher: teacher || 'FPT Lecturer',
        group: group || '',
        note: `Thời khóa biểu FAP FPT - Lớp: ${group || 'N/A'}`
      });
    });
  });

  if (scheduleItems.length === 0) {
    showToast('⚠️ Không tìm thấy ca học nào trong tuần này!', 'error');
    return;
  }

  showToast(`⚡ Đã trích xuất ${scheduleItems.length} ca học! Đang đồng bộ...`, 'info');

  // 6. Gửi payload về backend
  const payload = {
    studentId: studentCode,
    studentName: studentName || studentCode,
    extractedAt: new Date().toISOString(),
    source: 'FAP FPT Bookmarklet',
    schedule: scheduleItems
  };

  const syncUrl = `${BACKEND_URL.replace(/\/$/, '')}/api/sync`;

  fetch(syncUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      const userId = data.userId || studentCode;
      const webcalUrl = data.webcalUrl || `webcal://fap-calendar-sync.onrender.com/api/feed/${userId}.ics`;
      const exportUrl = `${BACKEND_URL.replace(/\/$/, '')}/api/export-ics/${userId}`;
      const portalUrl = `${BACKEND_URL.replace(/\/$/, '')}/?userId=${userId}`;

      showToast(`⚡ Thành công! Đang tự động mở Lịch điện thoại...`, 'success');

      // TỰ ĐỘNG BUNG POPUP ĐĂNG KÝ LỊCH CỦA APPLE / GOOGLE CALENDAR
      setTimeout(() => {
        try {
          window.location.href = webcalUrl;
        } catch (e) {
          console.warn('Auto redirect blocked:', e);
        }
      }, 500);

      // 7. Hiển thị Popup Modal kết quả xịn sò ngay trên tab FAP
      renderResultModal({
        count: scheduleItems.length,
        studentCode,
        studentName: data.studentName || studentName,
        userId,
        webcalUrl,
        exportUrl,
        portalUrl
      });
    })
    .catch(err => {
      console.error('Lỗi sync FAP:', err);
      showToast('❌ Không thể kết nối Backend. Kiểm tra kết nối mạng!', 'error');
      // Fallback: Tải trực tiếp file ICS offline nếu backend không phản hồi
      fallbackOfflineIcsDownload(scheduleItems, studentCode);
    });

  // Modal giao diện kết quả nổi trên màn hình điện thoại
  function renderResultModal(info) {
    const modal = document.createElement('div');
    modal.id = OVERLAY_ID;
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 99999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    modal.innerHTML = `
      <div style="background: #ffffff; border-radius: 20px; max-width: 440px; width: 100%; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); text-align: center; color: #1e293b; animation: fapFadeIn 0.3s ease;">
        <div style="width: 56px; height: 56px; background: #ecfdf5; color: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 16px;">
          ✓
        </div>
        <h3 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #0f172a;">Trích xuất thành công!</h3>
        <p style="margin: 0 0 6px; font-size: 14px; color: #64748b;">
          Đã bóc tách <strong>${info.count}</strong> ca học cho <strong>${info.studentName || info.studentCode}</strong>.
        </p>
        <p style="margin: 0 0 18px; font-size: 12px; color: #059669; font-weight: 600;">
          ✓ Đang tự động mở hộp thoại Đăng ký Lịch Apple / Google Calendar...
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
          <a href="${info.webcalUrl}" style="display: block; background: #f97316; color: #ffffff; text-decoration: none; padding: 14px 20px; border-radius: 12px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35);">
            📲 Tự động thêm vào Lịch (iOS / Android)
          </a>
          <a href="${info.exportUrl}" target="_blank" style="display: block; background: #f1f5f9; color: #334155; text-decoration: none; padding: 12px 20px; border-radius: 12px; font-weight: 600; font-size: 14px; border: 1px solid #e2e8f0;">
            📥 Tải file tĩnh .ics (Dự phòng)
          </a>
          <a href="${info.portalUrl}" target="_blank" style="display: block; background: #f8fafc; color: #2563eb; text-decoration: none; padding: 10px 20px; border-radius: 12px; font-weight: 600; font-size: 13px;">
            🌐 Xem chi tiết trên Web App
          </a>
        </div>

        <button id="fap-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 13px; font-weight: 600; cursor: pointer; padding: 6px 12px;">
          Đóng cửa sổ
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('fap-close-btn').addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // Dự phòng tạo file ICS trực tiếp trên trình duyệt nếu backend offline
  function fallbackOfflineIcsDownload(items, code) {
    const slotTimes = {
      1: { s: '070000', e: '091500' },
      2: { s: '093000', e: '114500' },
      3: { s: '123000', e: '144500' },
      4: { s: '150000', e: '171500' },
      5: { s: '173000', e: '194500' },
      6: { s: '200000', e: '221500' }
    };

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FPT University//FAP Schedule Extractor//VI',
      'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:Thời khóa biểu FPT',
      'X-WR-TIMEZONE:Asia/Ho_Chi_Minh'
    ];

    items.forEach((item, i) => {
      const times = slotTimes[item.slot] || slotTimes[1];
      const dClean = item.date.replace(/-/g, '');
      const uid = `fpt-${Date.now()}-${i}@fap`;
      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`UID:${uid}`);
      icsContent.push(`DTSTART;TZID=Asia/Ho_Chi_Minh:${dClean}T${times.s}`);
      icsContent.push(`DTEND;TZID=Asia/Ho_Chi_Minh:${dClean}T${times.e}`);
      icsContent.push(`SUMMARY:[Học] ${item.subject} (${item.room})`);
      icsContent.push(`DESCRIPTION:Môn học: ${item.subject}\\nPhòng: ${item.room}\\nGiảng viên: ${item.teacher}\\nSlot: ${item.slot}`);
      icsContent.push(`LOCATION:${item.room}`);
      icsContent.push('BEGIN:VALARM');
      icsContent.push('TRIGGER:-PT15M');
      icsContent.push('ACTION:DISPLAY');
      icsContent.push(`DESCRIPTION:Sắp đến giờ học ${item.subject}`);
      icsContent.push('END:VALARM');
      icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FAP_LichHoc_${code || 'FPT'}.ics`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  }
})();
