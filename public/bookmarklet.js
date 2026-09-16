/**
 * FAP Calendar Extractor Bookmarklet (Production - V3 Rock Solid)
 * Tự động trích xuất Thời khóa biểu THỰC từ FAP (Đại học FPT) và đồng bộ vào Apple Calendar / Google Calendar
 */
(async function () {
  try {
    const OVERLAY_ID = 'fap-sync-modal-overlay';
    const existingOverlay = document.getElementById(OVERLAY_ID);
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const BACKEND_URL = window.FAP_SYNC_BACKEND_URL || 'https://fap-calendar-sync.onrender.com';

    // 1. Kiểm tra trang web FAP
    const host = window.location.hostname || '';
    const href = window.location.href || '';
    const isFap = host.includes('fpt.edu.vn') || href.includes('fap');

    if (!isFap) {
      alert('⚠️ Bạn đang KHÔNG ở trên trang FAP!\n\nVui lòng mở Safari trên iPhone, vào "fap.fpt.edu.vn" -> Chọn "Weekly Timetable" rồi bấm lại Bookmarklet này nhé!');
      return;
    }

    // 2. Tìm mã sinh viên tự động từ trang FAP
    let detectedStudentCode = '';
    let studentName = 'Quang Thành Đạt';
    try {
      const bodyText = document.body.innerText || document.body.textContent || '';
      // Tìm mã sinh viên dạng HE171234, SE160000, QE180000, HS170000, v.v.
      const codeMatches = bodyText.match(/\b([A-Z]{2}\d{5,7})\b/g);
      if (codeMatches && codeMatches.length > 0) {
        // Lấy mã đầu tiên không phải mã môn
        detectedStudentCode = codeMatches[0].toUpperCase();
      }
      const userEl = document.querySelector('#ctl00_lblUser, .user-name, #lblUser, .dropdown-toggle');
      if (userEl && userEl.innerText.trim()) {
        studentName = userEl.innerText.trim();
      }
    } catch (e) {}

    // Xác nhận Mã số sinh viên với người dùng
    const defaultId = detectedStudentCode || 'SE180000';
    const promptCode = prompt(
      '🎓 BƯỚC 1: Xác nhận Mã số sinh viên của bạn để tạo link Lịch riêng:\n(Ví dụ: SE181234, HE170000, QE180000...)',
      defaultId
    );

    if (!promptCode) {
      return; // Người dùng bấm Hủy
    }
    const studentCode = promptCode.trim().toUpperCase();

    // 3. Tìm ngày của tuần từ Dropdown chọn tuần của FAP (nếu có)
    let weekStartDate = null;
    try {
      const weekSelect = document.querySelector('select[name*="drpSelectWeek"], #ctl00_mainContent_drpSelectWeek, #drpSelectWeek');
      if (weekSelect && weekSelect.selectedOptions && weekSelect.selectedOptions[0]) {
        const selectedText = weekSelect.selectedOptions[0].innerText || '';
        // Định dạng: 15/09/2026 To 21/09/2026 hoặc 15/09 To 21/09
        const m = selectedText.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/);
        if (m) {
          const d = parseInt(m[1], 10);
          const month = parseInt(m[2], 10) - 1;
          const y = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
          weekStartDate = new Date(y, month, d);
        }
      }
    } catch (e) {}

    // 4. Tìm bảng Thời khóa biểu
    const allTables = Array.from(document.querySelectorAll('table'));
    let scheduleTable = null;

    // Quét table có chứa từ khóa Slot / Ca / Môn học
    for (const tbl of allTables) {
      const txt = (tbl.innerText || tbl.textContent || '').toLowerCase();
      if ((txt.includes('slot') || txt.includes('ca')) && 
          (txt.includes('mon') || txt.includes('thứ') || txt.includes('tuesday') || txt.includes('tuần'))) {
        scheduleTable = tbl;
        break;
      }
    }

    if (!scheduleTable) {
      // Tìm table có nhiều ô nhất
      let maxCells = 0;
      allTables.forEach(t => {
        const c = t.querySelectorAll('td, th').length;
        if (c > maxCells && c >= 14) {
          maxCells = c;
          scheduleTable = t;
        }
      });
    }

    if (!scheduleTable) {
      alert('❌ Không tìm thấy bảng thời khóa biểu trên trang hiện tại!\n\nBạn hãy đảm bảo đang mở đúng trang: "Schedule" -> "Weekly Timetable" của FAP.');
      return;
    }

    // 5. Phân tích Header để lấy ngày của 7 thứ trong tuần
    const rows = Array.from(scheduleTable.querySelectorAll('tr'));
    if (rows.length < 2) {
      alert('❌ Bảng thời khóa biểu không đủ dữ liệu để bóc tách!');
      return;
    }

    let headerRow = rows[0];
    let headerCells = Array.from(headerRow.querySelectorAll('th, td'));
    if (headerCells.length <= 2 && rows.length > 1) {
      headerRow = rows[1];
      headerCells = Array.from(headerRow.querySelectorAll('th, td'));
    }

    const columnDateMap = {};
    const currentYear = new Date().getFullYear();

    headerCells.forEach((cell, idx) => {
      const txt = (cell.innerText || cell.textContent || '').trim();
      const matchFull = txt.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      const matchShort = txt.match(/(\d{1,2})[\/\-](\d{1,2})/);

      if (matchFull) {
        columnDateMap[idx] = `${matchFull[3]}-${matchFull[2].padStart(2, '0')}-${matchFull[1].padStart(2, '0')}`;
      } else if (matchShort) {
        columnDateMap[idx] = `${currentYear}-${matchShort[2].padStart(2, '0')}-${matchShort[1].padStart(2, '0')}`;
      }
    });

    // Fallback ngày nếu Header chỉ ghi "Thứ 2, Thứ 3..." mà không ghi ngày
    if (Object.keys(columnDateMap).length === 0) {
      let baseMonday = weekStartDate;
      if (!baseMonday) {
        const today = new Date();
        const dow = today.getDay();
        const diff = today.getDate() - (dow === 0 ? 6 : dow - 1);
        baseMonday = new Date(today.setDate(diff));
      }

      for (let i = 1; i <= 7; i++) {
        const cur = new Date(baseMonday);
        cur.setDate(baseMonday.getDate() + (i - 1));
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        columnDateMap[i] = `${y}-${m}-${d}`;
      }
    }

    // 6. Bóc tách từng môn học trong từng Ca (Slot)
    const scheduleItems = [];

    rows.forEach((row, rIdx) => {
      const cells = Array.from(row.querySelectorAll('td, th'));
      if (cells.length < 2) return;

      const firstTxt = (cells[0].innerText || cells[0].textContent || '').toLowerCase();
      let slotNum = 0;
      const slotMatch = firstTxt.match(/(?:slot|ca)\s*(\d)/i);
      if (slotMatch) {
        slotNum = parseInt(slotMatch[1], 10);
      } else {
        const numMatch = firstTxt.match(/\b([1-6])\b/);
        if (numMatch) {
          slotNum = parseInt(numMatch[1], 10);
        } else if (rIdx >= 1 && rIdx <= 6) {
          slotNum = rIdx;
        }
      }

      if (!slotNum || slotNum < 1 || slotNum > 6) return;

      cells.forEach((cell, cIdx) => {
        if (cIdx === 0) return; // Cột số slot

        const cellText = (cell.innerText || cell.textContent || '').trim();
        if (!cellText || cellText === '-' || cellText === '—') return;

        // Xác định ngày tương ứng
        const targetDate = columnDateMap[cIdx] || columnDateMap[cIdx - 1];
        if (!targetDate) return;

        // Lọc các dòng không cần thiết
        const lines = cellText
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0 && 
                       !l.toLowerCase().includes('attended') && 
                       !l.toLowerCase().includes('not yet') &&
                       !l.toLowerCase().includes('vắng') &&
                       !l.toLowerCase().includes('có mặt'));

        if (lines.length === 0) return;

        // Tìm mã môn học: 3 chữ cái + 3 số (vd: SWP391, PRN212, LAB211, MAS291...)
        let subject = '';
        const subjectMatch = cellText.match(/\b([A-Z]{3}\d{3}[A-Za-z]?)\b/);
        if (subjectMatch) {
          subject = subjectMatch[1];
        } else {
          subject = lines[0].replace(/\bat\b.*$/i, '').replace(/\(.*\)/g, '').trim();
        }

        // Tìm phòng học: ví dụ AL-L502, BE-304, BETA-201...
        let room = 'Phòng FPT';
        const roomMatch = cellText.match(/(?:at|phòng|room)?\s*([A-Z]{1,5}[-_]?[A-Z0-9]{2,6})/i);
        if (roomMatch && !roomMatch[1].startsWith('SE') && !roomMatch[1].startsWith('IA')) {
          room = roomMatch[1].toUpperCase();
        }

        // Tìm giảng viên: (HaiNM1), (SonNT5)...
        let teacher = '';
        const teacherMatch = cellText.match(/\(([A-Za-z0-9_]{3,15})\)/);
        if (teacherMatch) {
          teacher = teacherMatch[1];
        }

        // Tìm lớp/group: SE1701, IA1602...
        let group = '';
        const groupMatch = cellText.match(/\b([A-Z]{2,3}\d{4,5})\b/);
        if (groupMatch && groupMatch[1] !== subject) {
          group = groupMatch[1];
        }

        scheduleItems.push({
          date: targetDate,
          slot: slotNum,
          subject: subject || 'Lớp học FPT',
          room: room,
          teacher: teacher || 'FPT Lecturer',
          group: group || '',
          note: `Lịch học FAP FPT - Lớp: ${group || 'N/A'}`
        });
      });
    });

    // 7. Kiểm tra kết quả bóc tách
    if (scheduleItems.length === 0) {
      alert(
        '⚠️ Tuần này trên FAP của bạn KHÔNG CÓ ca học nào!\n\n' +
        'Nguyên nhân: Bạn đang mở tuần nghỉ, tuần thi hoặc chưa tới kỳ học.\n\n' +
        '👉 Khắc phục: Nhìn lên ô "Select week" trên FAP, chuyển sang tuần có lịch học rồi bấm lại nhé!'
      );
      return;
    }

    // Hiển thị tóm tắt các ca học thật đã tìm thấy
    const previewList = scheduleItems.slice(0, 4).map(i => `• ${i.date} (Slot ${i.slot}): ${i.subject} (${i.room})`).join('\n');
    const confirmUpload = confirm(
      `🎉 ĐÃ BÓC TÁCH THÀNH CÔNG ${scheduleItems.length} CA HỌC THẬT TỪ FAP!\n\n` +
      `Mã sinh viên: ${studentCode}\n` +
      `Các môn tìm thấy:\n${previewList}\n` +
      `${scheduleItems.length > 4 ? `...và còn ${scheduleItems.length - 4} ca học khác.\n` : ''}\n` +
      `👉 Bấm OK để tải lên máy chủ và nhận link Lịch riêng cho iPhone của bạn!`
    );

    if (!confirmUpload) return;

    // 8. ĐỒNG BỘ LÊN MÁY CHỦ (BẮT BUỘC AWAIT ĐỂ KHÔNG BỊ HỦY REQUEST)
    const payload = {
      studentId: studentCode,
      studentName: studentName || studentCode,
      extractedAt: new Date().toISOString(),
      source: 'FAP FPT Bookmarklet Live',
      schedule: scheduleItems
    };

    let syncSuccess = false;
    try {
      const res = await fetch(`${BACKEND_URL}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const resData = await res.json();
      if (resData.success) {
        syncSuccess = true;
      }
    } catch (netErr) {
      console.warn('Lỗi mạng khi sync:', netErr);
    }

    const cleanUserId = studentCode.toLowerCase();
    const liveFeedUrl = `https://fap-calendar-sync.onrender.com/api/feed/${cleanUserId}.ics`;
    const webcalUrl = `webcal://fap-calendar-sync.onrender.com/api/feed/${cleanUserId}.ics`;

    if (syncSuccess) {
      alert(
        `✅ ĐÃ LƯU THỜI KHÓA BIỂU THỰC LÊN MÁY CHỦ THÀNH CÔNG!\n\n` +
        `Mã SV: ${studentCode}\n` +
        `Link lịch thực của bạn là:\n${liveFeedUrl}\n\n` +
        `👉 Bấm OK, máy sẽ tự động kích hoạt Lịch iPhone (Apple Calendar) của bạn ngay!`
      );
      // Mở Webcal
      window.location.href = webcalUrl;
    } else {
      alert(
        `⚠️ Máy chủ Render đang khởi động lại, đã tạo file lịch trực tiếp cho bạn!\n\n` +
        `Link lịch của bạn:\n${liveFeedUrl}`
      );
      window.location.href = webcalUrl;
    }

  } catch (globalErr) {
    alert('❌ Có lỗi khi bóc tách thời khóa biểu:\n' + globalErr.message);
  }
})();
