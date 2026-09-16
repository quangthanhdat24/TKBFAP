export interface ScheduleItem {
  date: string; // YYYY-MM-DD
  slot: number; // 1 to 6
  subject: string;
  room: string;
  teacher?: string;
  group?: string;
  note?: string;
}

export interface UserScheduleData {
  userId: string;
  studentId: string;
  studentName?: string;
  updatedAt: string;
  schedule: ScheduleItem[];
}

export interface SlotTimeInfo {
  start: [number, number];
  end: [number, number];
  startTimeStr: string;
  endTimeStr: string;
  label: string;
}
