// ==UserScript==
// @name         FAP FPT Auto Calendar Sync
// @namespace    https://fap.fpt.edu.vn/
// @version      2.0
// @description  Tự động hiển thị nút Đồng bộ Lịch 1-Chạm khi vào trang Thời khóa biểu FAP Đại học FPT
// @author       FPT Student
// @match        https://fap.fpt.edu.vn/*
// @match        http://fap.fpt.edu.vn/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  function initAutoSyncButton() {
    // Chỉ kích hoạt nếu có bảng lịch học
    const tables = document.querySelectorAll('table');
    if (tables.length === 0) return;

    // Tránh thêm nút lặp lại
    if (document.getElementById('fap-auto-sync-float-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'fap-auto-sync-float-btn';
    btn.innerHTML = '📅 ĐỒNG BỘ LỊCH VÀO ĐIỆN THOẠI (1-CHẠM)';
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: linear-gradient(135deg, #f97316, #ea580c);
      color: #ffffff;
      font-weight: 800;
      font-size: 14px;
      padding: 14px 22px;
      border-radius: 50px;
      border: 2px solid #ffffff;
      box-shadow: 0 10px 25px rgba(249, 115, 22, 0.45);
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: all 0.2s ease;
      animation: fapPulse 2s infinite;
    `;

    btn.addEventListener('click', function() {
      btn.innerText = '⏳ Đang bóc tách và đồng bộ...';
      btn.disabled = true;

      // Nạp script bookmarklet động
      const script = document.createElement('script');
      script.src = window.FAP_SYNC_BACKEND_URL 
        ? `${window.FAP_SYNC_BACKEND_URL}/bookmarklet.js?t=${Date.now()}`
        : `https://${window.location.host}/bookmarklet.js?t=${Date.now()}`;
      
      script.onload = () => {
        btn.innerText = '✓ Đã đồng bộ thành công!';
        setTimeout(() => {
          btn.innerHTML = '📅 ĐỒNG BỘ LỊCH VÀO ĐIỆN THOẠI';
          btn.disabled = false;
        }, 3000);
      };

      document.body.appendChild(script);
    });

    document.body.appendChild(btn);
  }

  // Khởi chạy khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoSyncButton);
  } else {
    initAutoSyncButton();
  }
})();
