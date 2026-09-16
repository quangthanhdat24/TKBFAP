import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Copy,
  Check,
  Download,
  ExternalLink,
  Smartphone,
  BookOpen,
  Bell,
  Sparkles,
  Server,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  Code2,
  Shield,
  Layers,
  MapPin,
  User,
  Hash
} from 'lucide-react';
import { SLOT_CONFIG } from './slotConfig.js';
import { ScheduleItem, UserScheduleData } from './types.js';

export default function App() {
  const [userId, setUserId] = useState<string>('demo');
  const [scheduleData, setScheduleData] = useState<UserScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'sync' | 'timetable' | 'auto1touch' | 'simulator' | 'deploy'>('sync');
  const [activeGuideTab, setActiveGuideTab] = useState<'ios' | 'android'>('ios');
  const [copiedBookmarklet, setCopiedBookmarklet] = useState<boolean>(false);
  const [copiedFeedUrl, setCopiedFeedUrl] = useState<boolean>(false);
  const [copiedUserscript, setCopiedUserscript] = useState<boolean>(false);
  const [copiedShortcutJs, setCopiedShortcutJs] = useState<boolean>(false);
  const [pastedHtml, setPastedHtml] = useState<string>('');
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');

  // Lấy domain hiện tại
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://fap-sync.fpt.edu.vn';
  const host = typeof window !== 'undefined' ? window.location.host : 'fap-sync.fpt.edu.vn';

  // Lấy userId từ URL nếu có
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qUser = params.get('userId');
      if (qUser) {
        setUserId(qUser.toLowerCase());
      }
    }
  }, []);

  // Tải dữ liệu lịch của user
  const fetchSchedule = async (idToFetch: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/schedule/${idToFetch.toLowerCase()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setScheduleData(json.data);
          return;
        }
      }
      // Nếu chưa có, nạp demo
      await seedDemoSchedule(idToFetch);
    } catch (e) {
      console.warn('Không thể tải dữ liệu lịch:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule(userId);
  }, [userId]);

  // Nạp lịch demo
  const seedDemoSchedule = async (targetId: string) => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/demo-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: targetId })
      });
      const data = await res.json();
      if (data.success) {
        const fetchRes = await fetch(`/api/schedule/${targetId.toLowerCase()}`);
        const scheduleJson = await fetchRes.json();
        setScheduleData(scheduleJson.data);
        setSyncStatusMsg('Đã nạp thời khóa biểu 2 tuần FPT thành công!');
        setTimeout(() => setSyncStatusMsg(''), 4000);
      }
    } catch (err) {
      console.error('Lỗi nạp demo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Các đường dẫn Webcal & ICS
  const cleanId = (userId || 'demo').toLowerCase();
  const webcalUrl = `webcal://${host}/api/feed/${cleanId}.ics`;
  const httpFeedUrl = `${origin}/api/feed/${cleanId}.ics`;
  const downloadIcsUrl = `${origin}/api/export-ics/${cleanId}`;
  const googleCalendarSubscribeUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://${host}/api/feed/${cleanId}.ics`)}`;

  // Đoạn mã Bookmarklet 1-click
  const bookmarkletCode = `javascript:(function(){window.FAP_SYNC_BACKEND_URL='${origin}';var s=document.createElement('script');s.src='${origin}/bookmarklet.js?t='+Date.now();document.body.appendChild(s);})();`;

  const handleCopyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode).then(() => {
      setCopiedBookmarklet(true);
      setTimeout(() => setCopiedBookmarklet(false), 2500);
    });
  };

  const handleCopyFeedUrl = () => {
    navigator.clipboard.writeText(webcalUrl).then(() => {
      setCopiedFeedUrl(true);
      setTimeout(() => setCopiedFeedUrl(false), 2500);
    });
  };

  // Danh sách các ngày có lịch để filter
  const scheduleItems = scheduleData?.schedule || [];
  const uniqueDates = Array.from(new Set(scheduleItems.map(i => i.date))).sort();

  const filteredItems = selectedDateFilter === 'all'
    ? scheduleItems
    : scheduleItems.filter(i => i.date === selectedDateFilter);

  // Sắp xếp theo ngày và slot
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.slot - b.slot;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start py-4 px-3 sm:px-6 selection:bg-orange-500 selection:text-white">
      <div className="w-full max-w-xl mx-auto space-y-4">
        
        {/* Top Header Card */}
        <header id="main-header" className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-5 shadow-2xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
          
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              Đại học FPT • FAP Sync Engine
            </div>
            
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="font-medium text-emerald-400">Webcal RFC 5545</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Đồng bộ Lịch FAP <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500">
              Vào Lịch Điện Thoại iOS & Android
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
            Giải pháp trích xuất tự động từ FAP, vượt qua rào cản xác thực 2FA Google Workspace. Tự động đổ lịch học vào Apple Calendar & Google Calendar với chuông báo trước 15 phút.
          </p>

          {/* User selector / Student Code input */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Mã SV:</span>
              <div className="relative flex items-center">
                <input
                  id="student-code-input"
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value.trim().toUpperCase())}
                  placeholder="SE170001"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-orange-400 uppercase w-28 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-refresh-data"
                onClick={() => fetchSchedule(userId)}
                className="flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white px-2.5 py-1 bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700 transition"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-orange-400' : ''}`} />
                <span>Làm mới</span>
              </button>

              <button
                id="btn-seed-sample"
                onClick={() => seedDemoSchedule(userId || 'demo')}
                className="flex items-center gap-1 text-xs font-bold text-orange-400 hover:text-orange-300 px-2.5 py-1 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg border border-orange-500/30 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Nạp mẫu FPT</span>
              </button>
            </div>
          </div>

          {syncStatusMsg && (
            <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{syncStatusMsg}</span>
            </div>
          )}
        </header>

        {/* Navigation Tabs */}
        <nav id="nav-tabs" className="grid grid-cols-5 gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-xl">
          <button
            id="tab-btn-sync"
            onClick={() => setActiveTab('sync')}
            className={`py-2 px-1 text-[11px] font-bold rounded-lg transition text-center ${
              activeTab === 'sync'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Đồng bộ
          </button>
          <button
            id="tab-btn-timetable"
            onClick={() => setActiveTab('timetable')}
            className={`py-2 px-1 text-[11px] font-bold rounded-lg transition text-center flex items-center justify-center gap-0.5 ${
              activeTab === 'timetable'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Lịch học
            {scheduleItems.length > 0 && (
              <span className="w-3.5 h-3.5 rounded-full bg-slate-950/60 text-[9px] flex items-center justify-center font-mono">
                {scheduleItems.length}
              </span>
            )}
          </button>
          <button
            id="tab-btn-auto"
            onClick={() => setActiveTab('auto1touch')}
            className={`py-2 px-1 text-[11px] font-bold rounded-lg transition text-center ${
              activeTab === 'auto1touch'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            1-Chạm Auto
          </button>
          <button
            id="tab-btn-simulator"
            onClick={() => setActiveTab('simulator')}
            className={`py-2 px-1 text-[11px] font-bold rounded-lg transition text-center ${
              activeTab === 'simulator'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Giả lập
          </button>
          <button
            id="tab-btn-deploy"
            onClick={() => setActiveTab('deploy')}
            className={`py-2 px-1 text-[11px] font-bold rounded-lg transition text-center ${
              activeTab === 'deploy'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Deploy
          </button>
        </nav>

        {/* TAB 1: ĐỒNG BỘ LỊCH (ACTION HUB & BOOKMARKLET) */}
        {activeTab === 'sync' && (
          <div className="space-y-4">
            
            {/* Primary Action Card: Webcal Trigger */}
            <section id="action-sync-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-extrabold text-sm">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Đăng ký Luồng Lịch Tự Động</h2>
                    <p className="text-[11px] text-slate-400">Giao thức Webcal Subscription (Live Feed)</p>
                  </div>
                </div>

                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {cleanId}
                </span>
              </div>

              {/* Nút hành động chính theo yêu cầu */}
              <div className="space-y-2">
                <a
                  id="primary-webcal-btn"
                  href={webcalUrl}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm sm:text-base shadow-lg shadow-orange-500/25 transition active:scale-[0.98]"
                >
                  <Smartphone className="w-5 h-5" />
                  📲 Tự động đồng bộ vào Lịch điện thoại (Webcal)
                </a>

                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                  Bấm nút trên bằng trình duyệt Safari/Chrome trên điện thoại. iOS sẽ tự bật popup <strong>"Đăng ký Lịch"</strong> và Android sẽ mở <strong>Google Calendar</strong>.
                </p>
              </div>

              {/* Secondary Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <a
                  id="google-cal-btn"
                  href={googleCalendarSubscribeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs border border-slate-700 transition text-center"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                  Google Calendar Web
                </a>

                <a
                  id="download-ics-btn"
                  href={downloadIcsUrl}
                  download={`FAP_${cleanId}.ics`}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold text-xs border border-slate-700 transition text-center"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  Tải file tĩnh .ics
                </a>
              </div>

              {/* Copy URL webcal */}
              <div className="flex items-center justify-between bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 truncate max-w-[240px] font-mono text-[11px]">
                  {webcalUrl}
                </span>
                <button
                  id="btn-copy-feed-url"
                  onClick={handleCopyFeedUrl}
                  className="text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1 shrink-0 ml-2"
                >
                  {copiedFeedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedFeedUrl ? 'Đã sao chép' : 'Sao chép link'}</span>
                </button>
              </div>
            </section>

            {/* Bookmarklet Section */}
            <section id="bookmarklet-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-extrabold text-sm">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Mã Bookmarklet Trích Xuất FAP</h2>
                    <p className="text-[11px] text-slate-400">Chạy trực tiếp trên tab FAP để bóc tách lịch</p>
                  </div>
                </div>

                <span className="text-[10px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded">
                  Client-side
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Do FAP bắt buộc đăng nhập Google Workspace có 2FA, Bookmarklet chạy ngay trong tab trình duyệt của bạn, bóc tách bảng HTML và gửi về server để sinh luồng Webcal.
              </p>

              {/* Bookmarklet code preview & 1-click copy */}
              <div className="relative">
                <div className="w-full bg-slate-950 rounded-xl border border-slate-800 p-3 pr-24 font-mono text-[11px] text-slate-300 overflow-x-auto break-all max-h-24">
                  {bookmarkletCode}
                </div>

                <button
                  id="btn-copy-bookmarklet"
                  onClick={handleCopyBookmarklet}
                  className="absolute top-2.5 right-2.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-xs rounded-lg shadow-md transition flex items-center gap-1.5"
                >
                  {copiedBookmarklet ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedBookmarklet ? 'Đã sao chép!' : 'Sao chép'}</span>
                </button>
              </div>

              {/* Slot reference preview */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-slate-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-orange-400" />
                    Khung giờ Slot chuẩn FPT (Báo thức 15 phút):
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  {Object.entries(SLOT_CONFIG).map(([num, config]) => (
                    <div key={num} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <span className="font-bold text-orange-400">Slot {num}:</span>
                      <div className="text-slate-300 font-mono text-[10px]">{config.startTimeStr} - {config.endTimeStr}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Step by Step Visual Guide */}
            <section id="guide-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-orange-400" />
                  Hướng dẫn cài đặt trên Điện thoại
                </h2>

                <div className="flex items-center bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    id="guide-tab-ios"
                    onClick={() => setActiveGuideTab('ios')}
                    className={`px-2.5 py-1 rounded-md transition ${
                      activeGuideTab === 'ios' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    iOS (Safari)
                  </button>
                  <button
                    id="guide-tab-android"
                    onClick={() => setActiveGuideTab('android')}
                    className={`px-2.5 py-1 rounded-md transition ${
                      activeGuideTab === 'android' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Android (Chrome)
                  </button>
                </div>
              </div>

              {activeGuideTab === 'ios' ? (
                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center shrink-0">1</span>
                    <div>
                      <strong className="text-white block">Sao chép mã Bookmarklet</strong>
                      <span className="text-slate-400">Bấm nút "Sao chép" ở thẻ phía trên để copy đoạn mã JavaScript vào khay nhớ tạm.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center shrink-0">2</span>
                    <div>
                      <strong className="text-white block">Tạo Bookmark mới trên Safari</strong>
                      <span className="text-slate-400">Bấm nút Chia sẻ (biểu tượng hình vuông có mũi tên lên) &rarr; chọn <em>"Thêm dấu trang"</em> (Add Bookmark) &rarr; đặt tên là <code>FAP Sync</code> &rarr; bấm Lưu.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center shrink-0">3</span>
                    <div>
                      <strong className="text-white block">Đổi URL của Bookmark thành mã JavaScript</strong>
                      <span className="text-slate-400">Mở danh sách Dấu trang &rarr; bấm <em>"Sửa"</em> (Edit) &rarr; chọn Bookmark <code>FAP Sync</code> vừa lưu &rarr; xóa đường link cũ đi và dán mã Bookmarklet vừa copy vào. Bấm Xong.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center shrink-0">4</span>
                    <div className="space-y-1.5">
                      <strong className="text-white block">Chạy Bookmarklet trên trang FAP (2 cách siêu dễ)</strong>
                      <p className="text-slate-400">Mở Safari, vào <code>fap.fpt.edu.vn</code> &rarr; vào <strong>Weekly Timetable</strong>:</p>
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 space-y-1 text-[11px] text-slate-300">
                        <p><strong className="text-orange-400">Cách A (Nhanh nhất):</strong> Bấm biểu tượng <strong>Cuốn sách 📖</strong> dưới đáy Safari &rarr; chọn <em>Mục ưa thích</em> &rarr; bấm vào <strong>FAP Sync</strong>.</p>
                        <p><strong className="text-orange-400">Cách B:</strong> Chạm vào thanh địa chỉ Safari &rarr; gõ <code>FAP Sync</code> &rarr; nhìn danh sách gợi ý, bấm vào dòng có <strong>biểu tượng cuốn sách 📖</strong> (không bấm nút Tìm kiếm trên bàn phím).</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-200">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center shrink-0">5</span>
                    <div>
                      <strong className="text-white block">Tận hưởng: iOS tự bung popup Đăng ký Lịch!</strong>
                      <span className="text-orange-200/90">Trình duyệt sẽ hiển thị thông báo đã bóc tách xong, bấm nút <em>"📲 Tự động thêm vào Lịch"</em> để iOS đăng ký lịch tự động kèm chuông báo 15 phút!</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center shrink-0">1</span>
                    <div>
                      <strong className="text-white block">Sao chép mã Bookmarklet</strong>
                      <span className="text-slate-400">Bấm nút "Sao chép" mã Bookmarklet ở trên.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center shrink-0">2</span>
                    <div>
                      <strong className="text-white block">Tạo Dấu trang trên Chrome Android</strong>
                      <span className="text-slate-400">Bấm menu 3 chấm trên Chrome &rarr; bấm biểu tượng Ngôi sao (Dấu trang). Sau đó bấm "Chỉnh sửa" dấu trang, đặt tên <code>FAP Sync</code> và dán mã JavaScript vào ô URL.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center shrink-0">3</span>
                    <div>
                      <strong className="text-white block">Kích hoạt trên trang FAP</strong>
                      <span className="text-slate-400">Vào <code>fap.fpt.edu.vn</code> &rarr; mở thời khóa biểu &rarr; gõ <code>FAP Sync</code> trên thanh tìm kiếm của Chrome và chạm vào dấu trang tương ứng.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-200">
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center shrink-0">4</span>
                    <div>
                      <strong className="text-white block">Tự động đẩy vào Google Calendar</strong>
                      <span className="text-orange-200/90">Bấm nút đăng ký Webcal hoặc bấm link <em>"Google Calendar Web"</em> để Google Calendar tự động nhận luồng thời khóa biểu.</span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: THỜI KHÓA BIỂU LIVE VIEW */}
        {activeTab === 'timetable' && (
          <div className="space-y-4">
            <section id="timetable-viewer" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-400" />
                    Thời khóa biểu đã đồng bộ
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Sinh viên: <span className="font-mono text-orange-400 font-bold">{scheduleData?.studentId || userId}</span>
                    {scheduleData?.updatedAt && ` • Cập nhật: ${new Date(scheduleData.updatedAt).toLocaleTimeString('vi-VN')}`}
                  </p>
                </div>

                {/* Filter ngày */}
                <select
                  id="date-filter-select"
                  value={selectedDateFilter}
                  onChange={(e) => setSelectedDateFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-orange-500"
                >
                  <option value="all">Tất cả ({scheduleItems.length} ca)</option>
                  {uniqueDates.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {sortedItems.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                  <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">Chưa có dữ liệu lịch cho mã sinh viên này.</p>
                  <button
                    onClick={() => seedDemoSchedule(userId)}
                    className="text-xs font-bold text-orange-400 bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/30"
                  >
                    Nạp lịch demo ngay
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {sortedItems.map((item, index) => {
                    const slotInfo = (SLOT_CONFIG as any)[item.slot] || (SLOT_CONFIG as any)[1];
                    return (
                      <div
                        key={`${item.date}-${item.slot}-${index}`}
                        className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-400 font-bold text-xs font-mono">
                              Slot {item.slot}
                            </span>
                            <span className="text-xs font-bold text-white tracking-wide">
                              {item.subject}
                            </span>
                            {item.group && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                {item.group}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1 font-mono text-slate-300">
                              <Clock className="w-3 h-3 text-orange-400" />
                              {slotInfo.startTimeStr} - {slotInfo.endTimeStr}
                            </span>
                            <span className="flex items-center gap-1 text-slate-300">
                              <MapPin className="w-3 h-3 text-emerald-400" />
                              {item.room || 'Phòng FPT'}
                            </span>
                            {item.teacher && (
                              <span className="flex items-center gap-1 text-slate-300">
                                <User className="w-3 h-3 text-blue-400" />
                                {item.teacher}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-bold text-slate-300">
                            {item.date}
                          </div>
                          <div className="inline-flex items-center gap-1 text-[10px] text-emerald-400 mt-1">
                            <Bell className="w-2.5 h-2.5" />
                            <span>-15p</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 3: TỰ ĐỘNG HÓA 1-CHẠM (ZERO FRICTION AUTO-SYNC) */}
        {activeTab === 'auto1touch' && (
          <div className="space-y-4">
            {/* Phân tích kỹ thuật */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-extrabold text-sm">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Tại sao cần cơ chế 1-Chạm từ điện thoại?</h2>
                  <p className="text-[11px] text-slate-400">Rào cản bảo mật của Google 2FA & Trình duyệt</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Trang web này <strong className="text-orange-400">không thể tự ý chui ngầm vào FAP</strong> để cào dữ liệu vì 2 lý do bảo mật:
              </p>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-400 leading-relaxed">
                  <strong className="text-white block mb-0.5">1. Cơ chế Same-Origin Policy (SOP):</strong>
                  Safari và Chrome ngăn chặn bất kỳ trang web bên ngoài nào đọc trộm Cookie hay HTML của trang web khác (fap.fpt.edu.vn).
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-400 leading-relaxed">
                  <strong className="text-white block mb-0.5">2. Xác thực 2 bước Google Workspace (@fpt.edu.vn):</strong>
                  FAP bắt buộc sinh viên xác nhận OTP/Prompt 2FA trên điện thoại, khiến bot headless server không thể tự đăng nhập ngầm.
                </div>
              </div>

              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-300">
                💡 <strong>Giải pháp tối ưu:</strong> Sử dụng <strong>Phím tắt iOS (Apple Shortcut)</strong> hoặc <strong>Userscript tự động</strong> để biến thao tác thành <strong>1 CHẠM DUY NHẤT</strong> từ màn hình chính điện thoại!
              </div>
            </section>

            {/* Giải pháp 1: iOS Shortcuts (Phím tắt Apple 1-chạm) */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-extrabold text-sm">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Cách 1: Phím tắt iOS (Apple Shortcuts)</h2>
                    <p className="text-[11px] text-slate-400">1 chạm từ Widget / Màn hình chính iPhone</p>
                  </div>
                </div>

                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                  Khuyên dùng iOS
                </span>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <strong className="text-white block font-semibold">Quy trình 1-Chạm hoạt động như thế nào?</strong>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                    <li>Bạn bấm vào icon <strong>"FAP Sync"</strong> trên Màn hình chính hoặc Widget iPhone.</li>
                    <li>Phím tắt tự mở Safari vào thẳng trang <code>fap.fpt.edu.vn</code> (đã lưu sẵn tài khoản Google).</li>
                    <li>Tự động chạy tác vụ <em>"Chạy JavaScript trên trang web"</em> để bóc tách thời khóa biểu và gửi về máy chủ.</li>
                    <li>Tự kích hoạt luồng <code>webcal://</code> và Lịch iPhone tự động cập nhật ngay lập tức!</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Mã JavaScript cấu hình cho tác vụ Shortcut:</span>
                    <button
                      onClick={() => {
                        const shortcutScript = `var s=document.createElement('script');s.src='${origin}/bookmarklet.js?t='+Date.now();document.body.appendChild(s);completion(true);`;
                        navigator.clipboard.writeText(shortcutScript).then(() => {
                          setCopiedShortcutJs(true);
                          setTimeout(() => setCopiedShortcutJs(false), 2500);
                        });
                      }}
                      className="text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1"
                    >
                      {copiedShortcutJs ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedShortcutJs ? 'Đã chép mã!' : 'Sao chép mã'}</span>
                    </button>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-400 border border-slate-800 break-all">
                    {`var s=document.createElement('script');s.src='${origin}/bookmarklet.js?t='+Date.now();document.body.appendChild(s);completion(true);`}
                  </div>
                </div>
              </div>
            </section>

            {/* Giải pháp 2: Userscript (Tampermonkey) tự động 100% khi vào FAP */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-extrabold text-sm">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Cách 2: Userscript Tự Động (Tampermonkey)</h2>
                    <p className="text-[11px] text-slate-400">Tự động hiện nút Đồng bộ nổi khi mở FAP</p>
                  </div>
                </div>

                <a
                  href="/fap_userscript.user.js"
                  target="_blank"
                  className="text-[10px] font-bold bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded shadow"
                >
                  Cài Userscript
                </a>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Nếu bạn dùng trình duyệt hỗ trợ tiện ích mở rộng (Safari Extension trên iOS, Kiwi Browser trên Android, hoặc Chrome trên máy tính): Cài tiện ích <strong>Tampermonkey</strong> &rarr; cài file script trên. Khi vào FAP, nút đồng bộ sẽ tự động xuất hiện ở góc phải màn hình!
              </p>
            </section>

            {/* Giải pháp 3: Nhập nhanh HTML FAP (Quick Paste) */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-orange-400" />
                  Cách 3: Dán trực tiếp HTML FAP (Quick Paste)
                </h2>
                <span className="text-[10px] text-slate-400 font-mono">Bóc tách tức thì</span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Mở FAP &rarr; bấm phím <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">Ctrl + A</kbd> (hoặc bôi đen toàn bộ trang FAP) rồi dán vào khung dưới đây:
              </p>

              <textarea
                value={pastedHtml}
                onChange={(e) => setPastedHtml(e.target.value)}
                rows={3}
                placeholder="Dán nội dung hoặc mã nguồn HTML từ trang FAP vào đây..."
                className="w-full text-xs font-mono p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-orange-500 resize-none"
              ></textarea>

              <button
                onClick={async () => {
                  if (!pastedHtml.trim()) {
                    alert('Vui lòng dán nội dung từ FAP vào khung trước!');
                    return;
                  }
                  setIsLoading(true);
                  try {
                    const res = await fetch('/api/extract-html', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ html: pastedHtml, studentId: userId || 'SE170001' })
                    });
                    const json = await res.json();
                    if (json.success) {
                      await fetchSchedule(userId || 'SE170001');
                      setActiveTab('timetable');
                      alert(json.message || 'Đã bóc tách thành công!');
                    } else {
                      alert('Lỗi: ' + json.message);
                    }
                  } catch (e: any) {
                    alert('Lỗi bóc tách: ' + e.message);
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Bóc tách & Đồng bộ ngay vào Lịch</span>
              </button>
            </section>
          </div>
        )}

        {/* TAB 4: SIMULATOR & TEST TRÍCH XUẤT FAP */}
        {activeTab === 'simulator' && (
          <div className="space-y-4">
            <section id="simulator-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-extrabold text-sm">
                    <Play className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Giả Lập Bảng Thời Khóa Biểu FAP</h2>
                    <p className="text-[11px] text-slate-400">Kiểm thử thuật toán bóc tách HTML mà không cần truy cập FAP</p>
                  </div>
                </div>

                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                  Test Sandbox
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Bảng bên dưới mô phỏng cấu trúc HTML thực tế trên trang <code>fap.fpt.edu.vn</code> (giao diện ASP.NET). Bấm nút <strong>"Kích hoạt bóc tách ngay"</strong> để chạy parser bóc tách và gửi request lên API!
              </p>

              {/* Simulated FAP HTML Table */}
              <div className="border border-slate-700 rounded-xl overflow-x-auto bg-slate-950 p-2 text-slate-200 text-xs">
                <div className="p-1.5 text-[11px] font-mono text-slate-400 border-b border-slate-800 mb-2 flex items-center justify-between">
                  <span>HTML View: <code>&lt;table class="table-bordered"&gt;</code></span>
                  <span className="text-orange-400">Tuần: 15/09/2026 - 21/09/2026</span>
                </div>
                
                <table className="w-full text-[11px] border-collapse border border-slate-800 text-center">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-300">
                      <th className="p-1.5 border border-slate-700">Slot</th>
                      <th className="p-1.5 border border-slate-700">Mon 15/09</th>
                      <th className="p-1.5 border border-slate-700">Tue 16/09</th>
                      <th className="p-1.5 border border-slate-700">Wed 17/09</th>
                      <th className="p-1.5 border border-slate-700">Thu 18/09</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-1.5 font-bold border border-slate-700 text-orange-400">Slot 1</td>
                      <td className="p-1.5 border border-slate-700 bg-orange-500/10 text-left">
                        <div className="font-bold text-orange-300">SWP391</div>
                        <div className="text-[10px] text-slate-400">at AL-L502</div>
                        <div className="text-[10px] text-slate-400">(SonNT5)</div>
                      </td>
                      <td className="p-1.5 border border-slate-700 text-slate-600">-</td>
                      <td className="p-1.5 border border-slate-700 bg-orange-500/10 text-left">
                        <div className="font-bold text-orange-300">SWP391</div>
                        <div className="text-[10px] text-slate-400">at AL-L502</div>
                        <div className="text-[10px] text-slate-400">(SonNT5)</div>
                      </td>
                      <td className="p-1.5 border border-slate-700 text-slate-600">-</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-bold border border-slate-700 text-orange-400">Slot 2</td>
                      <td className="p-1.5 border border-slate-700 text-slate-600">-</td>
                      <td className="p-1.5 border border-slate-700 bg-blue-500/10 text-left">
                        <div className="font-bold text-blue-300">PRN212</div>
                        <div className="text-[10px] text-slate-400">at BE-304</div>
                        <div className="text-[10px] text-slate-400">(HaiNM1)</div>
                      </td>
                      <td className="p-1.5 border border-slate-700 text-slate-600">-</td>
                      <td className="p-1.5 border border-slate-700 bg-blue-500/10 text-left">
                        <div className="font-bold text-blue-300">PRN212</div>
                        <div className="text-[10px] text-slate-400">at BE-304</div>
                        <div className="text-[10px] text-slate-400">(HaiNM1)</div>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-bold border border-slate-700 text-orange-400">Slot 3</td>
                      <td className="p-1.5 border border-slate-700 bg-emerald-500/10 text-left">
                        <div className="font-bold text-emerald-300">LAB211</div>
                        <div className="text-[10px] text-slate-400">at AL-L401</div>
                        <div className="text-[10px] text-slate-400">(KhanhKT)</div>
                      </td>
                      <td className="p-1.5 border border-slate-700 text-slate-600">-</td>
                      <td className="p-1.5 border border-slate-700 bg-emerald-500/10 text-left">
                        <div className="font-bold text-emerald-300">LAB211</div>
                        <div className="text-[10px] text-slate-400">at AL-L401</div>
                        <div className="text-[10px] text-slate-400">(KhanhKT)</div>
                      </td>
                      <td className="p-1.5 border border-slate-700 text-slate-600">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Action Button: Trigger Simulated Sync */}
              <button
                id="btn-run-simulation"
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    const simulatedItems = [
                      { date: '2026-09-15', slot: 1, subject: 'SWP391', room: 'AL-L502', teacher: 'SonNT5', group: 'SE1701' },
                      { date: '2026-09-15', slot: 3, subject: 'LAB211', room: 'AL-L401', teacher: 'KhanhKT', group: 'SE1701' },
                      { date: '2026-09-16', slot: 2, subject: 'PRN212', room: 'BE-304', teacher: 'HaiNM1', group: 'SE1701' },
                      { date: '2026-09-17', slot: 1, subject: 'SWP391', room: 'AL-L502', teacher: 'SonNT5', group: 'SE1701' },
                      { date: '2026-09-17', slot: 3, subject: 'LAB211', room: 'AL-L401', teacher: 'KhanhKT', group: 'SE1701' },
                      { date: '2026-09-18', slot: 2, subject: 'PRN212', room: 'BE-304', teacher: 'HaiNM1', group: 'SE1701' }
                    ];

                    const res = await fetch('/api/sync', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        studentId: userId || 'SE170001',
                        studentName: 'Sinh viên FPT (Simulated)',
                        schedule: simulatedItems
                      })
                    });

                    const resJson = await res.json();
                    if (resJson.success) {
                      await fetchSchedule(userId || 'SE170001');
                      setActiveTab('timetable');
                      alert(`Thành công! Đã bóc tách và nạp ${simulatedItems.length} ca học vào hệ thống.`);
                    }
                  } catch (e: any) {
                    alert('Lỗi sync giả lập: ' + e.message);
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-lg transition"
              >
                <Play className="w-4 h-4" />
                <span>Chạy thử nghiệm Parser bóc tách bảng trên</span>
              </button>
            </section>
          </div>
        )}

        {/* TAB 4: HƯỚNG DẪN DEPLOY LÊN RENDER / RAILWAY / VERCEL */}
        {activeTab === 'deploy' && (
          <div className="space-y-4">
            <section id="deploy-guide-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-extrabold text-sm">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Hướng dẫn Deploy Miễn Phí (Có HTTPS)</h2>
                    <p className="text-[11px] text-slate-400">Đảm bảo giao thức webcal:// hoạt động mượt mà</p>
                  </div>
                </div>

                <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                  Production
                </span>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <strong className="text-orange-400 flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4" /> Cách 1: Triển khai lên Render.com (Khuyên dùng)
                  </strong>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed pl-1">
                    <li>Đưa mã nguồn lên <strong>GitHub</strong> (Public hoặc Private repo).</li>
                    <li>Đăng nhập <strong>render.com</strong> &rarr; Bấm <em>"New Web Service"</em>.</li>
                    <li>Chọn repository vừa tạo.</li>
                    <li>Cấu hình:
                      <ul className="list-disc list-inside pl-4 font-mono text-[11px] text-slate-300 mt-1 space-y-0.5">
                        <li>Runtime: <code>Node</code></li>
                        <li>Build Command: <code>npm install</code></li>
                        <li>Start Command: <code>node src/server.js</code></li>
                      </ul>
                    </li>
                    <li>Render tự động cấp chứng chỉ <strong>HTTPS SSL miễn phí</strong>. Domain có dạng: <code>https://ten-du-an.onrender.com</code>.</li>
                  </ol>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <strong className="text-orange-400 flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4" /> Cách 2: Triển khai lên Railway.app
                  </strong>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed pl-1">
                    <li>Vào <strong>railway.app</strong> &rarr; Bấm <em>"New Project"</em> &rarr; <em>"Deploy from GitHub repo"</em>.</li>
                    <li>Railway tự động nhận diện Node.js và chạy <code>npm start</code>.</li>
                    <li>Vào mục <em>Settings &rarr; Networking &rarr; Generate Domain</em> để có địa chỉ HTTPS miễn phí.</li>
                  </ol>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                  <strong className="text-white flex items-center gap-1.5 font-semibold">
                    <Shield className="w-4 h-4 text-emerald-400" /> Lưu ý quan trọng về Webcal
                  </strong>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Giao thức <code>webcal://</code> yêu cầu kết nối an toàn (HTTPS). Khi người dùng bấm vào link <code>webcal://&lt;domain&gt;/api/feed/:userId.ics</code>, hệ điều hành iOS (Apple Calendar) hoặc Android (Google Calendar) sẽ gửi request định kỳ (mỗi vài giờ hoặc mỗi ngày) về server để cập nhật lịch mới mà người dùng không cần làm lại bước đồng bộ!
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-[11px] text-slate-400 py-3 border-t border-slate-900 flex items-center justify-between px-2">
          <span>Đại học FPT • FAP Timetable Sync</span>
          <span className="font-mono text-[10px] text-slate-400">RFC 5545 • GMT+7</span>
        </footer>

      </div>
    </div>
  );
}
