/**
 * FAP Calendar Extractor Bookmarklet (Optimized for iOS Safari & Android Chrome)
 * Tự động trích xuất Thời khóa biểu FAP (Đại học FPT) và đồng bộ vào Apple Calendar / Google Calendar
 */
(function () {
  try {
    const OVERLAY_ID = 'fap-sync-modal-overlay';
    const existingOverlay = document.getElementById(OVERLAY_ID);
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const BACKEND_URL = window.FAP_SYNC_BACKEND_URL || 'https://fap-calendar-sync.onrender.com';

    // 1. Kiểm tra xem có đang ở trang FAP hay không
    const host = window.location.hostname || '';
    const currentUrl = window.location.href || '';
    const isFapDomain = host.includes('fpt.edu.vn') || currentUrl.includes('fap');

    if (!isFapDomain) {
      alert('⚠️ Bạn đang KHÔNG ở trang FAP!\n\nVui lòng mở Safari vào "fap.fpt.edu.vn" -> Đăng nhập -> chọn "Weekly Timetable" rồi bấm lại Bookmarklet này nhé!');
      return;
    }

    // 2. Tìm bảng thời khóa biểu (Quét cả document và các frame nếu có)
    function getAllTables() {
      let tables = Array.from(document.querySelectorAll('table'));
      // Quét thêm nếu có iframe
      const iframes = Array.from(document.querySelectorAll('iframe'));
      iframes.forEach(frame => {
        try {
          if (frame.contentDocument) {
            tables = tables.concat(Array.from(frame.contentDocument.querySelectorAll('table')));
          }
        } catch (e) {}
      });
      return tables;
    }

    const tables = getAllTables();
    if (tables.length === 0) {
      alert('❌ Không tìm thấy bảng nào trên trang FAP này!\n\nBạn hãy đảm bảo đang ở mục "Weekly Timetable" (Thời khóa biểu theo tuần).');
      return;
    }

    // Tìm table thời khóa biểu: chứa từ khóa Slot / Ca / Mon / Thứ / 07:30
    let targetTable = null;
    for (const tbl of tables) {
      const text = (tbl.innerText || tbl.textContent || '').toLowerCase();
      if ((text.includes('slot') || text.includes('ca')) && 
          (text.includes('mon') || text.includes('thứ') || text.includes('tuesday') || text.includes('tuần') || text.includes('chủ nhật'))) {
        targetTable = tbl;
        break;
      }
    }

    // Fallback nếu không khớp từ khóa: lấy table có nhiều ô nhất (> 20 ô)
    if (!targetTable) {
      let maxCells = 0;
      tables.forEach(t => {
        const count = t.querySelectorAll('td, th').length;
        if (count > maxCells && count >= 15) {
          maxCells = count;
          targetTable = t;
        }
      });
    }

    if (!targetTable) {
      alert('❌ Đang ở FAP nhưng không thấy Bảng Thời Khóa Biểu!\n\nVui lòng vào đúng mục: "Schedule" -> "Weekly Timetable" rồi bấm lại.');
      return;
    }

    // 3. Trích xuất thông tin sinh viên
    let studentCode = 'STUDENT';
    let studentName = 'Quang Thành Đạt';
    try {
      const bodyText = document.body.innerText || document.body.textContent || '';
      const codeMatch = bodyText.match(/\b([A-Z]{2}\d{5,7})\b/i);
      if (codeMatch) {
        studentCode = codeMatch[1].toUpperCase();
      }
      const userEl = document.querySelector('#ctl00_lblUser, .user-name, #lblUser, .dropdown-toggle');
      if (userEl && userEl.innerText.trim()) {
        studentName = userEl.innerText.trim();
      }
    } catch (e) {}

    // 4. Phân tích cột Header (Lấy ngày học)
    const rows = Array.from(targetTable.querySelectorAll('tr'));
    if (rows.length < 2) {
      alert('❌ Bảng thời khóa biểu không có hàng dữ liệu nào!');
      return;
    }

    // Header row
    let headerRow = rows[0];
    let headerCells = Array.from(headerRow.querySelectorAll('th, td'));
    if (headerCells.length <= 2 && rows.length > 1) {
      headerRow = rows[1];
      headerCells = Array.from(headerRow.querySelectorAll('th, td'));
    }

    const columnDateMap = {};
    const currentYear = new Date().getFullYear();

    headerCells.forEach((cell, colIndex) => {
      const text = (cell.innerText || cell.textContent || '').trim();
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

    // Nếu không tìm thấy ngày ở header (do FAP chỉ ghi Thứ 2, Thứ 3...) -> Fallback ngày tuần hiện tại
    if (Object.keys(columnDateMap).length === 0) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
      const monday = new Date(today.setDate(diff));

      for (let i = 1; i <= 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + (i - 1));
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        columnDateMap[i] = `${yyyy}-${mm}-${dd}`;
      }
    }

    // 5. Duyệt từng hàng để bóc tách ca học
    const scheduleItems = [];

    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll('td, th'));
      if (cells.length < 2) return;

      const firstCellText = (cells[0].innerText || cells[0].textContent || '').toLowerCase();
      let slotNum = 0;
      const slotMatch = firstCellText.match(/(?:slot|ca)\s*(\d)/i);
      if (slotMatch) {
        slotNum = parseInt(slotMatch[1], 10);
      } else {
        const numMatch = firstCellText.match(/\b([1-6])\b/);
        if (numMatch) {
          slotNum = parseInt(numMatch[1], 10);
        } else if (rowIndex >= 1 && rowIndex <= 6) {
          slotNum = rowIndex;
        }
      }

      if (!slotNum || slotNum < 1 || slotNum > 6) return;

      cells.forEach((cell, cellIndex) => {
        if (cellIndex === 0) return;

        const cellText = (cell.innerText || cell.textContent || '').trim();
        if (!cellText || cellText === '-' || cellText === '—') return;

        const targetDate = columnDateMap[cellIndex] || columnDateMap[cellIndex - 1];
        if (!targetDate) return;

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

        lines.forEach((line, idx) => {
          const roomMatch = line.match(/(?:at|phòng|room)?\s*([A-Z]{1,4}[-_]?[A-Z0-9]{2,6})/i);
          if (roomMatch && idx > 0 && !roomMatch[1].startsWith('SE') && !roomMatch[1].startsWith('IA')) {
            room = roomMatch[1].toUpperCase();
          }

          const teacherMatch = line.match(/(?:\((?:GV:\s*)?([A-Za-z0-9_]{3,15})\)|(?:GV|Lecturer):\s*([A-Za-z0-9_]{3,15}))/i);
          if (teacherMatch) {
            teacher = (teacherMatch[1] || teacherMatch[2] || '').trim();
          }

          const groupMatch = line.match(/\b([A-Z]{2,3}\d{4,5})\b/);
          if (groupMatch && groupMatch[1] !== subject) {
            group = groupMatch[1];
          }
        });

        if (room === 'Phòng học FPT') {
          const fallbackRoom = cellText.match(/(?:AL|BE|DE|OR|NV|BETA|GAMMA|DELTA)[-_]?[A-Z0-9]+/i);
          if (fallbackRoom) room = fallbackRoom[0].toUpperCase();
        }

        subject = subject.replace(/\bat\b.*$/i, '').replace(/\(.*\)/g, '').trim();

        scheduleItems.push({
          date: targetDate,
          slot: slotNum,
          subject: subject,
          room: room,
          teacher: teacher || 'FPT Lecturer',
          group: group || '',
          note: `Lịch học FAP FPT - Lớp: ${group || 'N/A'}`
        });
      });
    });

    // 6. Kiểm tra số ca học bóc tách được
    if (scheduleItems.length === 0) {
      alert('⚠️ Tuần hiện tại trên FAP của bạn KHÔNG CÓ ca học nào!\n\n(Có thể tuần này bạn đang được nghỉ hoặc chưa tới lịch). Hãy chọn tuần tiếp theo trên FAP rồi bấm lại nhé!');
      return;
    }

    // 7. Gửi dữ liệu về backend Render
    const payload = {
      studentId: studentCode,
      studentName: studentName || 'Quang Thành Đạt',
      extractedAt: new Date().toISOString(),
      source: 'FAP FPT Bookmarklet',
      schedule: scheduleItems
    };

    const userId = (studentCode || 'SE170001').toLowerCase();
    const webcalUrl = `webcal://fap-calendar-sync.onrender.com/api/feed/${userId}.ics`;

    // Hiển thị thông báo ngay cho sinh viên biết thành công
    const confirmSync = confirm(
      `🎉 ĐÃ TRÍCH XUẤT THÀNH CÔNG ${scheduleItems.length} CA HỌC!\n` +
      `Sinh viên: ${studentName} (${studentCode})\n\n` +
      `👉 Bấm OK để TỰ ĐỘNG ĐỒNG BỘ VÀO LỊCH ĐIỆN THOẠI NGAY LẬP TỨC!`
    );

    // Gửi ngầm về server
    fetch(`${BACKEND_URL}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(e => console.warn('Sync server err:', e));

    if (confirmSync) {
      // Mở ngay Webcal vào Apple Calendar / Google Calendar
      window.location.href = webcalUrl;
    }

  } catch (err) {
    alert('❌ Có lỗi xảy ra trong quá trình bóc tách:\n' + err.message);
  }
})();
