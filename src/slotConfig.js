/**
 * Cấu hình mốc giờ ca học (Slot) chuẩn Đại học FPT
 * Áp dụng cho các cơ sở: Hà Nội (Hòa Lạc), TP.HCM, Đà Nẵng, Quy Nhơn, Cần Thơ
 */

export const SLOT_CONFIG = {
  1: {
    start: [7, 0],
    end: [9, 15],
    startTimeStr: '07:00',
    endTimeStr: '09:15',
    label: 'Slot 1 (07:00 - 09:15)'
  },
  2: {
    start: [9, 30],
    end: [11, 45],
    startTimeStr: '09:30',
    endTimeStr: '11:45',
    label: 'Slot 2 (09:30 - 11:45)'
  },
  3: {
    start: [12, 30],
    end: [14, 45],
    startTimeStr: '12:30',
    endTimeStr: '14:45',
    label: 'Slot 3 (12:30 - 14:45)'
  },
  4: {
    start: [15, 0],
    end: [17, 15],
    startTimeStr: '15:00',
    endTimeStr: '17:15',
    label: 'Slot 4 (15:00 - 17:15)'
  },
  5: {
    start: [17, 30],
    end: [19, 45],
    startTimeStr: '17:30',
    endTimeStr: '19:45',
    label: 'Slot 5 (17:30 - 19:45)'
  },
  6: {
    start: [20, 0],
    end: [22, 15],
    startTimeStr: '20:00',
    endTimeStr: '22:15',
    label: 'Slot 6 (20:00 - 22:15)'
  }
};

/**
 * Bảng quy đổi tên Thứ trong tuần (tiếng Anh và tiếng Việt trên FAP)
 */
export const WEEKDAY_MAP = {
  'mon': 1,
  'monday': 1,
  'thứ 2': 1,
  'thu 2': 1,
  't2': 1,
  'tue': 2,
  'tuesday': 2,
  'thứ 3': 2,
  'thu 3': 2,
  't3': 2,
  'wed': 3,
  'wednesday': 3,
  'thứ 4': 3,
  'thu 4': 3,
  't4': 3,
  'thu': 4,
  'thursday': 4,
  'thứ 5': 4,
  'thu 5': 4,
  't5': 4,
  'fri': 5,
  'friday': 5,
  'thứ 6': 5,
  'thu 6': 5,
  't6': 5,
  'sat': 6,
  'saturday': 6,
  'thứ 7': 6,
  'thu 7': 6,
  't7': 6,
  'sun': 0,
  'sunday': 0,
  'chủ nhật': 0,
  'chu nhat': 0,
  'cn': 0
};

/**
 * Lấy cấu hình thời gian theo slot
 * @param {number|string} slot
 * @returns {object}
 */
export function getSlotInfo(slot) {
  const num = parseInt(slot, 10);
  return SLOT_CONFIG[num] || {
    start: [7, 0],
    end: [9, 15],
    startTimeStr: '07:00',
    endTimeStr: '09:15',
    label: `Slot ${slot}`
  };
}

/**
 * Chuẩn hóa chuỗi ngày dạng dd/MM/yyyy hoặc yyyy-MM-dd thành yyyy-MM-dd
 * @param {string} dateStr
 * @returns {string} yyyy-MM-dd
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  
  // Format dd/MM/yyyy hoặc d/M/yyyy
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    } else if (parts.length === 2) {
      // Chỉ có dd/MM => lấy năm hiện tại
      const currentYear = new Date().getFullYear();
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      return `${currentYear}-${m}-${d}`;
    }
  }
  
  // Format yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  return trimmed;
}

export default {
  SLOT_CONFIG,
  WEEKDAY_MAP,
  getSlotInfo,
  normalizeDate
};
