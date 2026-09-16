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
    let studentName = '';
    try {
      // Kiểm tra tham số URL rollNumber nếu có
      const urlParams = new URLSearchParams(window.location.search);
      const urlRoll = urlParams.get('rollNumber') || urlParams.get('roll') || '';
      if (urlRoll) detectedStudentCode = urlRoll.trim().toUpperCase();

      const bodyText = document.body.innerText || document.body.textContent || '';
      // Tìm dòng đặc trưng của FAP: "Activities for DatQTCE180531 (Quang Thành Đạt)" hoặc "Activities for SE182345 (Nguyễn Văn A)"
      const actMatch = bodyText.match(/Activities for\s+([A-Za-z0-9_]+)\s*(?:\(([^)]+)\))?/i);
      if (actMatch) {
        if (!detectedStudentCode) detectedStudentCode = actMatch[1].trim().toUpperCase();
        if (actMatch[2]) studentName = actMatch[2].trim();
      } else {
        // Tìm mã sinh viên FPT dạng chuẩn: SE180123, CE180531, HE170456, QE180001, IA180000...
        const codeMatches = bodyText.match(/\b([A-Z]{2,4}\d{6})\b/g);
        if (codeMatches && codeMatches.length > 0 && !detectedStudentCode) {
          detectedStudentCode = codeMatches[0].toUpperCase();
        }
      }

      const userEl = document.querySelector('#ctl00_lblUser, .user-name, #lblUser, .dropdown-toggle, #ctl00_mainContent_lblStudent');
      if (userEl && userEl.innerText.trim()) {
        const uText = userEl.innerText.trim();
        const m = uText.match(/([A-Z]{2,4}\d{6})/i);
        if (m && !detectedStudentCode) detectedStudentCode = m[1].toUpperCase();
        const cleanName = uText.replace(/\([A-Za-z0-9_]+\)/g, '').replace(/\|.*/, '').trim();
        if (cleanName && !studentName) studentName = cleanName;
      }
    } catch (e) {}

    // Xác nhận Mã số sinh viên với người dùng (không gán cứng mã của người khác)
    const defaultId = detectedStudentCode || '';
    const promptCode = prompt(
      '🎓 BƯỚC 1: Xác nhận Mã số sinh viên của bạn để tạo link Lịch riêng:\n(Ví dụ: SE180123, CE180531, HE170456...)',
      defaultId
    );

    if (!promptCode || !promptCode.trim()) {
      alert('⚠️ Bạn chưa nhập mã sinh viên. Quá trình đồng bộ đã dừng.');
      return; // Người dùng bấm Hủy
    }
    const studentCode = promptCode.trim().toUpperCase();

    // 3. Hàm bóc tách bảng thời khóa biểu từ bất kỳ document / container HTML nào
    function parseScheduleFromDoc(containerDoc, fallbackMonday) {
      let weekStart = fallbackMonday;
      try {
        const weekSelect = containerDoc.querySelector('select[name*="drpSelectWeek"], #ctl00_mainContent_drpSelectWeek, #drpSelectWeek');
        if (weekSelect && weekSelect.selectedOptions && weekSelect.selectedOptions[0]) {
          const selectedText = weekSelect.selectedOptions[0].innerText || '';
          const m = selectedText.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/);
          if (m) {
            const d = parseInt(m[1], 10);
            const month = parseInt(m[2], 10) - 1;
            const y = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
            weekStart = new Date(y, month, d);
          }
        }
      } catch (e) {}

      const allTables = Array.from(containerDoc.querySelectorAll('table'));
      let scheduleTable = null;

      for (const tbl of allTables) {
        const txt = (tbl.innerText || tbl.textContent || '').toLowerCase();
        if ((txt.includes('slot') || txt.includes('ca')) && 
            (txt.includes('mon') || txt.includes('thứ') || txt.includes('tuesday') || txt.includes('tuần'))) {
          scheduleTable = tbl;
          break;
        }
      }

      if (!scheduleTable) {
        let maxCells = 0;
        allTables.forEach(t => {
          const c = t.querySelectorAll('td, th').length;
          if (c > maxCells && c >= 14) {
            maxCells = c;
            scheduleTable = t;
          }
        });
      }

      if (!scheduleTable) return [];

      const rows = Array.from(scheduleTable.querySelectorAll('tr'));
      if (rows.length < 2) return [];

      const columnDateMap = {};
      const currentYear = new Date().getFullYear();

      rows.slice(0, 3).forEach(r => {
        const cells = Array.from(r.querySelectorAll('th, td'));
        cells.forEach((cell, idx) => {
          const txt = (cell.innerText || cell.textContent || '').trim();
          const matchFull = txt.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
          const matchShort = txt.match(/(\d{1,2})[\/\-](\d{1,2})/);

          if (matchFull) {
            columnDateMap[idx] = `${matchFull[3]}-${matchFull[2].padStart(2, '0')}-${matchFull[1].padStart(2, '0')}`;
          } else if (matchShort && !columnDateMap[idx]) {
            columnDateMap[idx] = `${currentYear}-${matchShort[2].padStart(2, '0')}-${matchShort[1].padStart(2, '0')}`;
          }
        });
      });

      if (Object.keys(columnDateMap).length === 0) {
        let baseMonday = weekStart;
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

      const items = [];
      rows.forEach((row, rIdx) => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        if (cells.length < 2) return;

        const firstTxt = (cells[0].innerText || cells[0].textContent || '').toLowerCase();
        let slotNum = 0;
        const slotMatch = firstTxt.match(/(?:slot|ca)\s*(\d)/i);
        if (slotMatch) {
          slotNum = parseInt(slotMatch[1], 10);
        } else {
          const numMatch = firstTxt.match(/\b([1-8])\b/);
          if (numMatch) {
            slotNum = parseInt(numMatch[1], 10);
          } else if (rIdx >= 1 && rIdx <= 8) {
            slotNum = rIdx;
          }
        }

        if (!slotNum || slotNum < 1 || slotNum > 8) return;

        cells.forEach((cell, cIdx) => {
          if (cIdx === 0) return;

          const cellText = (cell.innerText || cell.textContent || '').trim();
          if (!cellText || cellText === '-' || cellText === '—') return;

          const targetDate = columnDateMap[cIdx] || columnDateMap[cIdx - 1];
          if (!targetDate) return;

          let subject = '';
          const subjectMatch = cellText.match(/\b([A-Z]{3}\d{3}[A-Za-z]?)\b/);
          if (subjectMatch) {
            subject = subjectMatch[1];
          } else {
            const lines = cellText.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length > 0) {
              subject = lines[0].replace(/\bat\b.*$/i, '').replace(/\(.*\)/g, '').trim();
            }
          }
          if (!subject) return;

          let room = 'Phòng FPT';
          const roomMatch = cellText.match(/(?:at|phòng|room)?\s*(R\.[A-Za-z0-9_-]+|[A-Z]{1,5}[-_]?[A-Z0-9]{2,6})/i);
          if (roomMatch && !roomMatch[1].startsWith('SE') && !roomMatch[1].startsWith('IA')) {
            room = roomMatch[1].toUpperCase();
          }

          let startTime = '';
          let endTime = '';
          const timeMatch = cellText.match(/\(?(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\)?/);
          if (timeMatch) {
            startTime = timeMatch[1].padStart(5, '0');
            endTime = timeMatch[2].padStart(5, '0');
          }

          let teacher = '';
          const teacherMatch = cellText.match(/\(([A-Za-z0-9_]{3,15})\)/);
          if (teacherMatch) {
            teacher = teacherMatch[1];
          }

          let group = '';
          const groupMatch = cellText.match(/\b([A-Z]{2,3}\d{4,5})\b/);
          if (groupMatch && groupMatch[1] !== subject) {
            group = groupMatch[1];
          }

          let note = '';
          if (cellText.includes('attended')) note += 'Đã tham gia (attended) • ';
          if (cellText.includes('Not yet')) note += 'Sắp diễn ra • ';
          if (cellText.includes('EduNext')) note += 'EduNext • ';
          if (cellText.includes('Online')) note += 'Online • ';
          if (cellText.includes('Meet URL')) note += 'Google Meet • ';

          items.push({
            date: targetDate,
            slot: slotNum,
            subject: subject,
            room: room,
            teacher: teacher || 'Giảng viên FPT',
            group: group || '',
            startTime: startTime || undefined,
            endTime: endTime || undefined,
            note: note.trim().replace(/•$/, '') || `Lịch học FAP FPT - Lớp: ${group || 'N/A'}`
          });
        });
      });

      return items;
    }

    // 4. Lấy các ca học của tuần hiện tại
    let scheduleItems = parseScheduleFromDoc(document, null);

    // 5. Kiểm tra xem có Dropdown chọn tuần của cả kỳ không
    const weekSelect = document.querySelector('select[name*="drpSelectWeek"], #ctl00_mainContent_drpSelectWeek, #drpSelectWeek');
    const weekOptions = weekSelect ? Array.from(weekSelect.options).filter(o => o.value) : [];

    // Nếu FAP có nhiều tuần (cả học kỳ): Cho phép người dùng quét toàn bộ học kỳ!
    if (weekOptions.length > 1) {
      const wantFullSemester = confirm(
        `📅 BẠN MUỐN QUÉT TOÀN BỘ CẢ HỌC KỲ HAY CHỈ 1 TUẦN NÀY?\n\n` +
        `• Bấm [OK] để QUÉT CẢ HỌC KỲ (${weekOptions.length} tuần tự động):\n` +
        `  Hệ thống sẽ duyệt qua từng tuần và gom toàn bộ 100+ ca học vào lịch iPhone của bạn!\n\n` +
        `• Bấm [Hủy] nếu bạn chỉ muốn lấy 1 tuần đang hiển thị.`
      );

      if (wantFullSemester) {
        // Tạo HUD thông báo tiến trình quét
        const hud = document.createElement('div');
        hud.id = 'fap-crawler-hud';
        hud.style = 'position:fixed;top:15px;right:15px;z-index:9999999;background:#0f172a;border:2px solid #f97316;color:#f8fafc;padding:16px 20px;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.6);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:13px;width:320px;line-height:1.5;';
        hud.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:18px;">⚡</span>
            <strong style="color:#fb923c;font-size:14px;">Đang quét cả học kỳ FAP...</strong>
          </div>
          <div id="fap-crawl-status" style="color:#cbd5e1;font-size:12px;margin-bottom:8px;">Đang khởi động tiến trình...</div>
          <div style="background:#1e293b;border-radius:9999px;height:8px;overflow:hidden;">
            <div id="fap-crawl-bar" style="background:#f97316;height:100%;width:0%;transition:width 0.2s ease;"></div>
          </div>
          <div id="fap-crawl-count" style="margin-top:8px;font-size:11px;color:#94a3b8;font-family:monospace;">0 ca học đã tìm thấy</div>
        `;
        document.body.appendChild(hud);

        const statusEl = document.getElementById('fap-crawl-status');
        const barEl = document.getElementById('fap-crawl-bar');
        const countEl = document.getElementById('fap-crawl-count');

        const allSemesterItems = [];
        const seenKeys = new Set();

        const addItems = (items) => {
          items.forEach(it => {
            const key = `${it.date}_${it.slot}_${it.subject}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              allSemesterItems.push(it);
            }
          });
        };

        // Thêm các ca của trang hiện tại trước
        addItems(scheduleItems);

        // Duyệt qua từng tuần
        for (let i = 0; i < weekOptions.length; i++) {
          const opt = weekOptions[i];
          const pct = Math.round(((i + 1) / weekOptions.length) * 100);
          if (barEl) barEl.style.width = `${pct}%`;
          if (statusEl) statusEl.innerText = `Đang quét: ${opt.innerText.trim().slice(0, 25)} (${i + 1}/${weekOptions.length})...`;

          if (opt.selected) {
            // Tuần hiện tại đã parse ở trên
            if (countEl) countEl.innerText = `${allSemesterItems.length} ca học đã tìm thấy`;
            continue;
          }

          try {
            const form = document.querySelector('form') || document.forms[0];
            const formData = new FormData(form);
            formData.set('__EVENTTARGET', weekSelect.name);
            formData.set('__EVENTARGUMENT', '');
            formData.set(weekSelect.name, opt.value);

            const res = await fetch(window.location.href, {
              method: 'POST',
              body: formData
            });
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const m = opt.innerText.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/);
            let optDate = null;
            if (m) {
              const d = parseInt(m[1], 10);
              const month = parseInt(m[2], 10) - 1;
              const y = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
              optDate = new Date(y, month, d);
            }

            const weekItems = parseScheduleFromDoc(doc, optDate);
            addItems(weekItems);

            if (countEl) countEl.innerText = `${allSemesterItems.length} ca học đã tìm thấy`;
          } catch (e) {
            console.warn('[FAP Scan Error week]', opt.value, e);
          }

          // Delay nhỏ 100ms để server FAP không bị nghẽn
          await new Promise(r => setTimeout(r, 100));
        }

        if (allSemesterItems.length > 0) {
          scheduleItems = allSemesterItems;
        }

        // Gỡ HUD
        if (hud && hud.parentNode) hud.parentNode.removeChild(hud);
      }
    }

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
    const hostOnly = BACKEND_URL.replace(/^https?:\/\//, '');
    const liveFeedUrl = `${BACKEND_URL}/api/feed/${cleanUserId}.ics`;
    const webcalUrl = `webcal://${hostOnly}/api/feed/${cleanUserId}.ics`;
    const portalUrl = `${BACKEND_URL}?userId=${cleanUserId}`;

    if (syncSuccess) {
      alert(
        `✅ ĐÃ LƯU THỜI KHÓA BIỂU CHO ${studentCode} ${studentName ? `(${studentName})` : ''} THÀNH CÔNG!\n\n` +
        `• Tổng số ca: ${scheduleItems.length} ca học\n` +
        `• Link lịch riêng của bạn:\n${liveFeedUrl}\n\n` +
        `👉 Bấm OK, máy sẽ tự động đăng ký vào ứng dụng Lịch (Apple Calendar / Google Calendar) trên thiết bị của bạn!`
      );
      // Mở Webcal
      window.location.href = webcalUrl;
    } else {
      alert(
        `✅ Đã trích xuất ${scheduleItems.length} ca học cho ${studentCode}!\n\n` +
        `Link lịch riêng của bạn:\n${liveFeedUrl}\n\n` +
        `👉 Bấm OK để mở Lịch điện thoại!`
      );
      window.location.href = webcalUrl;
    }

  } catch (globalErr) {
    alert('❌ Có lỗi khi bóc tách thời khóa biểu:\n' + globalErr.message);
  }
})();
