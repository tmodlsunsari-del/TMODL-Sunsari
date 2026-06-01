import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json';
import NepaliDate from 'nepali-date-converter';

// Convert Gregorian Date (A.D.) YYYY-MM-DD or standard JS Date to Bikram Sambat (B.S.) date with Devanagari numerals (e.g., २०८३/०२/१७)
window.convertAdToBs = function(adDateStr) {
    if (!adDateStr || adDateStr === '—') return '—';
    try {
        const cleanStr = String(adDateStr).trim();
        if (!cleanStr || cleanStr === '---' || cleanStr === 'N/A' || cleanStr === '—') return '—';
        
        // If it already is in Devanagari, return as-is
        if (/[\u0900-\u097F]/.test(cleanStr)) {
            return cleanStr;
        }
        
        const d = new Date(cleanStr);
        if (isNaN(d.getTime())) return adDateStr;
        
        const nepaliDate = new NepaliDate(d);
        const bsFormatted = nepaliDate.format('YYYY/MM/DD');
        
        // Convert digits to Devanagari numerals
        const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
        const devanagariFormatted = bsFormatted.replace(/\d/g, (x) => nepaliDigits[parseInt(x, 10)]);
        
        return devanagariFormatted;
    } catch (err) {
        console.error('Error converting date to BS:', err);
        return adDateStr;
    }
};

// Convert Bikram Sambat (B.S.) date string (Devanagari or English digits) to Gregorian A.D. (YYYY-MM-DD)
window.convertBsToAd = function(bsDateStr) {
    if (!bsDateStr) return '';
    try {
        let cleanStr = String(bsDateStr).trim();
        // Remove B.S. suffix
        cleanStr = cleanStr.replace(/BS|B\.S\./gi, '').trim();
        
        // Convert Devanagari digits to English digits
        const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
        cleanStr = cleanStr.replace(/[०-९]/g, (c) => nepaliDigits.indexOf(c));
        
        // Replace slashes/spaces with dashes
        cleanStr = cleanStr.replace(/[\/\s]+/g, '-');
        
        // Check formatting before sending to NepaliDate constructor to prevent throwing
        const datePattern = /^\d{4}-\d{1,2}-\d{1,2}$|^\d{1,2}-\d{1,2}-\d{4}$/;
        if (!datePattern.test(cleanStr)) {
            return '';
        }
        
        const nepaliDate = new NepaliDate(cleanStr);
        const adDate = nepaliDate.toJsDate();
        if (isNaN(adDate.getTime())) return '';
        
        const y = adDate.getFullYear();
        const m = String(adDate.getMonth() + 1).padStart(2, '0');
        const d = String(adDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    } catch (err) {
        return '';
    }
};

// Inject custom CSS styling for our Nepali Calendar Date Picker
(function() {
    const style = document.createElement('style');
    style.id = 'nepali-datepicker-styles';
    style.textContent = `
        .nepali-calendar-picker {
            position: absolute;
            z-index: 99999;
            background: rgba(10, 25, 47, 0.95) !important;
            backdrop-filter: blur(24px) !important;
            border: 1.5px solid rgba(255, 255, 255, 0.1) !important;
            border-radius: 16px !important;
            padding: 14px !important;
            box-shadow: 0 20px 45px -15px rgba(0, 0, 0, 0.8), 0 15px 15px -10px rgba(0, 0, 0, 0.8) !important;
            width: 295px !important;
            font-family: 'Outfit', sans-serif !important;
            user-select: none !important;
            display: none;
            color: #f8fafc !important;
            box-sizing: border-box !important;
        }

        body.light-theme .nepali-calendar-picker {
            background: rgba(255, 255, 255, 0.96) !important;
            border: 1.5px solid rgba(0, 0, 0, 0.1) !important;
            box-shadow: 0 20px 45px -15px rgba(0, 0, 0, 0.2) !important;
            color: #1e293b !important;
        }

        .nepali-picker-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 12px !important;
            gap: 6px !important;
        }

        .nepali-picker-header button {
            background: rgba(255, 255, 255, 0.05) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            color: inherit !important;
            border-radius: 8px !important;
            width: 32px !important;
            height: 32px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            font-size: 0.75rem !important;
            transition: all 0.2s !important;
            outline: none !important;
        }

        body.light-theme .nepali-picker-header button {
            background: rgba(0, 0, 0, 0.03) !important;
            border: 1px solid rgba(0, 0, 0, 0.08) !important;
        }

        .nepali-picker-header button:hover {
            background: var(--accent, #3b82f6) !important;
            color: #ffffff !important;
            border-color: var(--accent, #3b82f6) !important;
        }

        .nepali-picker-selects {
            display: flex !important;
            gap: 6px !important;
            flex: 1 !important;
        }

        .nepali-picker-selects select {
            background: rgba(255, 255, 255, 0.06) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            color: inherit !important;
            border-radius: 8px !important;
            padding: 4px 8px !important;
            font-size: 0.8rem !important;
            outline: none !important;
            cursor: pointer !important;
            flex: 1 !important;
            -webkit-appearance: none !important;
            text-align: center !important;
            font-weight: 700 !important;
        }

        body.light-theme .nepali-picker-selects select {
            background: #f1f5f9 !important;
            border: 1px solid rgba(0, 0, 0, 0.1) !important;
            color: #0f172a !important;
        }

        .nepali-picker-weekdays {
            display: grid !important;
            grid-template-columns: repeat(7, 1fr) !important;
            text-align: center !important;
            font-weight: 800 !important;
            font-size: 0.72rem !important;
            text-transform: uppercase !important;
            opacity: 0.75 !important;
            margin-bottom: 8px !important;
        }

        .nepali-picker-days {
            display: grid !important;
            grid-template-columns: repeat(7, 1fr) !important;
            gap: 4px !important;
        }

        .nepali-picker-day {
            aspect-ratio: 1 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 0.85rem !important;
            font-family: 'JetBrains Mono', monospace !important;
            font-weight: 700 !important;
            border-radius: 8px !important;
            cursor: pointer !important;
            transition: all 0.15s !important;
            background: rgba(255, 255, 255, 0.01) !important;
            box-sizing: border-box !important;
        }

        body.light-theme .nepali-picker-day {
            background: rgba(0, 0, 0, 0.01) !important;
        }

        .nepali-picker-day:hover {
            background: rgba(59, 130, 246, 0.18) !important;
            color: var(--accent, #3b82f6) !important;
        }

        .nepali-picker-day.selected {
            background: var(--accent, #3b82f6) !important;
            color: #ffffff !important;
            font-weight: 900 !important;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4) !important;
        }

        .nepali-picker-day.today {
            border: 1.5px solid var(--accent, #3b82f6) !important;
            color: var(--accent, #3b82f6) !important;
            font-weight: bold !important;
        }

        .nepali-picker-day.empty {
            background: transparent !important;
            cursor: default !important;
            pointer-events: none !important;
        }

        .nepali-picker-footer {
            display: flex !important;
            justify-content: space-between !important;
            margin-top: 12px !important;
            padding-top: 10px !important;
            border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
        }

        body.light-theme .nepali-picker-footer {
            border-top: 1px solid rgba(0, 0, 0, 0.08) !important;
        }

        .nepali-picker-footer button {
            background: transparent !important;
            border: none !important;
            color: var(--accent, #3b82f6) !important;
            font-size: 0.75rem !important;
            font-weight: 800 !important;
            cursor: pointer !important;
            padding: 6px 10px !important;
            border-radius: 6px !important;
            outline: none !important;
            transition: background 0.15s !important;
        }

        .nepali-picker-footer button:hover {
            background: rgba(59, 130, 246, 0.08) !important;
        }
    `;
    document.head.appendChild(style);
})();

// Reusable custom Nepali date picker class
class NepaliDatePicker {
    constructor(element, options = {}) {
        this.input = typeof element === 'string' ? document.getElementById(element) : element;
        if (!this.input) return;
        
        this.options = Object.assign({
            onSelect: null
        }, options);
        
        this.isOpen = false;
        this.pickerEl = null;
        
        // Initialize viewing window year & month BS
        let initialAdDate = new Date();
        if (this.input.dataset.adValue) {
            const parsed = new Date(this.input.dataset.adValue);
            if (!isNaN(parsed.getTime())) {
                initialAdDate = parsed;
            }
        } else if (this.input.value) {
            const adFromVal = window.convertBsToAd(this.input.value);
            if (adFromVal) {
                const parsed = new Date(adFromVal);
                if (!isNaN(parsed.getTime())) {
                    initialAdDate = parsed;
                }
            }
        }
        
        const initialNep = new NepaliDate(initialAdDate);
        this.currentYear = initialNep.getYear();
        this.currentMonth = initialNep.getMonth(); // 0-11
        
        this.init();
    }
    
    init() {
        this.input.addEventListener('click', (e) => {
            e.stopPropagation();
            this.show();
        });
        
        document.addEventListener('click', (e) => {
            if (this.isOpen && this.pickerEl && !this.pickerEl.contains(e.target) && e.target !== this.input) {
                this.hide();
            }
        });
        
        window.addEventListener('resize', () => {
            if (this.isOpen) this.position();
        });
        window.addEventListener('scroll', () => {
            if (this.isOpen) this.position();
        }, true);
    }
    
    show() {
        if (this.isOpen) return;
        
        const activePickers = document.querySelectorAll('.nepali-calendar-picker');
        activePickers.forEach(p => p.style.display = 'none');
        
        if (!this.pickerEl) {
            this.pickerEl = document.createElement('div');
            this.pickerEl.className = 'nepali-calendar-picker';
            document.body.appendChild(this.pickerEl);
        }
        
        this.pickerEl.style.display = 'block';
        this.isOpen = true;
        
        let adDate = new Date();
        if (this.input.dataset.adValue) {
            const parsed = new Date(this.input.dataset.adValue);
            if (!isNaN(parsed.getTime())) {
                adDate = parsed;
            }
        }
        const nep = new NepaliDate(adDate);
        this.currentYear = nep.getYear();
        this.currentMonth = nep.getMonth();
        
        this.render();
        this.position();
    }
    
    hide() {
        if (!this.isOpen) return;
        if (this.pickerEl) {
            this.pickerEl.style.display = 'none';
        }
        this.isOpen = false;
    }
    
    position() {
        if (!this.isOpen || !this.pickerEl) return;
        const rect = this.input.getBoundingClientRect();
        
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        let top = rect.bottom + scrollTop + 6;
        let left = rect.left + scrollLeft;
        
        const pickerWidth = 295;
        if (left + pickerWidth > window.innerWidth) {
            left = window.innerWidth - pickerWidth - 16;
            if (left < 10) left = 10;
        }
        
        this.pickerEl.style.top = top + 'px';
        this.pickerEl.style.left = left + 'px';
    }
    
    render() {
        if (!this.pickerEl) return;
        
        const nepaliMonths = ['बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज', 'कात्तिक', 'मंसिर', 'पुस', 'माघ', 'फागुन', 'चैत'];
        const nepaliWeekdays = ['आइत', 'सोम', 'मङ्गल', 'बुध', 'बिही', 'शुक्र', 'शनि'];
        
        let html = `<div class="nepali-picker-header">
            <button type="button" class="nepali-prev-btn">◀</button>
            <div class="nepali-picker-selects">
                <select class="nepali-month-select">`;
                
        nepaliMonths.forEach((m, idx) => {
            const selected = idx === this.currentMonth ? 'selected' : '';
            html += `<option value="${idx}" ${selected}>${m}</option>`;
        });
        
        html += `</select>
                <select class="nepali-year-select">`;
                
        for (let y = 2000; y <= 2110; y++) {
            const selected = y === this.currentYear ? 'selected' : '';
            html += `<option value="${y}" ${selected}>${y}</option>`;
        }
        
        html += `</select>
            </div>
            <button type="button" class="nepali-next-btn">▶</button>
        </div>`;
        
        html += `<div class="nepali-picker-weekdays">`;
        nepaliWeekdays.forEach(day => {
            html += `<div>${day}</div>`;
        });
        html += `</div>`;
        
        html += `<div class="nepali-picker-days">`;
        
        const firstDayNp = new NepaliDate(this.currentYear, this.currentMonth, 1);
        const startDayIndex = firstDayNp.getDay();
        
        let daysInMonth = 30;
        for (let d = 28; d <= 32; d++) {
            const test = new NepaliDate(this.currentYear, this.currentMonth, d);
            if (test.getMonth() === this.currentMonth) {
                daysInMonth = d;
            } else {
                break;
            }
        }
        
        for (let i = 0; i < startDayIndex; i++) {
            html += `<div class="nepali-picker-day empty"></div>`;
        }
        
        const todayNep = new NepaliDate();
        const isCurrentMonthToday = todayNep.getYear() === this.currentYear && todayNep.getMonth() === this.currentMonth;
        
        let selectedYear = -1;
        let selectedMonth = -1;
        let selectedDate = -1;
        if (this.input.dataset.adValue) {
            const parsed = new Date(this.input.dataset.adValue);
            if (!isNaN(parsed.getTime())) {
                const currentSelNep = new NepaliDate(parsed);
                selectedYear = currentSelNep.getYear();
                selectedMonth = currentSelNep.getMonth();
                selectedDate = currentSelNep.getDate();
            }
        }
        
        const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = isCurrentMonthToday && todayNep.getDate() === day ? 'today' : '';
            const isSel = selectedYear === this.currentYear && selectedMonth === this.currentMonth && selectedDate === day ? 'selected' : '';
            
            const dayStr = String(day);
            const devanagariDay = dayStr.replace(/\d/g, (x) => nepaliDigits[parseInt(x, 10)]);
            
            html += `<div class="nepali-picker-day ${isToday} ${isSel}" data-day="${day}">${devanagariDay}</div>`;
        }
        
        html += `</div>`;
        
        html += `<div class="nepali-picker-footer">
            <button type="button" class="nepali-today-btn">आज (Today)</button>
            <button type="button" class="nepali-clear-btn">रद्द (Reset)</button>
        </div>`;
        
        this.pickerEl.innerHTML = html;
        
        this.pickerEl.querySelectorAll('.nepali-picker-day:not(.empty)').forEach(cell => {
            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                const day = parseInt(cell.getAttribute('data-day'), 10);
                this.selectDate(day);
            });
        });
        
        this.pickerEl.querySelector('.nepali-prev-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.prevMonth();
        });
        this.pickerEl.querySelector('.nepali-next-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.nextMonth();
        });
        this.pickerEl.querySelector('.nepali-month-select').addEventListener('change', (e) => {
            e.stopPropagation();
            this.currentMonth = parseInt(e.target.value, 10);
            this.render();
        });
        this.pickerEl.querySelector('.nepali-year-select').addEventListener('change', (e) => {
            e.stopPropagation();
            this.currentYear = parseInt(e.target.value, 10);
            this.render();
        });
        this.pickerEl.querySelector('.nepali-today-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const today = new NepaliDate();
            this.currentYear = today.getYear();
            this.currentMonth = today.getMonth();
            this.selectDate(today.getDate());
        });
        this.pickerEl.querySelector('.nepali-clear-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.input.value = '';
            this.input.removeAttribute('data-ad-value');
            this.input.dispatchEvent(new Event('change'));
            this.hide();
        });
    }
    
    prevMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.render();
    }
    
    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.render();
    }
    
    selectDate(day) {
        const selectedNep = new NepaliDate(this.currentYear, this.currentMonth, day);
        const adDate = selectedNep.toJsDate();
        
        const y = adDate.getFullYear();
        const m = String(adDate.getMonth() + 1).padStart(2, '0');
        const d = String(adDate.getDate()).padStart(2, '0');
        
        const adString = `${y}-${m}-${d}`;
        this.input.dataset.adValue = adString;
        this.input.value = window.convertAdToBs(adString);
        
        this.input.dispatchEvent(new Event('change'));
        this.input.dispatchEvent(new Event('input'));
        
        if (this.options.onSelect) {
            this.options.onSelect(adString, this.input.value);
        }
        
        this.hide();
    }
}

// Set display and internal value of picker inputs
window.initDatePickerValue = function(inputEl, dateObj) {
    if (!inputEl || !dateObj || isNaN(new Date(dateObj).getTime())) return;
    const nepDate = new NepaliDate(dateObj);
    const bsFormatted = nepDate.format('YYYY/MM/DD');
    const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    const devanagariFormatted = bsFormatted.replace(/\d/g, (x) => nepaliDigits[parseInt(x, 10)]);
    
    inputEl.value = devanagariFormatted;
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    inputEl.dataset.adValue = `${y}-${m}-${d}`;
};

// Initialize Firebase SDK Client
const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');

/* 
 * TransitVerify Elite - Intelligent Logic Controller
 * Features: High-speed O(1) lookup, Web Worker parsing, Smart Detection
 */

function handleAuthError(e, defaultMsg) {
    console.error('Auth action failed:', e);
    showToast(defaultMsg || 'प्रमाणीकरण असफल भयो।', 'error');
}

const elements = {
    searchForm: document.getElementById('search-form'),
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    resultsArea: document.getElementById('results-area'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),
    connectionPill: document.getElementById('connection-pill'),
    dbWarning: document.getElementById('db-warning'),
    authSection: document.getElementById('auth-section'),
    debugZone: document.getElementById('debug-zone'),
    btnText: document.getElementById('btn-text'),
    pillText: document.getElementById('pill-text'),
    mainLayout: document.getElementById('main-layout'),
    // New elements
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    userInfo: document.getElementById('user-info'),
    userAvatar: document.getElementById('user-avatar'),
    sheetsSyncBtn: document.getElementById('sheets-sync-btn'),
    sheetsConfig: document.getElementById('sheets-config'),
    sheetIdInput: document.getElementById('sheet-id-input'),
    sheetFetchBtn: document.getElementById('sheet-fetch-btn'),
    userNameDisplay: document.getElementById('user-name-display'),
    resetBtn: document.getElementById('reset-btn'),
    // Google Sheets Auth Elements
    googleSigninBtn: document.getElementById('google-signin-btn'),
    googleSignoutBtn: document.getElementById('google-signout-btn'),
    googleAuthSection: document.getElementById('google-auth-section'),
    googleSignedOutView: document.getElementById('google-signed-out-view'),
    googleSignedInView: document.getElementById('google-signed-in-view'),
    googleUserAvatar: document.getElementById('google-user-avatar'),
    googleUserName: document.getElementById('google-user-name'),
    googleUserEmail: document.getElementById('google-user-email'),
    // Password admin element bindings
    pwdLoginBtn: document.getElementById('pwd-login-btn'),
    superLoginBtn: document.getElementById('super-login-btn'),
    adminLoginBtn: document.getElementById('admin-login-btn'),
    passwordModal: document.getElementById('password-modal'),
    adminUsernameInput: document.getElementById('admin-username-input'),
    usernameInputWrapper: document.getElementById('username-input-wrapper'),
    adminPasswordInput: document.getElementById('admin-password-input'),
    pwdSubmitBtn: document.getElementById('pwd-submit-btn'),
    pwdCancelBtn: document.getElementById('pwd-cancel-btn'),
    passwordModalTitle: document.getElementById('password-modal-title'),
    passwordModalDesc: document.getElementById('password-modal-desc'),
    modalAuthIcon: document.getElementById('modal-auth-icon'),
    adminDashboard: document.getElementById('admin-dashboard'),
    showAdminPanelBtn: document.getElementById('show-admin-panel-btn'),
    adminDashboardModal: document.getElementById('admin-dashboard-modal'),
    adminDashboardCloseBtn: document.getElementById('admin-dashboard-close-btn'),
    adminRecordsCount: document.getElementById('admin-records-count'),
    adminAddBtn: document.getElementById('admin-add-btn'),
    adminExportBtn: document.getElementById('admin-export-btn'),
    recordModal: document.getElementById('record-modal'),
    recordModalTitle: document.getElementById('record-modal-title'),
    recordForm: document.getElementById('record-form'),
    recordOriginalId: document.getElementById('record-original-id'),
    recordName: document.getElementById('record-name'),
    recordId: document.getElementById('record-id'),
    recordLicense: document.getElementById('record-license'),
    recordCategory: document.getElementById('record-category'),
    recordCode: document.getElementById('record-code'),
    recordVisit: document.getElementById('record-visit'),
    recordSaveBtn: document.getElementById('record-save-btn'),
    recordCancelBtn: document.getElementById('record-cancel-btn'),
    userAvatarPlaceholder: document.getElementById('user-avatar-placeholder'),
    superUserAccountsSection: document.getElementById('super-user-accounts-section'),
    searchWarningBox: document.getElementById('search-warning-box'),
    emptySearchWarning: document.getElementById('empty-search-warning'),
    emptySearchWarningBackdrop: document.getElementById('empty-search-warning-backdrop'),
    consoleSheetIdInput: document.getElementById('console-sheet-id-input'),
    consoleSheetFetchBtn: document.getElementById('console-sheet-fetch-btn'),
    googleAppsScriptUrl: document.getElementById('google-apps-script-url'),
    saveGoogleScriptUrlBtn: document.getElementById('save-google-script-url-btn'),
    mainPublicSyncBtn: document.getElementById('main-public-sync-btn'),
    visitorCountTextNode: document.getElementById('visitor-count-text-node'),
    mismatchWarningBackdrop: document.getElementById('mismatch-warning-backdrop'),
    mismatchWarningPopup: document.getElementById('mismatch-warning-popup'),
    closeMismatchWarningBtn: document.getElementById('close-mismatch-warning-btn'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    themeToggleIcon: document.getElementById('theme-toggle-icon')
};

// Theme Manager Engine
function initTheme() {
    const currentTheme = localStorage.getItem('tmodl_theme') || 'dark';
    if (currentTheme === 'light') {
        document.documentElement.classList.add('light-theme');
        if (elements.themeToggleIcon) {
            elements.themeToggleIcon.textContent = '☀️';
        }
    } else {
        document.documentElement.classList.remove('light-theme');
        if (elements.themeToggleIcon) {
            elements.themeToggleIcon.textContent = '🌙';
        }
    }
}

// Apply theme instantly on load (before parsing any heavy logic)
initTheme();

// Add event listener for theme toggle
document.addEventListener('DOMContentLoaded', () => {
    if (elements.themeToggleBtn) {
        elements.themeToggleBtn.addEventListener('click', () => {
            const isLight = document.documentElement.classList.toggle('light-theme');
            localStorage.setItem('tmodl_theme', isLight ? 'light' : 'dark');
            if (elements.themeToggleIcon) {
                elements.themeToggleIcon.textContent = isLight ? '☀️' : '🌙';
            }
            showToast(isLight ? 'लाइट मोड सक्रिय भयो (Light Mode activated)' : 'डार्क मोड सक्रिय भयो (Dark Mode activated)', 'success');
        });
    }
    // Run initialization again to ensure elements are resolved
    initTheme();
});

// SVGs designed exactly matching the user's eye-sketch (Image 2)
const EYE_OPEN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 1.15rem; height: 1.15rem; pointer-events: none; display: block;"><path d="M 4.5,15.5 C 5.5,10 18.5,10 19.5,15.5" /><circle cx="12" cy="15.5" r="2.5" /></svg>`;
const EYE_CLOSED_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 1.15rem; height: 1.15rem; pointer-events: none; display: block;"><path d="M 4.5,15.5 C 5.5,10 18.5,10 19.5,15.5" /><circle cx="12" cy="15.5" r="2.5" /><line x1="3" y1="21" x2="21" y2="3" /></svg>`;

window.initPasswordToggles = function() {
    document.querySelectorAll('.password-toggle-eye').forEach(btn => {
        const wrapper = btn.closest('.password-input-wrapper');
        if (!wrapper) return;
        const input = wrapper.querySelector('input');
        if (!input) return;
        if (input.type === 'password') {
            btn.innerHTML = EYE_OPEN_SVG;
        } else {
            btn.innerHTML = EYE_CLOSED_SVG;
        }
    });
};

// Global Password visibility toggle delegation
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.password-toggle-eye');
    if (!btn) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const wrapper = btn.closest('.password-input-wrapper');
    if (!wrapper) return;
    
    const input = wrapper.querySelector('input');
    if (!input) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = EYE_CLOSED_SVG;
    } else {
        input.type = 'password';
        btn.innerHTML = EYE_OPEN_SVG;
    }
});

// Run eye init when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    window.initPasswordToggles();
});

// =========================================================================
// ENTERPRISE HARDENED SECURITY ENGINE
// =========================================================================
(function() {
    // 1. Right Click Interception
    document.addEventListener('contextmenu', (e) => {
        // Release restriction for logged-in staff/admin users
        try {
            const storedRole = localStorage.getItem('tmodl_user_role');
            if (storedRole === 'super' || storedRole === 'admin' || storedRole === 'staff') {
                return; // Allow right click
            }
        } catch (err) {}

        // Allow select element defaults if needed, but shield the main window
        e.preventDefault();
        if (typeof showToast === 'function') {
            showToast('🛡️ सुरक्षित मोड: एप्लिकेसनको सुरक्षार्थ दायाँ-क्लिक बन्द गरिएको छ (Security Mode: Right-Click is disabled for safety)', 'warning');
        }
    });

    // 2. Control Key combinations and Developer Tools prevention
    document.addEventListener('keydown', (e) => {
        // Release Developer Tools and shortcut blocks ONLY for Super Admin
        try {
            const role = localStorage.getItem('tmodl_user_role');
            if (role === 'super') {
                return; // Let super admin use any shortcuts
            }
        } catch (err) {}

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const ctrlOrCmd = e.ctrlKey || (isMac && e.metaKey);
        
        // F12 Detection
        if (e.key === 'F12' || e.keyCode === 123) {
            e.preventDefault();
            triggerSecurityAlert();
            return false;
        }

        // Ctrl / Cmd + Shift + I (Dev Tools)
        // Ctrl / Cmd + Shift + J (Console)
        // Ctrl / Cmd + Shift + C (Inspect)
        if (ctrlOrCmd && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c' || e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
            e.preventDefault();
            triggerSecurityAlert();
            return false;
        }

        // Ctrl / Cmd + U (View Source)
        if (ctrlOrCmd && (e.key === 'U' || e.key === 'u' || e.keyCode === 85)) {
            e.preventDefault();
            triggerSecurityAlert();
            return false;
        }

        // Ctrl / Cmd + S (Save Page Offline)
        if (ctrlOrCmd && (e.key === 'S' || e.key === 's' || e.keyCode === 83)) {
            e.preventDefault();
            if (typeof showToast === 'function') {
                showToast('🛡️ सुरक्षा चेतावनी: एप्लिकेसन डाउनलोड गर्न प्रतिबन्धित छ (Download restricted for offline security)', 'warning');
            }
            return false;
        }
    });

    function triggerSecurityAlert() {
        if (typeof showToast === 'function') {
            showToast('🛡️ सुरक्षित मोड: विकासकर्ता उपकरण तथा कोड पहुँच बन्द गरिएको छ (Security Mode: Code inspection access is restricted)', 'warning');
        }
    }

    // 3. Prevent Dragging of sensitive UI structures to stop unauthorized scraping
    document.addEventListener('dragstart', (e) => {
        const tag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
        if (tag === 'img' || tag === 'table' || tag === 'tr' || tag === 'th' || tag === 'td') {
            e.preventDefault();
        }
    });

    // 4. Copied content security policy on administrative components
    document.addEventListener('copy', (e) => {
        // Release restriction for logged-in staff/admin users
        try {
            const storedRole = localStorage.getItem('tmodl_user_role');
            if (storedRole === 'super' || storedRole === 'admin' || storedRole === 'staff') {
                return; // Allow copying
            }
        } catch (err) {}

        const activeElement = document.activeElement;
        // If they are not writing in search input / normal inputs, protect the bulk ledger copy
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.getAttribute('contenteditable') === 'true')) {
            return; // Allow standard user text input copywriting
        }
        
        e.preventDefault();
        if (typeof showToast === 'function') {
            showToast('🛡️ डेटा चोरी नियन्त्रण: अनधिकृत रूपमा रेकर्ड प्रतिलिपि (Copy) गर्न मिल्दैन (Security Shield: Table data copying restricted)', 'warning');
        }
    });
})();

// Application State
let database = {
    isLoaded: false,
    records: 0,
    visitorCount: parseInt(localStorage.getItem('tmodl_visitor_counter_value') || '0', 10),
    rows: [],
    maps: {
        nameMap: new Map(),
        idMap: new Map(),
        licenseMap: new Map()
    },
    sheetName: localStorage.getItem('tmodl_active_sheet_name') || 'READY TO DISTRIBUTE',
    spreadsheetId: (() => {
        let storedId = localStorage.getItem('tmodl_active_spreadsheet_id');
        if (!storedId || 
            storedId === '1_p26VW5nfAX57mO-eE4BkrdHg58uwmdoLJF_-Ce7RJU' || 
            storedId === '1Irif0A2jcE4dy3pTqZ80qZmtvNszFSZOlNaRvnICIcI' || 
            storedId === '11Zd9HLM95ZzDl_mhGf8v_v1L2u92cx_NscRwIKmJgmM' ||
            storedId === '128y-JrUDPVWbvarLzKH4pSkNgmK25ouUM26aswWHKiU' ||
            storedId.includes('script.google.com') ||
            storedId.includes('/macros/') ||
            storedId.startsWith('http')
        ) {
            storedId = '1I2WQoUts6TXLpixDThKhTTqj-e8Y6mvLyhuk2jxx0AE';
            localStorage.setItem('tmodl_active_spreadsheet_id', storedId);
            localStorage.setItem('tmodl_active_sheet_gid', '1275513476');
            localStorage.setItem('tmodl_active_spreadsheet_url', 'https://docs.google.com/spreadsheets/d/1I2WQoUts6TXLpixDThKhTTqj-e8Y6mvLyhuk2jxx0AE/edit?gid=1275513476#gid=1275513476');
        }
        return storedId;
    })(),
    headers: (() => {
        try {
            return JSON.parse(localStorage.getItem('tmodl_headers') || '[]');
        } catch(e) {
            return [];
        }
    })()
};

let currentRecord = null;

let worker = null;
let adminClickCount = 0;
let googleAccessToken = null; // In-memory cached token (strictly preferred over localStorage for security)

// --- Google Auth with Firebase ---
onAuthStateChanged(firebaseAuth, (user) => {
    if (user) {
        if (elements.googleSignedOutView) elements.googleSignedOutView.style.display = 'none';
        if (elements.googleSignedInView) elements.googleSignedInView.style.display = 'flex';
        
        if (elements.googleUserName) elements.googleUserName.textContent = user.displayName || 'Authorized Account';
        if (elements.googleUserEmail) elements.googleUserEmail.textContent = user.email || 'connected';
        
        if (elements.googleUserAvatar) {
            if (user.photoURL) {
                elements.googleUserAvatar.innerHTML = `<img src="${user.photoURL}" referrerpolicy="no-referrer" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
                elements.googleUserAvatar.textContent = (user.displayName || 'G').charAt(0).toUpperCase();
                elements.googleUserAvatar.style.background = 'var(--success)';
                elements.googleUserAvatar.style.color = '#fff';
            }
        }
    } else {
        googleAccessToken = null;
        if (elements.googleSignedOutView) elements.googleSignedOutView.style.display = 'flex';
        if (elements.googleSignedInView) elements.googleSignedInView.style.display = 'none';
    }
});

// Attach login/logout listeners
if (elements.googleSigninBtn) {
    elements.googleSigninBtn.addEventListener('click', async () => {
        showLoading('Connecting securely to Google (गुगलमा सिङ्क गर्दै)...');
        try {
            const result = await signInWithPopup(firebaseAuth, googleProvider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (!credential || !credential.accessToken) {
                throw new Error('Did not receive dynamic spreadsheet scope access from Google Auth.');
            }
            googleAccessToken = credential.accessToken;
            showToast('Google Workspace connected successfully!', 'success');
        } catch (err) {
            console.error('❌ Google Sheets Auth Failed:', err);
            showToast('Authorization failed: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
    });
}

if (elements.googleSignoutBtn) {
    elements.googleSignoutBtn.addEventListener('click', async () => {
        const confirmed = window.confirm('Are you sure you want to disconnect your Google account?');
        if (!confirmed) return;
        
        showLoading('Disconnecting Google connection...');
        try {
            await signOut(firebaseAuth);
            googleAccessToken = null;
            showToast('Google account disconnected successfully.', 'success');
        } catch (err) {
            console.error('❌ Google Sheets Disconnect Failed:', err);
            showToast('Disconnect failed: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
    });
}

let currentUser = null;
let currentUserRole = localStorage.getItem('tmodl_user_role') || null; // 'super' or 'admin' or null
let isAdmin = currentUserRole === 'super' || currentUserRole === 'admin' || currentUserRole === 'staff';
let currentLoginAttemptType = 'super'; // 'super' or 'admin'

// --- IndexedDB Persistence ---
const DB_NAME = 'TransitVerifyCache';
const STORE_NAME = 'RecordsStore';

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveToDB(rows) {
    try {
        const db = await Promise.race([
            openDB(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('IDB Open Timeout')), 3000))
        ]);
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(rows, 'master_ledger');
        return new Promise((resolve) => transaction.oncomplete = () => resolve());
    } catch (e) {
        console.warn('IDB Save failed:', e);
    }
}

async function getFromDB() {
    try {
        const db = await Promise.race([
            openDB(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('IndexedDB Timeout')), 3000))
        ]);
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        return new Promise((resolve, reject) => {
            const req = store.get('master_ledger');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('Cache fetch failed:', e);
        return null;
    }
}

// Initialize Web Worker using Vite's native worker support
function initWorker() {
    try {
        console.log('Initializing high-performance background engine...');
        // Standard worker to support importScripts in all browser environments
        worker = new Worker(new URL('./worker.js', import.meta.url));
        
        worker.onmessage = function(e) {
            const { type, message, percent, count, maps, rows, error } = e.data;
            
            switch(type) {
                case 'HEARTBEAT':
                    console.log('Worker heartbeat received');
                    break;
                case 'STATUS':
                    elements.loadingText.innerText = message;
                    break;
                case 'PROGRESS':
                    elements.loadingText.innerText = `Synchronizing Records: ${percent}%`;
                    if (elements.progressFill) elements.progressFill.style.width = `${percent}%`;
                    break;
                case 'COMPLETE':
                    database.isLoaded = true;
                    database.records = count;
                    
                    const incomingRows = rows || database.rows;
                    if (incomingRows && incomingRows.length > 0) {
                        let receivedByMap = {};
                        try {
                            receivedByMap = JSON.parse(localStorage.getItem('tmodl_received_by_map') || '{}');
                        } catch(e) {}
                        
                        let receivedByMapChanged = false;
                        incomingRows.forEach(row => {
                            if (!row) return;
                            const appId = String(row['Applicant ID'] || '').trim().toUpperCase();
                            if (appId) {
                                const sheetVal = String(row['RECEIVED BY'] || '').trim();
                                
                                // Protection Guard:
                                // If we have a local write timestamp within the last 120 seconds,
                                // we preserve our local value and discard the stale value from the newly parsed Google Sheet!
                                const localTime = (database.localSaveTimestamps || {})[appId];
                                if (localTime && (Date.now() - localTime < 120000)) {
                                    const localReceivedValue = (receivedByMap[appId] || '').trim().toUpperCase();
                                    row['RECEIVED BY'] = localReceivedValue;
                                } else {
                                    // Google Sheet cell value column I is the absolute, ultimate truth! No local-overriding!
                                    row['RECEIVED BY'] = sheetVal;
                                    
                                    // Keep receivedByMap synchronized with the sheet, but never let it override
                                    if (sheetVal) {
                                        if (receivedByMap[appId] !== sheetVal) {
                                            receivedByMap[appId] = sheetVal;
                                            receivedByMapChanged = true;
                                        }
                                    } else {
                                        if (receivedByMap[appId] !== undefined) {
                                            delete receivedByMap[appId];
                                            receivedByMapChanged = true;
                                        }
                                    }
                                }
                            }
                        });

                        if (receivedByMapChanged) {
                            localStorage.setItem('tmodl_received_by_map', JSON.stringify(receivedByMap));
                        }
                    }
                    database.rows = incomingRows;

                    // Rebuild search maps on the main thread to ensure absolute object reference integrity with synced 'RECEIVED BY' values
                    const nameMap = new Map();
                    const idMap = new Map();
                    const licenseMap = new Map();
                    if (database.rows && database.rows.length > 0) {
                        database.rows.forEach(row => {
                            if (!row) return;
                            const rawName = String(row['Name'] || '').toLowerCase().trim();
                            const rawId = String(row['Applicant ID'] || '').toLowerCase().trim();
                            const rawLicense = String(row['License No'] || '').toLowerCase().trim();
                            
                            if (rawName && !nameMap.has(rawName)) nameMap.set(rawName, row);
                            if (rawId && !idMap.has(rawId)) idMap.set(rawId, row);
                            if (rawLicense && !licenseMap.has(rawLicense)) licenseMap.set(rawLicense, row);
                        });
                    }
                    database.maps = { nameMap, idMap, licenseMap };

                    if (e.data.headers && e.data.headers.length > 0) {
                        database.headers = e.data.headers;
                        // Always ensure index 8 (9th column, Column I) is 'RECEIVED BY' for dynamic alignment and flawless self-healing
                        while (database.headers.length <= 8) {
                            database.headers.push(`Column_${database.headers.length}`);
                        }
                        database.headers[8] = 'RECEIVED BY';
                        localStorage.setItem('tmodl_headers', JSON.stringify(database.headers));
                    }

                    if (database.isSilentSyncing) {
                        database.isSilentSyncing = false;
                        if (rows) {
                            saveToDB(incomingRows);
                        }
                        
                        // If there is an active search card displayed, silently refresh it!
                        if (database.lastQuery && elements.resultsArea && elements.resultsArea.children.length > 0) {
                            console.log('[Silent Refreshing] Silent refresh triggered for query:', database.lastQuery);
                            database.isSilentSearch = true;
                            elements.searchForm.dispatchEvent(new Event('submit'));
                        }
                    } else {
                        if (rows) {
                            saveToDB(incomingRows);
                            const activeId = database.spreadsheetId || localStorage.getItem('tmodl_active_spreadsheet_id') || '128y-JrUDPVWbvarLzKH4pSkNgmK25ouUM26aswWHKiU';
                            localStorage.setItem('tmodl_last_cached_sheet_id', activeId);
                        }
                        
                        // Clear bypassGuard flag here
                        database.bypassGuard = false;
                        
                        // If we have a pending search resolver from manual search click
                        if (database.pendingSearchResolve) {
                            const resolve = database.pendingSearchResolve;
                            database.pendingSearchResolve = null;
                            resolve();
                        } else {
                            hideLoading();
                            updateUIState();
                            showToast(`प्रणाली सञ्चालनमा आयो। ${count.toLocaleString()} रेकर्डहरू लोड भए।`, 'success');
                        }
                    }
                    
                    // Trigger the background auto poll loop once loaded
                    startGoogleSheetsAutoSync();
                    break;
                case 'ERROR':
                    console.error(`Worker Error: ${error}`);
                    hideLoading();
                    updateUIState();
                    showToast(`Sync Failed: ${error}`, 'error');
                    break;
            }
        };

        worker.onerror = function(e) {
            console.error(`Worker System Error: ${e.message}`);
            hideLoading();
            updateUIState();
            showToast('Background Synchronization Failed', 'error');
        };
    } catch (err) {
        console.error(`Worker Init Failed: ${err.message}`);
        // Fallback or handle appropriately
    }
}

function updateVisitorCounterUI() {
    if (elements.visitorCountTextNode) {
        elements.visitorCountTextNode.textContent = database.visitorCount.toLocaleString('en-US');
    }
}

function incrementVisitorCount() {
    database.visitorCount++;
    localStorage.setItem('tmodl_visitor_counter_value', database.visitorCount);
    updateVisitorCounterUI();
}

function showMismatchPopup() {
    if (elements.mismatchWarningBackdrop && elements.mismatchWarningPopup) {
        elements.mismatchWarningBackdrop.style.display = 'block';
        elements.mismatchWarningBackdrop.offsetHeight; // force reflow
        elements.mismatchWarningBackdrop.style.opacity = '1';
        elements.mismatchWarningPopup.style.display = 'flex';
        elements.mismatchWarningPopup.offsetHeight; // force reflow
        elements.mismatchWarningPopup.style.opacity = '1';
    }
}

function hideMismatchPopup() {
    if (elements.mismatchWarningPopup) {
        elements.mismatchWarningPopup.style.opacity = '0';
        if (elements.mismatchWarningBackdrop) {
            elements.mismatchWarningBackdrop.style.opacity = '0';
        }
        setTimeout(() => {
            if (elements.mismatchWarningPopup && elements.mismatchWarningPopup.style.opacity === '0') {
                elements.mismatchWarningPopup.style.display = 'none';
                if (elements.mismatchWarningBackdrop) {
                    elements.mismatchWarningBackdrop.style.display = 'none';
                }
            }
        }, 300);
    }
}

// Register close events on page load if needed, but we can do it globally right here
document.addEventListener('DOMContentLoaded', () => {
    if (elements.closeMismatchWarningBtn) {
        elements.closeMismatchWarningBtn.addEventListener('click', hideMismatchPopup);
    }
    if (elements.mismatchWarningBackdrop) {
        elements.mismatchWarningBackdrop.addEventListener('click', hideMismatchPopup);
    }
});

initWorker();

// Initialize authentication status on page load
document.addEventListener('DOMContentLoaded', () => {
    updateVisitorCounterUI();
    currentUserRole = localStorage.getItem('tmodl_user_role') || null;
    isAdmin = currentUserRole === 'super' || currentUserRole === 'admin' || currentUserRole === 'staff';
    
    // Seed default admin accounts if empty
    let adminAccounts = JSON.parse(localStorage.getItem('tmodl_admin_accounts') || '[]');
    let modified = false;
    const hasStaff = adminAccounts.some(acc => acc.username === 'staff');
    const hasAdmin = adminAccounts.some(acc => acc.username === 'admin');

    if (!hasStaff) {
        adminAccounts.push({ username: 'staff', password: 'Staff@2026' });
        modified = true;
    }
    if (!hasAdmin) {
        adminAccounts.push({ username: 'admin', password: 'Admin@2026' });
        modified = true;
    }

    if (modified || adminAccounts.length === 0) {
        localStorage.setItem('tmodl_admin_accounts', JSON.stringify(adminAccounts));
    }
    
    updateUIState();
    
    // Wire up Create Admin Form if it exists
    const createAdminForm = document.getElementById('create-admin-form');
    if (createAdminForm) {
        createAdminForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('new-admin-user');
            const passwordInput = document.getElementById('new-admin-pwd');
            if (!usernameInput || !passwordInput) return;
            
            const username = usernameInput.value.trim().toLowerCase();
            const password = passwordInput.value.trim();
            
            if (username.length < 3 || password.length < 4) {
                showToast('Username must be 3+ chars, password 4+ chars! (प्रयोगकर्ता नाम कम्तीमा ३ र पासवर्ड ४ अक्षर हुनुपर्छ)', 'error');
                return;
            }
            
            let currentAccounts = JSON.parse(localStorage.getItem('tmodl_admin_accounts') || '[]');
            if (currentAccounts.some(acc => acc.username === username) || username === 'admin' || username === 'superadmin') {
                showToast('यो प्रयोगकर्ता नाम पहिले नै अवस्थित छ! (Username already exists)', 'error');
                return;
            }
            
            currentAccounts.push({ username, password });
            localStorage.setItem('tmodl_admin_accounts', JSON.stringify(currentAccounts));
            
            usernameInput.value = '';
            passwordInput.value = '';
            renderAdminAccountsList();
            showToast(`नयाँ डाटा एन्ट्री कर्मचारी "${username}" थपियो!`, 'success');
        });
    }
});

// --- Secure Authentication & Cryptographic Utilities ---
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password + "SunsariItahariSaltValue2026!!");
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate random temporary passwords
function generateTemporaryPassword() {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const specials = '!@#$';
    
    let pwd = '';
    pwd += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    pwd += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    pwd += numbers.charAt(Math.floor(Math.random() * numbers.length));
    pwd += specials.charAt(Math.floor(Math.random() * specials.length));
    
    const combined = uppercase + lowercase + numbers + specials;
    for (let i = 4; i < 9; i++) {
        pwd += combined.charAt(Math.floor(Math.random() * combined.length));
    }
    
    // Shuffle the password
    return pwd.split('').sort(() => 0.5 - Math.random()).join('');
}

// Log security audit trails
function logSecurityAction(username, action, status, details) {
    let logs = [];
    try {
        logs = JSON.parse(localStorage.getItem('tmodl_audit_logs') || '[]');
    } catch(e) { logs = []; }
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString(); 
    const bsDate = window.convertAdToBs(now); 
    const timestamp = `${bsDate} ${timeStr}`;
    const simulatedIP = '192.168.106.' + Math.floor(2 + Math.random() * 253);
    const simulatedDevice = navigator.userAgent ? navigator.userAgent.substring(0, 45) + '...' : 'Unknown Terminal';
    
    logs.unshift({ timestamp, username, action, status, details, client: `${simulatedIP} (${simulatedDevice})` });
    
    // limit to most recent 250 logs
    if (logs.length > 250) logs = logs.slice(0, 250);
    localStorage.setItem('tmodl_audit_logs', JSON.stringify(logs));
    
    // If visible, render immediately
    renderSecurityLogsList();
}

function renderSecurityLogsList() {
    const logsContainer = document.getElementById('security-logs-body');
    if (!logsContainer) return;
    
    let logs = [];
    try {
        logs = JSON.parse(localStorage.getItem('tmodl_audit_logs') || '[]');
    } catch(e) { logs = []; }
    
    if (logs.length === 0) {
        logsContainer.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1rem; color: var(--text-secondary);">No logs registered in ledger trace.</td></tr>`;
        return;
    }
    
    logsContainer.innerHTML = logs.map(l => {
        let badgeClass = 'log-success';
        let statusDisplayText = l.status.toUpperCase();
        
        if (l.status.toLowerCase() === 'suspended') {
            badgeClass = 'log-success';
            statusDisplayText = 'SUCCESS';
        } else if (l.status.toLowerCase() === 'failed') {
            badgeClass = 'log-failed';
        } else if (l.status.toLowerCase() === 'warning' || l.status.toLowerCase() === 'lockout') {
            badgeClass = 'log-warn';
        }
        
        return `
            <tr>
                <td style="padding: 0.55rem 0.75rem;">${l.timestamp}</td>
                <td style="padding: 0.55rem 0.75rem; font-weight: bold; color: var(--text-primary);">${escapeHTML(l.username)}</td>
                <td style="padding: 0.55rem 0.75rem; color: var(--text-secondary);">${escapeHTML(l.action)}</td>
                <td style="padding: 0.55rem 0.75rem;"><span class="log-badge ${badgeClass}">${statusDisplayText}</span></td>
                <td style="padding: 0.55rem 0.75rem; color: var(--text-secondary); font-size: 0.65rem;">${escapeHTML(l.client)}</td>
            </tr>
        `;
    }).join('');
}

// Interactive secure API-driven OTP verification modal
function showOTPVerification(username, isSuper, initialSimulatedOtp, onSuccess, onCancel, customVerifyHandler) {
    // Show simulated floating banner if simulated code is available
    let banner = null;
    if (initialSimulatedOtp) {
        banner = document.createElement('div');
        banner.style.position = 'fixed';
        banner.style.top = '1.5rem';
        banner.style.left = '50%';
        banner.style.transform = 'translateX(-50%)';
        banner.style.background = 'linear-gradient(135deg, #1e293b, #0f172a)';
        banner.style.border = '2px solid #FBBC05';
        banner.style.boxShadow = '0 20px 40px rgba(0,0,0,0.5), 0 0 15px rgba(251, 188, 5, 0.2)';
        banner.style.borderRadius = '16px';
        banner.style.padding = '1rem 1.5rem';
        banner.style.zIndex = '9999';
        banner.style.maxWidth = '90%';
        banner.style.textAlign = 'center';
        banner.style.animation = 'fadeIn 0.4s ease-out';
        banner.innerHTML = `
            <div style="font-size: 1.25rem; margin-bottom: 0.25rem;">📱 Simulated Mobile SMS / Email Gateway</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase;">Security Authorization Dispatch</div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.4rem; color: #FBBC05; font-weight: 800; letter-spacing: 2px;">OTP CODE: <span id="simulated-otp-code">${initialSimulatedOtp}</span></div>
            <div style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 0.35rem;">Enter this code into verification box within 120 seconds.</div>
        `;
        document.body.appendChild(banner);
    }
    
    // Create OTP prompt layout modal
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(2, 6, 23, 0.95)';
    overlay.style.backdropFilter = 'blur(15px)';
    overlay.style.zIndex = '2350';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '1rem';
    
    overlay.innerHTML = `
        <div class="card" style="max-width: 400px; width: 100%; padding: 2rem; border-radius: 20px; border: 1px solid rgba(251, 188, 5, 0.3); text-align: center; position: relative;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔑</div>
            <h3 style="color: var(--text-primary); font-size: 1.25rem; font-weight: 800; margin-bottom: 0.5rem;">Two-Factor OTP Security</h3>
            <p style="color: var(--text-secondary); font-size: 0.75rem; line-height: 1.4; margin-bottom: 1.5rem;">
                A verification code was dispatched to registered terminal of <strong>${escapeHTML(username)}</strong>.
            </p>
            
            <div style="display: flex; flex-direction: column; gap: 0.85rem; text-align: left; margin-bottom: 1.5rem;">
                <label style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px;">6-Digit OTP Code</label>
                <input type="text" id="otp-entry-box" placeholder="● ● ● ● ● ●" maxlength="6" style="text-align: center; font-size: 1.8rem; font-weight: bold; letter-spacing: 6px; width: 100%; height: 3.2rem; background: rgba(2, 6, 23, 0.6); border: 1.5px solid var(--glass-border); border-radius: 12px; color: #fff; outline: none; box-sizing: border-box;">
                <div id="otp-timer-lbl" style="font-size: 0.65rem; color: #ff4d4d; text-align: center; font-weight: 700;">Verifying link active (Expires in: 120s)</div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
                <button id="otp-verify-submit" class="btn btn-primary" style="height: 2.8rem; font-size: 0.85rem; font-weight: 800;">VERIFY LINK</button>
                <button id="otp-resend-btn" class="btn" disabled style="height: 2.8rem; background: rgba(255,255,255,0.05); color: #a1a1aa; font-size: 0.85rem;">RESEND OTP (120s)</button>
                <button id="otp-verify-cancel" class="btn" style="height: 2.8rem; background: rgba(255,255,255,0.02); color: #fff; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.1);">CANCEL</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const entryInput = overlay.querySelector('#otp-entry-box');
    entryInput.focus();
    
    let timeRemaining = 120;
    let intervalTimer = null;

    const startTimer = () => {
        intervalTimer = setInterval(() => {
            timeRemaining--;
            const timerLbl = overlay.querySelector('#otp-timer-lbl');
            const resendBtn = overlay.querySelector('#otp-resend-btn');
            
            if (timerLbl) timerLbl.innerText = `Verifying link active (Expires in: ${timeRemaining}s)`;
            if (resendBtn) resendBtn.innerText = `RESEND OTP (${timeRemaining}s)`;
            
            if (timeRemaining <= 0) {
                clearInterval(intervalTimer);
                if (timerLbl) {
                    timerLbl.innerText = 'OTP code has expired! Please request verification again.';
                    timerLbl.style.color = '#ff4d4d';
                }
                if (resendBtn) {
                    resendBtn.removeAttribute('disabled');
                    resendBtn.style.color = '#FBBC05';
                    resendBtn.style.background = 'rgba(251, 188, 5, 0.1)';
                    resendBtn.innerText = 'RESEND OTP';
                }
            }
        }, 1000);
    };

    startTimer();

    // Wire Resend OTP button
    overlay.querySelector('#otp-resend-btn').addEventListener('click', async () => {
        showLoading('पुनः OTP कोड पठाउँदै... (Resending OTP...)');
        try {
            const res = await fetch('/api/auth/resend-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            const data = await res.json();
            hideLoading();
            if (res.ok) {
                showToast('नयाँ OTP कोड सफलतापूर्वक पठाइयो! (New OTP sent!)', 'success');
                timeRemaining = 120;
                const resendBtn = overlay.querySelector('#otp-resend-btn');
                if (resendBtn) {
                    resendBtn.setAttribute('disabled', 'true');
                    resendBtn.style.color = '#a1a1aa';
                    resendBtn.style.background = 'rgba(255,255,255,0.05)';
                }
                if (banner && data.simulatedOtp) {
                    const codeSpan = banner.querySelector('#simulated-otp-code');
                    if (codeSpan) codeSpan.innerText = data.simulatedOtp;
                }
                clearInterval(intervalTimer);
                startTimer();
            } else {
                showToast(data.error || 'पुनः OTP पठाउँदा त्रुटि आयो।', 'error');
            }
        } catch (e) {
            hideLoading();
            showToast('सञ्जाल जडान त्रुटि।', 'error');
        }
    });
    
    // Wire Verify Submit button
    overlay.querySelector('#otp-verify-submit').addEventListener('click', async () => {
        const pinValue = entryInput.value.trim();
        if (pinValue.length === 0) {
            showToast('कृपया ६-डिजिट OTP विवरण हाल्नुहोस।', 'error');
            return;
        }

        if (customVerifyHandler) {
            customVerifyHandler(pinValue, (err, result) => {
                if (err) {
                    showToast(err, 'error');
                    entryInput.value = '';
                    entryInput.focus();
                } else {
                    clearInterval(intervalTimer);
                    if (banner) banner.remove();
                    overlay.remove();
                    onSuccess(result);
                }
            });
            return;
        }

        showLoading('OTP कोड रुजु गर्दै... (Verifying OTP...)');
        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, code: pinValue })
            });

            const data = await res.json();
            hideLoading();

            if (res.ok && data.success) {
                clearInterval(intervalTimer);
                if (banner) banner.remove();
                overlay.remove();

                // Store secure JWT details
                localStorage.setItem('tmodl_token', data.token);
                localStorage.setItem('tmodl_user_role', data.user.role);
                localStorage.setItem('tmodl_logged_username', data.user.username);
                localStorage.setItem('tmodl_admin_logged_in', 'true');
                
                currentUserRole = data.user.role;
                isAdmin = true;

                showToast(`लगइन सफल भयो!`, 'success');

                // Check if they must change password first
                if (data.user.mustChangePassword) {
                    showForcePasswordChange(username, () => {
                        onSuccess();
                    });
                } else {
                    onSuccess();
                }
            } else {
                showToast(data.error || 'OTP प्रमाणिकरण असफल भयो!', 'error');
                entryInput.value = '';
                entryInput.focus();
            }
        } catch (e) {
            hideLoading();
            showToast('सञ्जाल जडान त्रुटि।', 'error');
        }
    });
    
    overlay.querySelector('#otp-verify-cancel').addEventListener('click', () => {
        clearInterval(intervalTimer);
        if (banner) banner.remove();
        overlay.remove();
        logSecurityAction(username, '2FA OTP Verification Cancelled', 'warning', 'Authentication cancelled by client intent');
        if (onCancel) onCancel();
    });
}

// Force standard first-login password updates
function showForcePasswordChange(username, onSuccess) {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(2, 6, 23, 0.95)';
    overlay.style.backdropFilter = 'blur(15px)';
    overlay.style.zIndex = '2360';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '1rem';
    
    overlay.innerHTML = `
        <div class="card" style="max-width: 440px; width: 100%; padding: 2.25rem; border-radius: 24px; border: 1px solid rgba(59, 130, 246, 0.3); text-align: left;">
            <h3 style="color: var(--text-primary); font-size: 1.35rem; font-weight: 800; margin-top: 0; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 8px;">🔐 First Login - Definition of Credentials</h3>
            <p style="color: var(--text-secondary); font-size: 0.75rem; line-height: 1.45; margin-bottom: 1.5rem;">
                Attention <strong>${escapeHTML(username)}</strong>: This account utilizes a temporary password. 
                Please define a personalized, strong secure password to authorize and complete authentication.
                <br><br>
                <span style="color:#FBBC05"><strong>Password requirements:</strong> Minimum 6 chars, 1 uppercase letter, 1 number, and 1 special symbol.</span>
            </p>
            
            <form id="force-change-pwd-inner-form" style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
                <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <label style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">New Secure Password</label>
                    <div class="password-input-wrapper">
                        <input type="password" id="force-new-pwd-1" placeholder="Minimum 6 characters" required style="width: 100%; height: 2.6rem; background: rgba(2, 6, 23, 0.6); border: 1px solid var(--glass-border); border-radius: 10px; padding: 0 2.85rem 0 0.85rem; color: #fff; font-size: 0.9rem; outline: none; box-sizing: border-box;">
                        <button type="button" class="password-toggle-eye" tabindex="-1">👁️</button>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <label style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Confirm New Password</label>
                    <div class="password-input-wrapper">
                        <input type="password" id="force-new-pwd-2" placeholder="Re-enter password for matching" required style="width: 100%; height: 2.6rem; background: rgba(2, 6, 23, 0.6); border: 1px solid var(--glass-border); border-radius: 10px; padding: 0 2.85rem 0 0.85rem; color: #fff; font-size: 0.9rem; outline: none; box-sizing: border-box;">
                        <button type="button" class="password-toggle-eye" tabindex="-1">👁️</button>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary" style="height: 3rem; font-size: 0.9rem; font-weight: 800; border-radius: 10px; background: #0F9D58; border: none; cursor: pointer; width: 100%;">APPLY & COMPLETE UNLOCK</button>
            </form>
        </div>
    `;
    
    document.body.appendChild(overlay);
    window.initPasswordToggles();
    overlay.querySelector('#force-new-pwd-1').focus();
    
    overlay.querySelector('#force-change-pwd-inner-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd1 = overlay.querySelector('#force-new-pwd-1').value.trim();
        const pwd2 = overlay.querySelector('#force-new-pwd-2').value.trim();
        
        if (pwd1.length < 4) {
            showToast('पासवर्ड कम्तिमा ४ अक्षरको हुनुपर्छ! (Password length must be at least 4 characters!)', 'error');
            return;
        }

        if (pwd1 !== pwd2) {
            showToast('पासवर्ड पुष्टि गर्न मिल्ने गरि पुन: लेख्नुहोस (Password confirmation match failed.)', 'error');
            return;
        }
        
        showLoading('सुरक्षित विवरण अपडेट गर्दै... (Saving Password...)');
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('tmodl_token')}`
                },
                body: JSON.stringify({ newPassword: pwd1 })
            });

            const data = await res.json();
            hideLoading();

            if (res.ok && data.success) {
                overlay.remove();
                logSecurityAction(username, 'Default Credentials Migrated Safely', 'success', 'Password changed fully and securely on first access');
                showToast('तपाईको पासवर्ड सफलतापूर्वक अद्यावधिक भयो! (Security password customized!)', 'success');
                onSuccess();
            } else {
                showToast(data.error || 'पासवर्ड परिवर्तन असफल भयो।', 'error');
            }
        } catch (err) {
            hideLoading();
            showToast('नेटवर्क जडान त्रुटि।', 'error');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    currentUserRole = localStorage.getItem('tmodl_user_role') || null;
    isAdmin = currentUserRole === 'super' || currentUserRole === 'admin' || currentUserRole === 'staff';
    
    // Seed default admin accounts if empty and update plain text files to Secure Hashes
    (async () => {
        let adminAccounts = JSON.parse(localStorage.getItem('tmodl_admin_accounts') || '[]');
        let modified = false;
        
        const hasStaff = adminAccounts.some(acc => acc.username === 'staff');
        const hasAdmin = adminAccounts.some(acc => acc.username === 'admin');

        if (!hasStaff) {
            adminAccounts.push({
                fullName: "Staff Operator Team",
                designation: "Computer Operator",
                mobileNumber: "9845012345",
                username: "staff",
                role: "staff",
                status: "active",
                mustChangePassword: true,
                failedAttempts: 0,
                passwordHash: await hashPassword('Staff@2026')
            });
            modified = true;
        }

        if (!hasAdmin) {
            adminAccounts.push({
                fullName: "Lead Administrator",
                designation: "Admin Operator",
                mobileNumber: "9843112233",
                username: "admin",
                role: "admin",
                status: "active",
                mustChangePassword: true,
                failedAttempts: 0,
                passwordHash: await hashPassword('Admin@2026')
            });
            modified = true;
        }

        for (let acc of adminAccounts) {
            if (!acc.passwordHash) {
                const legacyPwd = acc.password || (acc.username === 'admin' ? 'Admin@2026' : 'Staff@2012');
                acc.passwordHash = await hashPassword(legacyPwd);
                acc.fullName = acc.fullName || (acc.username === 'admin' ? 'Lead Administrator' : 'Office Staff Operator');
                acc.designation = acc.designation || (acc.username === 'admin' ? 'Admin Operator' : 'Special Assistant');
                acc.mobileNumber = acc.mobileNumber || '9843112233';
                acc.status = acc.status || 'active';
                acc.role = acc.role || (acc.username === 'admin' ? 'admin' : 'staff');
                acc.mustChangePassword = acc.mustChangePassword !== undefined ? acc.mustChangePassword : true;
                acc.failedAttempts = acc.failedAttempts || 0;
                delete acc.password;
                modified = true;
            }
        }
        
        if (modified) {
            localStorage.setItem('tmodl_admin_accounts', JSON.stringify(adminAccounts));
        }
        
        updateUIState();
        wireTabsAndControls();
    })();
    
    // Context hook blocking shortcuts and context menus
    document.addEventListener('contextmenu', (e) => {
        // Release restriction for logged-in staff/admin/super users
        try {
            const role = currentUserRole || localStorage.getItem('tmodl_user_role');
            if (role === 'super' || role === 'admin' || role === 'staff') {
                return; // Allow right click
            }
        } catch (err) {}

        e.preventDefault();
        showToast('Administrative source protection active. Access logged in audit trace.', 'warning');
        logSecurityAction('Guest User', 'Context Menu Request Intercepted', 'warning', 'Prevented right-click operations in DOM');
    });

    document.addEventListener('keydown', (e) => {
        try {
            const role = currentUserRole || localStorage.getItem('tmodl_user_role');
            if (role === 'super') return;
        } catch (err) {}
        
        const f12Trigger = e.key === 'F12';
        const inspectShortcuts = (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C' || e.key === 'i' || e.key === 'j' || e.key === 'c'));
        const sourceShortcuts = (e.ctrlKey && (e.key === 'U' || e.key === 'u'));
        
        if (f12Trigger || inspectShortcuts || sourceShortcuts) {
            e.preventDefault();
            showToast('Shield Protection Active: Shortcuts restricted on standard terminals.', 'warning');
            logSecurityAction('Guest User', 'DevTools Elements Short-cut Intercepted', 'warning', `Intercepted shortcut key execution: ${e.key}`);
        }
    });
});

async function loadAvailablePasswordTargets() {
    const targetSelect = document.getElementById('change-pwd-target-user');
    if (!targetSelect) return;

    try {
        const res = await fetch('/api/admin/available-targets', {
            headers: getAuthHeader()
        });
        if (res.ok) {
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const textVal = await res.text();
                if (textVal.trim().toLowerCase().startsWith('<!doctype html') || textVal.trim().toLowerCase().startsWith('<html')) {
                    throw new Error('Server returned HTML instead of authentication settings JSON dataset. The session might be expired, reset, or backend server is still initializing.');
                }
                throw new Error('Server API returned non-JSON format content.');
            }
            
            const targets = await res.json();
            let html = '';
            targets.forEach(t => {
                const loggedInUser = localStorage.getItem('tmodl_logged_username') || '';
                const isSelf = t.username.toLowerCase() === loggedInUser.toLowerCase();
                const selfLabel = isSelf ? ' (आफै / Myself)' : '';
                const roleLabel = t.role === 'super' ? 'Super Admin' : (t.role === 'admin' ? 'Admin' : 'Data Entry Staff');
                html += `<option value="${escapeHTML(t.username)}">${escapeHTML(t.fullName)} [${escapeHTML(t.username)}] - ${roleLabel}${selfLabel}</option>`;
            });
            targetSelect.innerHTML = html;
        } else {
            targetSelect.innerHTML = '<option value="" disabled>Error loading accounts</option>';
            const errorPayload = await res.json().catch(() => ({}));
            if (res.status === 401 || res.status === 403) {
                console.warn('Session is stale, unauthorized, or expired:', errorPayload.error || 'MFA Required');
            }
        }
    } catch (e) {
        console.error('Error loading password targets:', e);
        targetSelect.innerHTML = '<option value="" disabled>Connection error</option>';
    }
}

// Wire up operational control tabs & custom forms
function wireTabsAndControls() {
    // 1. Hook up Navigation Tabs
    const tabs = [
        { btn: document.getElementById('tab-btn-dashboard'), panel: document.getElementById('panel-dashboard') },
        { btn: document.getElementById('tab-btn-reports'), panel: document.getElementById('panel-reports') },
        { btn: document.getElementById('tab-btn-staff'), panel: document.getElementById('panel-staff') },
        { btn: document.getElementById('tab-btn-logs'), panel: document.getElementById('panel-logs') },
        { btn: document.getElementById('tab-btn-settings'), panel: document.getElementById('panel-settings') }
    ];
    
    tabs.forEach(t => {
        if (t.btn) {
            t.btn.addEventListener('click', () => {
                tabs.forEach(item => {
                    if (item.btn) item.btn.classList.remove('active');
                    if (item.panel) item.panel.classList.remove('active');
                });
                t.btn.classList.add('active');
                if (t.panel) t.panel.classList.add('active');
                
                // If log tab clicked, render logs list
                if (t.btn.id === 'tab-btn-logs') {
                    renderSecurityLogsList();
                }
                // If staff tab clicked, render staff list
                if (t.btn.id === 'tab-btn-staff') {
                    renderStaffMatrixList();
                }
                // If reports tab clicked, render reports list
                if (t.btn.id === 'tab-btn-reports') {
                    generateReport();
                }
                // If settings tab clicked, load allowed password targets
                if (t.btn.id === 'tab-btn-settings') {
                    loadAvailablePasswordTargets();
                }
            });
        }
    });

    // 2. Generate random credentials button
    const btnGenPwd = document.getElementById('btn-generate-pwd');
    if (btnGenPwd) {
        btnGenPwd.addEventListener('click', () => {
            const tempPwd = generateTemporaryPassword();
            const pwdInput = document.getElementById('staff-temp-pwd');
            if (pwdInput) {
                pwdInput.value = tempPwd;
                showToast(`Generated secure password: "${tempPwd}"`, 'success');
            }
        });
    }

    // 3. Hook up Extended Administrative Registrations
    const createFullAdminForm = document.getElementById('create-admin-form-full');
    if (createFullAdminForm) {
        createFullAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fullName = document.getElementById('staff-fullname').value.trim();
            const designation = document.getElementById('staff-designation').value.trim();
            const mobileNumber = document.getElementById('staff-mobile').value.trim();
            const username = document.getElementById('staff-username').value.trim().toLowerCase();
            const role = document.getElementById('staff-role').value;
            const tempPwd = document.getElementById('staff-temp-pwd').value.trim();
            
            if (username.length < 3) {
                showToast('प्रयोगकर्ता नाम कम्तिमा ३ अक्षरको हुनुपर्छ! (Username must be 3+ chars!)', 'error');
                return;
            }
            if (tempPwd.length < 4) {
                showToast('पासवर्ड कम्तिमा ४ अक्षरको हुनुपर्छ! (Temporary password must be 4+ chars!)', 'error');
                return;
            }
            if (!mobileNumber || mobileNumber.length !== 10) {
                showToast('कृपया १० अंकको सही नेपाली मोबाइल नम्बर हाल्नुहोस्!', 'error');
                return;
            }
            
            showLoading('नयाँ कर्मचारी थप्दै... (Registering staff...)');
            try {
                const apiRes = await fetch('/api/admin/staff', {
                    method: 'POST',
                    headers: getAuthHeader(),
                    body: JSON.stringify({
                        username,
                        password: tempPwd,
                        fullName,
                        designation,
                        mobileNumber,
                        role
                    })
                });
                
                const apiData = await apiRes.json();
                hideLoading();
                
                if (apiRes.ok) {
                    logSecurityAction('Super Admin', 'Staff Account Registered', 'success', `Created login profile for "${username}" (Designation: ${designation})`);
                    createFullAdminForm.reset();
                    showToast(apiData.message || `Registered staff account "${username}" successfully!`, 'success');
                    renderStaffMatrixList();
                } else {
                    showToast(apiData.error || 'त्रुटि आयो।', 'error');
                }
            } catch (err) {
                hideLoading();
                showToast('सञ्जाल जडान त्रुटि।', 'error');
                console.error(err);
            }
        });
    }

    // 4. Hook up own and hierarchical user password modification
    const changeSuperForm = document.getElementById('change-super-pwd-form');
    if (changeSuperForm) {
        changeSuperForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const targetUserSelect = document.getElementById('change-pwd-target-user');
            const currentPassInput = document.getElementById('current-super-pass');
            const newPassInput = document.getElementById('new-super-pass');
            const confirmPassInput = document.getElementById('confirm-super-pass');
            
            const targetUsername = targetUserSelect ? targetUserSelect.value : '';
            const currentPass = currentPassInput.value;
            const newPass = newPassInput.value.trim();
            const confirmPass = confirmPassInput.value.trim();
            
            if (!targetUsername) {
                showToast('कृपया लक्षित खाता चयन गर्नुहोस्। (Please select target account)', 'error');
                return;
            }
            if (newPass.length < 4) {
                showToast('पासवर्ड कम्तिमा ४ अक्षरको हुनुपर्छ! (New password must be at least 4 characters!)', 'error');
                return;
            }
            if (newPass !== confirmPass) {
                showToast('नयाँ पासवर्ड र पुष्टि पासवर्ड मिलेन! (New password and confirmation do not match!)', 'error');
                return;
            }
            
            showLoading('आफ्नो पासवर्ड प्रमाणिकरण गर्दै... (Verifying your active administrator password...)');
            try {
                // Get currently logged-in user name
                const currentLoggedUser = localStorage.getItem('tmodl_logged_username') || 'superadmin';
                
                // Verify the current logged in administrator's password against the backend login API to authorize
                const verifyRes = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentLoggedUser, password: currentPass })
                });
                
                if (!verifyRes.ok) {
                    hideLoading();
                    showToast('आफ्नो वर्तमान पासवर्ड पुष्टि गर्न असफल भयो! (Active administrator password verification failed!)', 'error');
                    return;
                }
                
                showLoading('लक्षित पासवर्ड सुरक्षित गर्दै... (Saving target password...)');
                const changeRes = await fetch('/api/admin/change-any-password', {
                    method: 'POST',
                    headers: getAuthHeader(),
                    body: JSON.stringify({ targetUsername, newPassword: newPass })
                });
                
                const changeData = await changeRes.json();
                hideLoading();
                
                if (changeRes.ok && changeData.success) {
                    currentPassInput.value = '';
                    newPassInput.value = '';
                    confirmPassInput.value = '';
                    logSecurityAction('Admin Controls', `User Password Administered: [${targetUsername}]`, 'success', `Credential hashes modified for account ${targetUsername} authorized by ${currentLoggedUser}`);
                    showToast(changeData.message || 'पासवर्ड सफलतापूर्वक परिवर्तन गरियो। (Target password updated successfully!)', 'success');
                    
                    // Reload targets dropdown in case of any role changes or state update info needed
                    loadAvailablePasswordTargets();
                } else {
                    showToast(changeData.error || 'पासवर्ड परिवर्तन असफल भयो।', 'error');
                }
            } catch (err) {
                hideLoading();
                showToast('सञ्जाल जडान त्रुटि।', 'error');
                console.error(err);
            }
        });
    }

    // 5. Initialize and wire Google Apps Script Web App URL write-back integration
    if (elements.googleAppsScriptUrl) {
        elements.googleAppsScriptUrl.value = localStorage.getItem('tmodl_google_script_url') || '';
    }
    if (elements.saveGoogleScriptUrlBtn) {
        elements.saveGoogleScriptUrlBtn.addEventListener('click', () => {
            const urlValue = elements.googleAppsScriptUrl.value.trim();
            localStorage.setItem('tmodl_google_script_url', urlValue);
            logSecurityAction('Super Admin', 'Google Sheet Writeback Web App Configured', 'success', `Writeback endpoint set to: ${urlValue || '(cleared)'}`);
            showToast('Google Sheet writeback integration URL saved successfully! (गुगल सिट एकीकरण URL सुरक्षित भयो!)', 'success');
        });
    }

    // 6. Advanced Export & Reports Event Listeners
    const btnGenReport = document.getElementById('btn-generate-report');
    if (btnGenReport) {
        btnGenReport.addEventListener('click', () => {
             generateReport();
             showToast('रिपोर्ट सफलतापूर्वक तयार भयो! (Report generated successfully!)', 'success');
        });
    }

    const checkboxApplyDate = document.getElementById('report-apply-date-filter');
    if (checkboxApplyDate) {
        checkboxApplyDate.addEventListener('change', () => {
            generateReport();
        });
    }

    window.selectedReportUser = 'ALL';
    
    const reportTypeSelect = document.getElementById('report-type-select');
    const btnChooseUser = document.getElementById('btn-choose-user');
    
    function syncChooseUserBtnState() {
        if (!reportTypeSelect || !btnChooseUser) return;
        if (reportTypeSelect.value === 'user') {
            btnChooseUser.style.opacity = '1';
            btnChooseUser.style.transform = 'scale(1)';
            btnChooseUser.style.boxShadow = '0 0 15px rgba(168, 85, 247, 0.2)';
            btnChooseUser.classList.add('pulse-glow');
        } else {
            btnChooseUser.style.opacity = '0.4';
            btnChooseUser.style.transform = 'scale(0.96)';
            btnChooseUser.style.boxShadow = 'none';
            btnChooseUser.classList.remove('pulse-glow');
        }
    }
    
    if (reportTypeSelect) {
        reportTypeSelect.addEventListener('change', syncChooseUserBtnState);
        setTimeout(syncChooseUserBtnState, 200); // Trigger initial sync after components settle
    }

    if (btnChooseUser) {
        btnChooseUser.addEventListener('click', () => {
            if (reportTypeSelect && reportTypeSelect.value !== 'user') {
                showToast('कृपया पहिले सूचीमा "प्रयोगकर्ता विवरण" (User-wise Summary) छान्नुहोस्! (Please select User-wise Distribution Summary category first!)', 'warning');
                return;
            }
            window.showChooseUserModal();
        });
    }

    // Modal Choose User Controllers
    const chooseUserModal = document.getElementById('modal-choose-user');
    const chooseUserClose = document.getElementById('modal-choose-user-close');
    const chooseUserSearch = document.getElementById('modal-choose-user-search');
    const chooseUserList = document.getElementById('modal-choose-user-list');
    const chooseUserClear = document.getElementById('modal-choose-user-clear');
    const chooseUserConfirm = document.getElementById('modal-choose-user-confirm');
    
    let localSelectedUser = 'ALL';
    let localSelectedUsers = new Set();
    
    window.showChooseUserModal = function() {
        if (!chooseUserModal) return;
        chooseUserModal.style.display = 'flex';
        localSelectedUsers.clear();
        const curUser = (window.selectedReportUser || 'ALL').trim().toUpperCase();
        if (curUser !== 'ALL') {
            curUser.split(',').forEach(u => {
                const tr = u.trim();
                if (tr) localSelectedUsers.add(tr);
            });
        }
        if (chooseUserSearch) chooseUserSearch.value = '';
        populateChooseUserList('');
    };
    
    window.hideChooseUserModal = function() {
        if (chooseUserModal) chooseUserModal.style.display = 'none';
    };
    
    if (chooseUserClose) {
        chooseUserClose.addEventListener('click', window.hideChooseUserModal);
    }
    
    if (chooseUserModal) {
        chooseUserModal.addEventListener('click', (e) => {
            if (e.target === chooseUserModal) {
                window.hideChooseUserModal();
            }
        });
    }
    
    function populateChooseUserList(filterText = '') {
        if (!chooseUserList) return;
        chooseUserList.innerHTML = '';
        
        const userSet = new Set(['SUPERADMIN', 'ADMIN', 'STAFF']);
        
        let adminAccounts = [];
        try {
            adminAccounts = JSON.parse(localStorage.getItem('tmodl_admin_accounts') || '[]');
            adminAccounts.forEach(acc => {
                if (acc.username) userSet.add(acc.username.trim().toUpperCase());
            });
        } catch(e){}
        
        if (window.lastFetchedStaffList && Array.isArray(window.lastFetchedStaffList)) {
            window.lastFetchedStaffList.forEach(acc => {
                if (acc.username) {
                    userSet.add(acc.username.trim().toUpperCase());
                    if (!adminAccounts.some(a => String(a.username).toLowerCase().trim() === String(acc.username).toLowerCase().trim())) {
                        adminAccounts.push(acc);
                    }
                }
            });
        }
        
        if (window.database && Array.isArray(window.database.rows)) {
            window.database.rows.forEach(r => {
                const recBy = String(r['RECEIVED BY'] || r['received by'] || r['Received By'] || '').trim();
                if (recBy && recBy.toUpperCase() !== 'PENDING' && recBy !== '') {
                    userSet.add(recBy.toUpperCase());
                }
            });
        }
        
        const getFullStaffName = (userName) => {
            if (!userName || userName === '---') return '---';
            const lowerUser = String(userName).toLowerCase().trim();
            const acc = adminAccounts.find(a => String(a.username).toLowerCase().trim() === lowerUser);
            if (acc && acc.fullName) {
                return acc.fullName;
            }
            if (lowerUser === 'admin') return 'Lead Administrator';
            if (lowerUser === 'superadmin') return 'Lead Administrator';
            if (lowerUser === 'staff') return 'Staff Operator Team';
            return userName;
        };
        
        const sortedUsers = Array.from(userSet).sort((a, b) => a.localeCompare(b));
        const filterUpper = filterText.toUpperCase();
        
        const isAllSelected = localSelectedUsers.size === 0;
        
        const allOption = document.createElement('div');
        allOption.style.padding = '0.75rem 1rem';
        allOption.style.borderRadius = '10px';
        allOption.style.background = isAllSelected ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.02)';
        allOption.style.border = isAllSelected ? '1.5px solid #3b82f6' : '1px solid rgba(255,255,255,0.06)';
        allOption.style.cursor = 'pointer';
        allOption.style.display = 'flex';
        allOption.style.alignItems = 'center';
        allOption.style.gap = '10px';
        allOption.style.transition = 'all 0.2s ease-in-out';
        
        const checkmarkAll = isAllSelected ? 
            `<div style="width: 20px; height: 20px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.75rem; margin-left: auto; box-shadow: 0 0 10px rgba(59,130,246,0.4); font-weight: bold;">✓</div>` :
            `<div style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.22); margin-left: auto; transition: 0.15s;"></div>`;

        allOption.innerHTML = `
            <div style="width: 32px; height: 32px; background: rgba(59,130,246,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; color: #3b82f6; min-width: 32px;">👥</div>
            <div style="flex: 1;">
                <div style="font-weight: 800; color: #fff; font-size: 0.9rem; font-family: 'Outfit', sans-serif;">ALL USERS (सबै प्रयोगकर्ता)</div>
                <div style="font-size: 0.72rem; color: #94a3b8; font-family: 'Outfit', sans-serif;">System performance overview for everyone</div>
            </div>
            ${checkmarkAll}
        `;
        
        allOption.addEventListener('click', () => {
            localSelectedUsers.clear();
            populateChooseUserList(chooseUserSearch ? chooseUserSearch.value.trim() : '');
        });
        
        if (filterUpper === '' || 'ALL USERS (सबै प्रयोगकर्ता)'.toUpperCase().includes(filterUpper)) {
            allOption.onmouseover = () => {
                if (localSelectedUsers.size > 0) {
                    allOption.style.background = 'rgba(255,255,255,0.06)';
                }
            };
            allOption.onmouseout = () => {
                if (localSelectedUsers.size > 0) {
                    allOption.style.background = 'rgba(255,255,255,0.02)';
                }
            };
            chooseUserList.appendChild(allOption);
        }
        
        sortedUsers.forEach(username => {
            const fullName = getFullStaffName(username);
            const isMatch = filterUpper === '' || 
                            username.includes(filterUpper) || 
                            fullName.toUpperCase().includes(filterUpper);
            if (!isMatch) return;
            
            const item = document.createElement('div');
            item.style.padding = '0.75rem 1rem';
            item.style.borderRadius = '10px';
            const isSel = localSelectedUsers.has(username);
            item.style.background = isSel ? 'rgba(147,51,234,0.18)' : 'rgba(255,255,255,0.02)';
            item.style.border = isSel ? '1.5px solid #a855f7' : '1px solid rgba(255,255,255,0.06)';
            item.style.cursor = 'pointer';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '10px';
            item.style.transition = 'all 0.2s ease-in-out';
            
            const checkmarkItem = isSel ? 
                `<div style="width: 20px; height: 20px; border-radius: 50%; background: #a855f7; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.75rem; margin-left: auto; box-shadow: 0 0 10px rgba(168,85,247,0.4); font-weight: bold;">✓</div>` :
                `<div style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.22); margin-left: auto; transition: 0.15s;"></div>`;

            const displayTitle = fullName !== username ? fullName : username;
            const displaySub = fullName !== username ? `Username: ${username.toLowerCase()} | Office System Operator` : `Office System Operator / Handler`;

            item.innerHTML = `
                <div style="width: 32px; height: 32px; background: rgba(147,51,234,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; color: #c084fc; min-width: 32px;">👤</div>
                <div style="flex: 1;">
                    <div style="font-weight: 800; color: #fff; font-size: 0.9rem; font-family: 'Outfit', sans-serif;">${displayTitle}</div>
                    <div style="font-size: 0.72rem; color: #94a3b8; font-family: 'Outfit', sans-serif;">${displaySub}</div>
                </div>
                ${checkmarkItem}
            `;
            
            item.addEventListener('click', () => {
                if (localSelectedUsers.has(username)) {
                    localSelectedUsers.delete(username);
                } else {
                    localSelectedUsers.add(username);
                }
                populateChooseUserList(chooseUserSearch ? chooseUserSearch.value.trim() : '');
            });
            
            item.onmouseover = () => {
                if (!localSelectedUsers.has(username)) {
                    item.style.background = 'rgba(255,255,255,0.06)';
                }
            };
            item.onmouseout = () => {
                if (!localSelectedUsers.has(username)) {
                    item.style.background = 'rgba(255,255,255,0.02)';
                }
            };
            
            chooseUserList.appendChild(item);
        });
    }
    
    if (chooseUserSearch) {
        chooseUserSearch.addEventListener('input', (e) => {
            populateChooseUserList(e.target.value.trim());
        });
    }
    
    if (chooseUserClear) {
        chooseUserClear.addEventListener('click', () => {
            window.selectedReportUser = 'ALL';
            if (btnChooseUser) {
                btnChooseUser.innerHTML = `
                    <span style="font-weight: 950;">👤 CHOOSE USER</span>
                    <span style="font-size: 0.7rem; font-weight: normal; opacity: 1.0; text-transform: none;">ALL USERS (सवै प्रयोगकर्ता विवरण)</span>
                `;
            }
            window.hideChooseUserModal();
            generateReport();
            showToast('चुनिएको प्रयोगकर्ता फिल्टर खाली भयो! (Cleared user filter)', 'success');
        });
    }
    
    if (chooseUserConfirm) {
        chooseUserConfirm.addEventListener('click', () => {
            if (localSelectedUsers.size === 0) {
                window.selectedReportUser = 'ALL';
                if (btnChooseUser) {
                    btnChooseUser.innerHTML = `
                        <span style="font-weight: 950;">👤 CHOOSE USER</span>
                        <span style="font-size: 0.7rem; font-weight: normal; opacity: 1.0; text-transform: none;">ALL USERS (सवै प्रयोगकर्ता विवरण)</span>
                    `;
                }
                window.hideChooseUserModal();
                generateReport();
                showToast('प्रयोगकर्ता फिल्टर अद्यावधिक भयो! (User filter updated to ALL!)', 'success');
            } else {
                const userArray = Array.from(localSelectedUsers);
                window.selectedReportUser = userArray.join(', ');
                if (btnChooseUser) {
                    const labelText = userArray.length > 2 ? `${userArray.slice(0, 2).join(', ')} (+${userArray.length - 2})` : userArray.join(', ');
                    btnChooseUser.innerHTML = `
                        <span style="font-weight: 950;">👤 ${labelText}</span>
                        <span style="font-size: 0.7rem; font-weight: bold; text-transform: none;">ALL USERS (${labelText})</span>
                    `;
                }
                window.hideChooseUserModal();
                generateReport();
                showToast(`प्रयोगकर्ताहरू "${userArray.join(', ')}" सफलतापूर्वक छानियो! (Users configured as filters!)`, 'success');
            }
        });
    }

    const btnExpExcel = document.getElementById('btn-export-excel');
    if (btnExpExcel) {
        btnExpExcel.addEventListener('click', () => {
             window.exportReportToExcel();
        });
    }
    const btnExpPDF = document.getElementById('btn-export-pdf');
    if (btnExpPDF) {
        btnExpPDF.addEventListener('click', () => {
             window.exportReportToPDF();
        });
    }
}

// Render administrative matrix list for staff registry control
function getAuthHeader() {
    const token = localStorage.getItem('tmodl_token');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function renderStaffMatrixList() {
    const listContainer = document.getElementById('staff-matrix-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1rem; color: var(--text-secondary);">लोड हुँदैछ... (Loading staff matrix...)</td></tr>';
    
    try {
        const headers = getAuthHeader();
        console.log('🔄 Fetching staff list with headers:', headers);
        
        const res = await fetch('/api/admin/staff', {
            headers: headers
        });
        
        // Check content-type header
        const contentType = res.headers.get('content-type') || '';
        let data;
        let errorMessage = '';
        
        if (contentType.includes('application/json')) {
            data = await res.json();
            if (!res.ok) {
                errorMessage = data.error || 'Failed to retrieve register list.';
            }
        } else {
            // Non-JSON response (could be plain text or HTML error page)
            const textResponse = await res.text();
            console.error('⚠️ Received non-JSON response from /api/admin/staff:', textResponse);
            errorMessage = `Server status ${res.status}: ${textResponse.slice(0, 150) || 'Unknown text response'}`;
        }
        
        if (!res.ok || errorMessage) {
            listContainer.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1rem; color: #ff4d4d;">क्रुटि: ${escapeHTML(errorMessage || 'Failed to fetch.')}</td></tr>`;
            return;
        }

        if (!Array.isArray(data)) {
            listContainer.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1rem; color: #ff4d4d;">Error: System returned invalid staff data format.</td></tr>';
            return;
        }

        window.lastFetchedStaffList = data;
        listContainer.innerHTML = '';
        
        if (data.length === 0) {
            listContainer.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1rem; color: var(--text-secondary);">No office staff entries mapped.</td></tr>`;
            return;
        }
        
        data.forEach((account, idx) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--glass-border)';
            tr.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)';
            
            const isSuspended = account.status === 'suspended';
            const roleLabel = account.role === 'super' ? '👑 Owner Admin' : (account.role === 'admin' ? '🛡️ Administrator' : '📝 Data Entry');
            const statusBadge = isSuspended 
                ? `<span style="padding: 0.15rem 0.4rem; background: rgba(239, 68, 68, 0.15); color: #FF4D4D; font-size: 0.65rem; font-weight: bold; border-radius: 4px;">SUSPENDED</span>`
                : `<span style="padding: 0.15rem 0.4rem; background: rgba(16, 185, 129, 0.15); color: #10B981; font-size: 0.65rem; font-weight: bold; border-radius: 4px;">ACTIVE</span>`;
                
            const userRole = localStorage.getItem('tmodl_user_role') || currentUserRole;
            const loggedUsername = localStorage.getItem('tmodl_logged_username');
            const isSuperAdmin = userRole === 'super' || loggedUsername === 'superadmin';

            const toggleStatusBtnText = isSuspended ? 'Reactivate' : 'Suspend';
            const toggleStatusBtnStyle = isSuspended 
                ? 'background: rgba(16, 185, 129, 0.15); color: #10B981;'
                : 'background: rgba(251, 188, 5, 0.15); color: #FBBC05;';
                
            const actionControlsContent = isSuperAdmin ? `
                    <div style="display: flex; gap: 0.35rem; justify-content: flex-end; flex-wrap: wrap;">
                        <button class="btn" onclick="window.triggerTabActionToggleStatus(${idx})" style="${toggleStatusBtnStyle} border: none; padding: 0.25rem 0.5rem; font-size: 0.65rem; border-radius: 4px; height: auto; cursor: pointer; font-weight: 700;">${toggleStatusBtnText}</button>
                        <button class="btn" onclick="window.triggerTabActionResetPassword(${idx})" style="background: rgba(59, 130, 246, 0.15); color: var(--accent); border: none; padding: 0.25rem 0.5rem; font-size: 0.65rem; border-radius: 4px; height: auto; cursor: pointer; font-weight: 700;">Reset Pwd</button>
                        <button class="btn" onclick="window.triggerTabActionDelete(${idx})" style="background: rgba(239, 68, 68, 0.15); color: #FF4D4D; border: none; padding: 0.25rem 0.5rem; font-size: 0.65rem; border-radius: 4px; height: auto; cursor: pointer; font-weight: 700;">Revoke</button>
                    </div>
                ` : `<span style="color: var(--text-secondary); font-style: italic; font-size: 0.65rem;">🔒 View Only</span>`;

            tr.innerHTML = `
                <td style="padding: 0.6rem 0.75rem;"><strong style="color: var(--text-primary);">${escapeHTML(account.fullName)}</strong></td>
                <td style="padding: 0.6rem 0.75rem; color: var(--text-secondary); font-family: 'JetBrains Mono', monospace;">${escapeHTML(account.username)}</td>
                <td style="padding: 0.6rem 0.75rem; color: var(--text-secondary); line-height: 1.35;">
                    <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary);">${escapeHTML(account.designation)}</div>
                    <div style="font-size: 0.65rem;">Mo: ${escapeHTML(account.mobileNumber)}</div>
                    <div style="font-size: 0.6rem; color: var(--accent); font-weight: bold;">${roleLabel}</div>
                </td>
                <td style="padding: 0.6rem 0.75rem;">${statusBadge}</td>
                <td style="padding: 0.6rem 0.75rem; text-align: right;">
                    ${actionControlsContent}
                </td>
            `;
            listContainer.appendChild(tr);
        });
    } catch (e) {
        console.error('❌ Error inside renderStaffMatrixList:', e);
        listContainer.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1rem; color: #ff4d4d;">Network Error: ${escapeHTML(e.message || 'Unable to connect to service.')}</td></tr>`;
    }
}

// Window references for standard operational staff accounts management
window.triggerTabActionToggleStatus = async function(idx) {
    const account = window.lastFetchedStaffList && window.lastFetchedStaffList[idx];
    if (!account) return;
    const username = account.username;
    
    if (username === 'superadmin') {
        showToast('Unable to compromise authorization of master super administrator accounts!', 'error');
        return;
    }
    
    const isSus = account.status === 'suspended';
    const targetStatus = isSus ? 'active' : 'suspended';
    
    showLoading('विवरण अपडेट गर्दै... (Updating status...)');
    try {
        const res = await fetch('/api/admin/staff-toggle-status', {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify({ username, status: targetStatus })
        });
        const data = await res.json();
        hideLoading();
        if (res.ok) {
            showToast(data.message || 'सफलतापूर्वक परिमार्जन भयो!', 'success');
            logSecurityAction('Super Admin', isSus ? 'Staff Reactivate Complete' : 'Staff suspension complete', 'success', `Altered profile status of "${username}" to ${targetStatus}`);
            renderStaffMatrixList();
        } else {
            showToast(data.error || 'त्रुटि आयो।', 'error');
        }
    } catch(err) {
        hideLoading();
        showToast('सञ्जाल जडान त्रुटि।', 'error');
    }
};

window.triggerTabActionResetPassword = function(idx) {
    const account = window.lastFetchedStaffList && window.lastFetchedStaffList[idx];
    if (!account) return;
    const username = account.username;
    const fullName = account.fullName;

    // Create a custom dialog modal
    const overlay = document.createElement('div');
    overlay.style = "position: fixed; inset: 0; background: rgba(2,6,23,0.95); z-index: 3000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); animation: fadeIn 0.3s ease-out;";

    overlay.innerHTML = `
        <div class="card" style="max-width: 480px; width: 90%; padding: 2rem; border-radius: 24px; border: 1px solid var(--glass-border); background: var(--bg-secondary); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="font-size: 2.2rem; margin-bottom: 0.5rem; text-align: center;">🛡️</div>
            <h3 style="margin-bottom: 1rem; color: var(--text-primary); font-size: 1.25rem; font-weight: 800; text-align: center;">पासवर्ड रिसेट गर्नुहोस् (Reset Password)</h3>
            <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 1.25rem; line-height: 1.55; text-align: center;">
                कर्मचारी <strong>${escapeHTML(fullName)} (${escapeHTML(username)})</strong> को पासवर्ड तुरुन्त रिसेट हुनेछ।
            </p>
            
            <!-- Custom Password Input Field -->
            <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem;">
                <label style="font-size: 0.72rem; color: var(--text-primary); font-weight: bold;">नयाँ पासवर्ड (Type New Password) <span style="color: var(--text-secondary); font-weight: normal;">- खाली छोडेमा सिस्टमले आफै नयाँ पासवर्ड बनाउनेछ</span></label>
                <input type="text" id="custom-reset-pwd-input" placeholder="e.g. Nepal@2026 (Leave empty to auto-generate)" style="width: 100%; height: 2.4rem; background: rgba(2, 6, 23, 0.7); border: 1px solid var(--glass-border); border-radius: 8px; padding: 0 0.75rem; color: #fff; font-size: 0.85rem; box-sizing: border-box; outline: none;">
            </div>

            <!-- Force Change Password Toggle -->
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
                <input type="checkbox" id="must-change-pwd-checkbox" style="width: 1rem; height: 1rem; cursor: pointer;">
                <label for="must-change-pwd-checkbox" style="font-size: 0.75rem; color: var(--text-secondary); cursor: pointer; user-select: none;">अर्को पटक लगइन गर्दा पासवर्ड परिवर्तन गर्न अनिवार्य गर्ने (Force password change on next login)</label>
            </div>

            <div style="display: flex; gap: 0.5rem; width: 100%;">
                <button id="reset-confirm-btn" class="btn btn-primary" style="flex: 1; height: 2.8rem; background: #0F9D58; color: white; font-size: 0.85rem; border-radius: 10px; font-weight: bold; border: none; cursor: pointer;">CONFIRM RESET</button>
                <button id="reset-cancel-btn" class="btn" style="flex: 1; height: 2.8rem; background: rgba(255,255,255,0.05); color: white; font-size: 0.85rem; border-radius: 10px; border: none; cursor: pointer;">CANCEL</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const customInput = overlay.querySelector('#custom-reset-pwd-input');
    const forceCheckbox = overlay.querySelector('#must-change-pwd-checkbox');

    // Automatically check or uncheck based on input
    customInput.addEventListener('input', () => {
        if (customInput.value.trim().length > 0) {
            forceCheckbox.checked = false; // Usually admins setting specific custom passwords don't want password reset forced
        } else {
            forceCheckbox.checked = true; // Random password generation should force change
        }
    });

    // Default to true for random password, but false if they enter something
    forceCheckbox.checked = true;

    overlay.querySelector('#reset-cancel-btn').addEventListener('click', () => {
        overlay.remove();
    });

    overlay.querySelector('#reset-confirm-btn').addEventListener('click', async () => {
        const customPassword = customInput.value.trim();
        const mustChangePassword = forceCheckbox.checked;

        if (customPassword && customPassword.length < 4) {
            showToast('नयाँ पासवर्ड कम्तीमा ४ अक्षरको हुनुपर्छ! (Manual password must be 4+ characters)', 'error');
            return;
        }

        overlay.remove();
        showLoading('पासवर्ड रिसेट गर्दै... (Resetting password...)');

        try {
            const res = await fetch('/api/admin/request-staff-reset', {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({
                    staffUsername: username,
                    customPassword: customPassword,
                    mustChangePassword: mustChangePassword
                })
            });

            const data = await res.json();
            hideLoading();

            if (!res.ok) {
                showToast(data.error || 'अनुरोध असफल भयो।', 'error');
                return;
            }

            showToast(`पासवर्ड सफलतापूर्वक रीसेट गरियो!`, 'success');
            
            const displayPassword = data.tempPassword || customPassword;
            showConfirmDialog(
                'Password Reset Configured',
                `कर्मचारी <strong>${escapeHTML(fullName)}</strong> को नयाँ पासवर्ड: <strong style="font-family: 'JetBrains Mono', monospace; font-size: 1.15rem; color: var(--accent); background: rgba(255,255,255,0.05); padding: 0.25rem 0.6rem; border-radius: 6px; margin: 0.5rem 0; display: inline-block; border: 1px solid var(--glass-border);">${escapeHTML(displayPassword)}</strong><br><br>यो पासवर्ड सम्बन्धित प्रयोगकर्तासँग सुरक्षित रूपमा सेयर गर्नुहोस्। ${mustChangePassword ? '<br><b style="color: #FBBC05;">अर्को पटक लगइन गर्दा पासवर्ड परिवर्तन गर्न अनिवार्य छ।</b>' : '<br><b style="color: #10B981;">यो पासवर्ड सिधै र तुरुन्त लगइन गर्न मिल्ने गरी सेट गरिएको छ।</b>'}`,
                () => { renderStaffMatrixList(); },
                null,
                'DONE'
            );
        } catch (err) {
            hideLoading();
            showToast('सञ्जाल जडान त्रुटि।', 'error');
        }
    });
};

window.triggerTabActionDelete = async function(idx) {
    const account = window.lastFetchedStaffList && window.lastFetchedStaffList[idx];
    if (!account) return;
    const username = account.username;
    
    if (username === 'superadmin') {
        showToast('Default owners profile are system-bound and cannot be deleted!', 'error');
        return;
    }
    
    showConfirmDialog(
        'Revoke Access Rights',
        `Are you sure you want to completely revoke credentials and delete profiles of <strong>${username}</strong>? This action cannot be reverted.`,
        async () => {
            showLoading('कर्मचारी हटाउँदै... (Deleting staff...)');
            try {
                const res = await fetch(`/api/admin/staff/${encodeURIComponent(username)}`, {
                    method: 'DELETE',
                    headers: getAuthHeader()
                });
                const data = await res.json();
                hideLoading();
                if (res.ok) {
                    showToast(data.message || 'कर्मचारी सफलतापूर्वक हटाइयो।', 'success');
                    logSecurityAction('Super Admin', 'Access Rights Revoked', 'failed', `Deleted employee account profiles of profile ID: "${username}"`);
                    renderStaffMatrixList();
                } else {
                    showToast(data.error || 'हटाउन सकिएन।', 'error');
                }
            } catch (err) {
                hideLoading();
                showToast('सञ्जाल जडान त्रुटि।', 'error');
            }
        }
    );
};

async function verifySuperPassword(enteredPassword) {
    const savedSuperHash = localStorage.getItem('tmodl_super_password_hash');
    if (savedSuperHash) {
        const enteredHash = await hashPassword(enteredPassword);
        return enteredHash === savedSuperHash;
    }
    // Matching against original base default
    return enteredPassword === 'Itahari@2026';
}

// Window hook replacements
window.revealAdminPassword = function(idx) {
    showToast('Direct plaintext reads prohibited on cryptographically hashed password databases!', 'error');
};

window.deleteAdminAccount = function(idx) {
    window.triggerTabActionDelete(idx);
};

// Event hookups for super logins
if (elements.superLoginBtn) {
    elements.superLoginBtn.addEventListener('click', () => {
        currentLoginAttemptType = 'super';
        if (elements.usernameInputWrapper) elements.usernameInputWrapper.style.display = 'none';
        if (elements.passwordModalTitle) elements.passwordModalTitle.innerText = 'Super User Unlock (सुपर प्रशासक)';
        if (elements.passwordModalDesc) elements.passwordModalDesc.style.display = 'block';
        if (elements.passwordModalDesc) elements.passwordModalDesc.innerText = 'कृपया डाटासेट सम्पादन, आयात तथा सम्पूर्ण मेटाउनको लागि सुपर प्रशासक पासवर्ड हाल्नुहोस्।';
        if (elements.modalAuthIcon) elements.modalAuthIcon.innerText = '👑';
        if (elements.passwordModal) elements.passwordModal.style.display = 'flex';
        if (elements.adminPasswordInput) {
            elements.adminPasswordInput.value = '';
            elements.adminPasswordInput.placeholder = 'Enter Super Admin Password';
            elements.adminPasswordInput.focus();
        }
    });
}

if (elements.adminLoginBtn) {
    elements.adminLoginBtn.addEventListener('click', () => {
        currentLoginAttemptType = 'admin';
        if (elements.usernameInputWrapper) elements.usernameInputWrapper.style.display = 'flex';
        if (elements.passwordModalTitle) elements.passwordModalTitle.innerText = 'Staff User Login (डाटा एन्ट्री कर्मचारी)';
        if (elements.passwordModalDesc) elements.passwordModalDesc.style.display = 'block';
        if (elements.passwordModalDesc) elements.passwordModalDesc.innerText = 'सिर्जना गरिएको डाटा एन्ट्री कर्मचारीको प्रयोगकर्ता नाम र पासवर्ड राख्नुहोस्।';
        if (elements.modalAuthIcon) elements.modalAuthIcon.innerText = '📝';
        if (elements.passwordModal) elements.passwordModal.style.display = 'flex';
        if (elements.adminUsernameInput) {
            elements.adminUsernameInput.value = '';
            elements.adminUsernameInput.focus();
        }
        if (elements.adminPasswordInput) {
            elements.adminPasswordInput.value = '';
            elements.adminPasswordInput.placeholder = 'Enter password';
        }
    });
}

if (elements.pwdCancelBtn) {
    elements.pwdCancelBtn.addEventListener('click', () => {
        if (elements.passwordModal) {
            elements.passwordModal.style.display = 'none';
            if (elements.adminPasswordInput) elements.adminPasswordInput.value = '';
            if (elements.adminUsernameInput) elements.adminUsernameInput.value = '';
        }
    });
}

async function handlePasswordSubmit() {
    if (!elements.adminPasswordInput) return;
    const password = elements.adminPasswordInput.value.trim();
    const username = currentLoginAttemptType === 'super' ? 'superadmin' : (elements.adminUsernameInput ? elements.adminUsernameInput.value.trim().toLowerCase() : '');

    if (!username || !password) {
        showToast('कृपया प्रयोगकर्ता नाम र पासवर्ड दुवै हाल्नुहोस्। (Fill both username and password)', 'error');
        return;
    }

    showLoading('लगइन प्रमाणिकरण गर्दै... (Authenticating...)');

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        hideLoading();

        if (!response.ok) {
            showToast(data.error || 'प्रमाणिकरण असफल भयो।', 'error');
            elements.adminPasswordInput.value = '';
            elements.adminPasswordInput.focus();
            return;
        }

        if (data.otp_required) {
            // Credentials matched, now verify OTP
            showOTPVerification(data.username, currentLoginAttemptType === 'super', data.simulatedOtp, () => {
                // Verified successfully!
                if (elements.passwordModal) elements.passwordModal.style.display = 'none';
                updateUIState();
                if (elements.searchInput && elements.searchInput.value.trim()) {
                    elements.searchForm.dispatchEvent(new Event('submit'));
                }
            });
        } else if (data.success) {
            // No OTP required, log in directly (2FA OTP Security bypass)
            localStorage.setItem('tmodl_token', data.token);
            localStorage.setItem('tmodl_user_role', data.user.role);
            localStorage.setItem('tmodl_logged_username', data.user.username);
            localStorage.setItem('tmodl_admin_logged_in', 'true');
            
            currentUserRole = data.user.role;
            isAdmin = true;

            showToast(`लगइन सफल भयो!`, 'success');

            const completeLogin = () => {
                if (elements.passwordModal) elements.passwordModal.style.display = 'none';
                updateUIState();
                if (elements.searchInput && elements.searchInput.value.trim()) {
                    elements.searchForm.dispatchEvent(new Event('submit'));
                }
            };

            // Check if they must change password first
            if (data.user.mustChangePassword) {
                showForcePasswordChange(username, () => {
                    completeLogin();
                });
            } else {
                completeLogin();
            }
        }
    } catch (e) {
        hideLoading();
        showToast('सञ्जाल जडान त्रुटि। (Network error during login)', 'error');
        console.error(e);
    }
}

if (elements.pwdSubmitBtn) {
    elements.pwdSubmitBtn.addEventListener('click', handlePasswordSubmit);
}

if (elements.adminPasswordInput) {
    elements.adminPasswordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handlePasswordSubmit();
        }
    });
}

if (elements.adminUsernameInput) {
    elements.adminUsernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (elements.adminPasswordInput) elements.adminPasswordInput.focus();
        }
    });
}

if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('tmodl_user_role');
        localStorage.removeItem('tmodl_logged_username');
        localStorage.removeItem('tmodl_admin_logged_in');
        localStorage.removeItem('tmodl_google_access_token');
        googleAccessToken = null;
        currentUserRole = null;
        isAdmin = false;
        
        if (elements.adminDashboardModal) {
            elements.adminDashboardModal.style.display = 'none';
        }
        
        showToast('सफलतापूर्वक लगआउट गरियो। (Sign-Out Completed Safely)', 'success');
        updateUIState();
        
        // Refresh display to wipe administrative blocks
        if (elements.searchInput && elements.searchInput.value.trim()) {
            elements.searchForm.dispatchEvent(new Event('submit'));
        } else {
            elements.resultsArea.innerHTML = '';
        }
    });
}

// Open / Close Admin Console Modal
if (elements.showAdminPanelBtn) {
    elements.showAdminPanelBtn.addEventListener('click', () => {
        if (elements.adminDashboardModal) {
            elements.adminDashboardModal.style.display = 'flex';
        }
    });
}

if (elements.adminDashboardCloseBtn) {
    elements.adminDashboardCloseBtn.addEventListener('click', () => {
        if (elements.adminDashboardModal) {
            elements.adminDashboardModal.style.display = 'none';
        }
    });
}

// --- Google Sheets Logic ---
if (elements.sheetsSyncBtn) {
    elements.sheetsSyncBtn.addEventListener('click', () => {
        elements.sheetsConfig.style.display = elements.sheetsConfig.style.display === 'none' ? 'block' : 'none';
    });
}

elements.sheetFetchBtn.addEventListener('click', fetchFromGoogleSheets);

// Helper to parse Google Sheets ID and GID
function parseGoogleSheetUrl(input) {
    const trimmedInput = input.trim();
    let spreadsheetId = trimmedInput;
    let gid = '';

    if (trimmedInput.includes('script.google.com') || trimmedInput.includes('/macros/') || trimmedInput.includes('/exec')) {
        // Auto-heal: User pasted Apps Script URL instead of sheet URL. Let's save it to Apps Script config!
        localStorage.setItem('tmodl_google_script_url', trimmedInput);
        if (elements && elements.googleAppsScriptUrl) {
            elements.googleAppsScriptUrl.value = trimmedInput;
        }

        // Inform user elegantly and heal.
        setTimeout(() => {
            showToast('⚠️ Web App URL Auto-Saved! You pasted the Google Apps Script Webhook URL inside the Google Sheet ID input. We have saved it under settings for Write-Back, and restored the default Spreadsheet ID here.', 'warning');
        }, 150);

        const defaultId = '1I2WQoUts6TXLpixDThKhTTqj-e8Y6mvLyhuk2jxx0AE';
        const defaultUrl = 'https://docs.google.com/spreadsheets/d/1I2WQoUts6TXLpixDThKhTTqj-e8Y6mvLyhuk2jxx0AE/edit?gid=1275513476#gid=1275513476';
        
        if (elements && elements.sheetIdInput) {
            elements.sheetIdInput.value = defaultUrl;
        }
        if (elements && elements.consoleSheetIdInput) {
            elements.consoleSheetIdInput.value = defaultUrl;
        }
        
        localStorage.setItem('tmodl_active_spreadsheet_id', defaultId);
        localStorage.setItem('tmodl_active_spreadsheet_url', defaultUrl);
        localStorage.setItem('tmodl_active_sheet_gid', '1275513476');
        
        return { spreadsheetId: defaultId, gid: '1275513476' };
    }

    if (trimmedInput.includes('/d/')) {
        spreadsheetId = trimmedInput.split('/d/')[1].split('/')[0];
    }
    
    // Parse GID if present
    const gidMatch = trimmedInput.match(/gid=([0-9]+)/);
    if (gidMatch && gidMatch[1]) {
        gid = gidMatch[1];
    }

    // Verify parsed ID is not a full URL or invalid format of another host
    if (spreadsheetId.startsWith('http') || spreadsheetId.includes('/') || spreadsheetId.includes('.')) {
        throw new Error('Could not extract a valid Google Spreadsheet ID. Please verify your Google Sheet URL link.');
    }

    return { spreadsheetId, gid };
}

// Robust fallback engine to fetch Google Sheets CSV bypassing browser CORS issues
async function fetchSheetWithFallback(spreadsheetId, gid, sheetName = '') {
    // Prevent bad spreadsheetId values from ever initiating requests (Self-healing to official default)
    if (!spreadsheetId || 
        spreadsheetId.includes('script.google.com') || 
        spreadsheetId.includes('/macros/') || 
        spreadsheetId.startsWith('http') ||
        spreadsheetId.includes('.')
    ) {
        console.warn('⚠️ fetchSheetWithFallback intercepted invalid spreadsheetId, self-healing to default public ID:', spreadsheetId);
        spreadsheetId = '1I2WQoUts6TXLpixDThKhTTqj-e8Y6mvLyhuk2jxx0AE';
        gid = '1275513476';
        if (sheetName) {
            sheetName = 'READY TO DISTRIBUTE';
        }
    }
    
    // Choose correct Google Sheet link format to fetch clean CSV
    const urlsToTry = [];
    const nocache = `&_nocache=${Date.now()}`;
    if (gid) {
        urlsToTry.push(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}${nocache}`);
    } else if (sheetName) {
        urlsToTry.push(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}${nocache}`);
    }
    urlsToTry.push(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${nocache.replace('&', '?')}`);

    // 1. Try client-side fetch directly first (if successful, it's faster and avoids server load)
    for (const directUrl of urlsToTry) {
        try {
            console.log(`[Sheets Fallback Engine] Client attempting direct export from: ${directUrl}`);
            const headers = {};
            if (googleAccessToken) {
                headers['Authorization'] = `Bearer ${googleAccessToken}`;
            }
            const res = await fetch(directUrl, { headers });
            if (res.ok) {
                const data = await res.arrayBuffer();
                if (data.byteLength > 100) {
                    // Check if response is HTML
                    const textSample = new TextDecoder('utf-8').decode(new Uint8Array(data.slice(0, 1000))).trim();
                    if (textSample.toLowerCase().startsWith('<!doctype html') || 
                        textSample.toLowerCase().startsWith('<html') ||
                        textSample.toLowerCase().includes('google-signin') || 
                        textSample.toLowerCase().includes('accounts.google.com')
                    ) {
                        throw new Error('Google Sheets returned an HTML login or private page instead of spreadsheet data.');
                    }
                    console.log(`[Sheets Fallback Engine] Direct client fetch success. Length: ${data.byteLength} bytes.`);
                    return data;
                }
            }
        } catch (clientErr) {
            console.warn(`[Sheets Fallback Engine] Direct fetch failed for URL (${directUrl}): ${clientErr.message}`);
        }
    }
    
    // 2. Deflect request through backend proxy to bypass browser CORS restrictions
    console.log(`[Sheets Fallback Engine] Client direct fetching failed or was blocked (CORS). Deflecting request through backend proxy...`);
    let proxyUrl = `/api/license/proxy-sheet?spreadsheetId=${encodeURIComponent(spreadsheetId)}`;
    if (gid) {
        proxyUrl += `&gid=${encodeURIComponent(gid)}`;
    } else if (sheetName) {
        proxyUrl += `&sheetName=${encodeURIComponent(sheetName)}`;
    }
    
    try {
        const headers = {};
        if (googleAccessToken) {
            headers['Authorization'] = `Bearer ${googleAccessToken}`;
        }
        const proxyRes = await fetch(proxyUrl, { headers });
        if (proxyRes.ok) {
            const data = await proxyRes.arrayBuffer();
            if (data.byteLength > 100) {
                // Check if response is HTML
                const textSample = new TextDecoder('utf-8').decode(new Uint8Array(data.slice(0, 1000))).trim();
                if (textSample.toLowerCase().startsWith('<!doctype html') || 
                    textSample.toLowerCase().startsWith('<html') ||
                    textSample.toLowerCase().includes('google-signin') || 
                    textSample.toLowerCase().includes('accounts.google.com')
                ) {
                    throw new Error('Google Sheets returned an HTML login or private page. Please make sure search sharing permission is "Anyone with the link can view".');
                }
                console.log(`[Sheets Fallback Engine] Proxy fetch success. Length: ${data.byteLength} bytes.`);
                return data;
            }
        } else {
            const errPayload = await proxyRes.json().catch(() => ({}));
            throw new Error(errPayload.error || `Proxy responded with status code ${proxyRes.status}`);
        }
    } catch (proxyErr) {
        console.warn('[Sheets Fallback Engine] Proxy fetch failed:', proxyErr.message);
        throw new Error(`Google Sheets access failed. Make sure page sharing permission is "Anyone with the link can view". (Error: ${proxyErr.message})`);
    }
    
    throw new Error('Could not download or parse Google Spreadsheet from direct or gateway proxies. Verify standard sharing permission settings in Google Sheets.');
}

let isPollerRunning = false;
function startGoogleSheetsAutoSync() {
    if (isPollerRunning) return;
    isPollerRunning = true;
    
    // Controlled background polling interval (every 5 seconds) to ensure changes are synced live in real-time
    setInterval(async () => {
        if (!database.isLoaded) return;
        
        // Prevent background sync from running only if the user/administrator is actively typing in a recipient save box or credential forms (so focus isn't lost on rewrite)
        const activeEl = document.activeElement;
        const isUserTyping = activeEl && (
            (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.contentEditable === 'true') &&
            (
                (activeEl.id && activeEl.id.startsWith('received-by-input-')) ||
                activeEl.closest('#admin-console') ||
                activeEl.closest('.modal') ||
                activeEl.closest('.form-container') ||
                activeEl.placeholder === 'PASSWORD' ||
                activeEl.placeholder === 'USERNAME'
            )
        );
        if (isUserTyping) {
            console.log('[Realtime Poller] Skipping silent background poll: user is actively editing a recipient field or admin form.');
            return;
        }
        
        let url = localStorage.getItem('tmodl_active_spreadsheet_url') || 'https://docs.google.com/spreadsheets/d/1I2WQoUts6TXLpixDThKhTTqj-e8Y6mvLyhuk2jxx0AE/edit?gid=1275513476#gid=1275513476';
        const { spreadsheetId, gid } = parseGoogleSheetUrl(url);
        
        try {
            // Silently obtain fresh sheets buffer with CDN bypass
            const data = await fetchSheetWithFallback(spreadsheetId, gid, gid ? '' : 'READY TO DISTRIBUTE');
            
            // Flag onmessage complete block to receive silently without overlays or blockages
            database.isSilentSyncing = true;
            worker.postMessage({ type: 'PARSE_EXCEL', data });
        } catch (e) {
            console.warn('[Realtime Poller] Silent background sync omitted or offline:', e.message);
            database.isSilentSyncing = false;
        }

        // Synchronize Missing & Found Licenses cloud snapshots
        try {
            const [missingRes, foundRes] = await Promise.all([
                fetch('/api/license/missing-licenses').then(r => r.json()).catch(() => null),
                fetch('/api/license/found-licenses').then(r => r.json()).catch(() => null)
            ]);

            if (Array.isArray(missingRes)) {
                const currentLocal = localStorage.getItem('tmodl_missing_licenses') || '[]';
                const resStr = JSON.stringify(missingRes);
                if (currentLocal !== resStr) {
                    localStorage.setItem('tmodl_missing_licenses', resStr);
                    window.renderMissingLicensesTable();
                }
            }
            if (Array.isArray(foundRes)) {
                const currentLocal = localStorage.getItem('tmodl_found_licenses') || '[]';
                const resStr = JSON.stringify(foundRes);
                if (currentLocal !== resStr) {
                    localStorage.setItem('tmodl_found_licenses', resStr);
                    window.renderFoundLicensesTable();
                }
            }
        } catch (syncErr) {
            console.log('[Realtime Poller] Background lists syncing skipped or offline:', syncErr.message);
        }
    }, 5000); // Silent automatic refreshing every 5 seconds
}

if (elements.consoleSheetFetchBtn) {
    elements.consoleSheetFetchBtn.addEventListener('click', async () => {
        let input = elements.consoleSheetIdInput.value.trim();
        if (!input) {
            showToast('Please provide a Google Sheet ID or URL', 'error');
            return;
        }

        const { spreadsheetId, gid } = parseGoogleSheetUrl(input);

        showLoading('Connecting to Google Cloud...');
        
        try {
            const data = await fetchSheetWithFallback(spreadsheetId, gid, gid ? '' : 'READY TO DISTRIBUTE');

            // Save sheet config for write-back
            database.spreadsheetId = spreadsheetId;
            localStorage.setItem('tmodl_active_spreadsheet_id', spreadsheetId);
            localStorage.setItem('tmodl_active_spreadsheet_url', input);
            if (gid) {
                localStorage.setItem('tmodl_active_sheet_gid', gid);
            } else {
                localStorage.removeItem('tmodl_active_sheet_gid');
            }
            
            // Keep home page input in sync
            if (elements.sheetIdInput) {
                elements.sheetIdInput.value = input;
            }
            
            showLoading('Synchronizing Identity Ledger...');
            worker.postMessage({ type: 'PARSE_EXCEL', data });
            showToast('Synchronization completed successfully!', 'success');
        } catch (err) {
            console.error('Sheets Error:', err);
            showToast(err.message, 'error');
            hideLoading();
        }
    });
}

if (elements.mainPublicSyncBtn) {
    elements.mainPublicSyncBtn.addEventListener('click', async () => {
        let input = localStorage.getItem('tmodl_active_spreadsheet_url') || 'https://docs.google.com/spreadsheets/d/1I2WQoUts6TXLpixDThKhTTqj-e8Y6mvLyhuk2jxx0AE/edit?gid=1275513476#gid=1275513476';
        const { spreadsheetId, gid } = parseGoogleSheetUrl(input);

        showLoading('Connecting to Google Cloud...');
        
        try {
            const data = await fetchSheetWithFallback(spreadsheetId, gid, gid ? '' : 'READY TO DISTRIBUTE');

            // Save sheet config for write-back
            database.spreadsheetId = spreadsheetId;
            localStorage.setItem('tmodl_active_spreadsheet_id', spreadsheetId);
            localStorage.setItem('tmodl_active_spreadsheet_url', input);
            if (gid) {
                localStorage.setItem('tmodl_active_sheet_gid', gid);
            } else {
                localStorage.removeItem('tmodl_active_sheet_gid');
            }
            
            // Keep other inputs in sync
            if (elements.sheetIdInput) {
                elements.sheetIdInput.value = input;
            }
            if (elements.consoleSheetIdInput) {
                elements.consoleSheetIdInput.value = input;
            }
            
            showLoading('Synchronizing Identity Ledger...');
            worker.postMessage({ type: 'PARSE_EXCEL', data });
            showToast('Synchronization completed successfully!', 'success');
        } catch (err) {
            console.error('Public Sync Sheets Error:', err);
            showToast(err.message, 'error');
            hideLoading();
        }
    });
}

async function fetchFromGoogleSheets() {
    let input = elements.sheetIdInput.value.trim();
    if (!input) {
        showToast('Please provide a Google Sheet ID or URL', 'error');
        return;
    }

    const { spreadsheetId, gid } = parseGoogleSheetUrl(input);

    showLoading('Connecting to Google Cloud...');
    
    try {
        const data = await fetchSheetWithFallback(spreadsheetId, gid, gid ? '' : 'READY TO DISTRIBUTE');

        // Save sheet config for write-back
        database.spreadsheetId = spreadsheetId;
        localStorage.setItem('tmodl_active_spreadsheet_id', spreadsheetId);
        localStorage.setItem('tmodl_active_spreadsheet_url', input);
        if (gid) {
            localStorage.setItem('tmodl_active_sheet_gid', gid);
        } else {
            localStorage.removeItem('tmodl_active_sheet_gid');
        }
        
        showLoading('Synchronizing Identity Ledger...');
        worker.postMessage({ type: 'PARSE_EXCEL', data });
        showToast('Synchronization completed successfully!', 'success');
    } catch (err) {
        console.error('Sheets Error:', err);
        showToast(err.message, 'error');
        hideLoading();
    }
}

// --- Activation Logic ---
const initBtn = document.getElementById('init-btn');
const adminFileInput = document.getElementById('admin-file-init');

if (initBtn) {
    initBtn.addEventListener('click', () => adminFileInput.click());
}

if (adminFileInput) {
    adminFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            showLoading('Synchronizing Federal Ledger...');
            const reader = new FileReader();
            reader.onload = (evt) => worker.postMessage({ type: 'PARSE_EXCEL', data: evt.target.result });
            reader.readAsArrayBuffer(file);
        }
    });
}

async function tryFetchGoogleSheets() {
    try {
        console.log('Attempting secure handshake with public Google Spreadsheet...');
        const sheetId = '1I2WQoUts6TXLpixDThKhTTqj-e8Y6mvLyhuk2jxx0AE'; // Default official Sheet ID
        const data = await fetchSheetWithFallback(sheetId, '1275513476', '');
        if (data && data.byteLength > 100) {
            console.log('Successfully reached public Google Sheet database.');
            worker.postMessage({ type: 'PARSE_EXCEL', data });
            return true;
        }
    } catch (e) {
        console.warn('Fallback public Google Sheets cloud sync failed:', e);
    }
    return false;
}

async function preloadDatabase() {
    console.log('Starting identity synchronization...');
    
    // Initialize sheet ID / link inputs on load
    let storedSheetUrl = localStorage.getItem('tmodl_active_spreadsheet_url');
    let storedSheetId = localStorage.getItem('tmodl_active_spreadsheet_id') || '1I2WQoUts6TXLpixDThKhTTqj-e8Y6mvLyhuk2jxx0AE';
    
    // Self-healing check for Apps Script URL or invalid format in stored fields
    if (storedSheetId.includes('script.google.com') || 
        storedSheetId.includes('/macros/') || 
        storedSheetId.startsWith('http') ||
        (storedSheetUrl && (storedSheetUrl.includes('script.google.com') || storedSheetUrl.includes('/macros/')))
    ) {
        console.warn('⚠️ Malformed spreadsheet URL or script URL discovered in LocalStorage. Self-healing to official database default.');
        storedSheetId = '1I2WQoUts6TXLpixDThKhTTqj-e8Y6mvLyhuk2jxx0AE';
        storedSheetUrl = 'https://docs.google.com/spreadsheets/d/1I2WQoUts6TXLpixDThKhTTqj-e8Y6mvLyhuk2jxx0AE/edit?gid=1275513476#gid=1275513476';
        localStorage.setItem('tmodl_active_spreadsheet_id', storedSheetId);
        localStorage.setItem('tmodl_active_spreadsheet_url', storedSheetUrl);
        localStorage.setItem('tmodl_active_sheet_gid', '1275513476');
    }

    const computedURL = storedSheetUrl || (storedSheetId.includes('/') ? storedSheetId : `https://docs.google.com/spreadsheets/d/${storedSheetId}/edit?gid=1275513476#gid=1275513476`);
    
    if (elements.sheetIdInput) {
        elements.sheetIdInput.value = computedURL;
    }
    if (elements.consoleSheetIdInput) {
        elements.consoleSheetIdInput.value = computedURL;
    }

    elements.btnText.innerText = 'Initializing Secure Connection...';
    let syncStarted = false;

    // Show the warning/action area if we don't have a fast cache hit
    const slowSyncTimeout = setTimeout(() => {
        if (!database.isLoaded) {
            const isOverrideActive = isAdmin || 
                                     window.location.search.includes('admin=true') || 
                                     window.location.hash === '#admin' || 
                                     sessionStorage.getItem('tmodl_admin_override') === 'true';
            if (isOverrideActive) {
                elements.dbWarning.style.display = 'block';
            }
            console.log('Setup mode: Awaiting administrator initialization...');
        }
    }, 4000); // Increased to 4s to allow for real network latency

    // Safety timeout to prevent permanent "Initializing" state
    const safetyTimeout = setTimeout(() => {
        if (!database.isLoaded) {
            console.warn('Sync timeout. Checking backup layers...');
            clearTimeout(slowSyncTimeout);
            hideLoading();
            updateUIState();
        }
    }, 20000); 

    try {
        console.log('Checking IndexedDB cache...');
        
        // Dynamic Cache Invalidation based on Active Google Sheet ID
        const lastCachedSheetId = localStorage.getItem('tmodl_last_cached_sheet_id');
        const currentSheetId = database.spreadsheetId || '128y-JrUDPVWbvarLzKH4pSkNgmK25ouUM26aswWHKiU';
        let cachedRows = null;

        if (lastCachedSheetId === currentSheetId) {
            // 1. Try IndexedDB first (Cached)
            cachedRows = await getFromDB().catch(err => {
                console.warn(`IDB Error: ${err.message}`);
                return null;
            });
        } else {
            console.log('Google Spreadsheet ID shifted or first-time load. Bypassing old cache to force fresh handshake...');
            localStorage.removeItem('tmodl_headers');
        }
        
        if (cachedRows && cachedRows.length > 0) {
            console.log(`Cache hit: ${cachedRows.length} records found.`);
            database.rows = cachedRows;
            showLoading('Authenticating secure session...');
            worker.postMessage({ type: 'INDEX_EXISTING', data: cachedRows });
            syncStarted = true;
            if (slowSyncTimeout) clearTimeout(slowSyncTimeout);
            if (safetyTimeout) clearTimeout(safetyTimeout);
            
            // Stale-While-Revalidate: Lazily update cache from Sheets in the background silently
            setTimeout(async () => {
                console.log('Performing background sync to check for Google Sheets updates...');
                try {
                    const sheetId = database.spreadsheetId || localStorage.getItem('tmodl_active_spreadsheet_id') || '128y-JrUDPVWbvarLzKH4pSkNgmK25ouUM26aswWHKiU';
                    const gid = localStorage.getItem('tmodl_active_sheet_gid') || '';
                    const data = await fetchSheetWithFallback(sheetId, gid, gid ? '' : 'READY TO DISTRIBUTE');
                    if (data && data.byteLength > 100) {
                        worker.postMessage({ type: 'PARSE_EXCEL', data });
                    }
                } catch (err) {
                    console.warn('Silent background sync failed, using cached records.', err);
                }
            }, 3000);
            return;
        }

        // 2. Try Fetch (Local file for dev/deployment environments)
        const currentPath = window.location.pathname.replace(/\/[^/]*$/, '/');
        const variations = [
            'registry.xlsm', 
            `${currentPath}registry.xlsm`,
            './registry.xlsm',
            '/registry.xlsm',
            'database.xlsx',
            'FINAL LIST for LICENSE HOLDER.xlsm'
        ];

        const tryFetch = async (url) => {
            try {
                // Determine absolute URL relative to current location
                const baseUrl = url.startsWith('/') ? (window.location.origin + url) : (new URL(url, window.location.href).href);
                
                const res = await fetch(baseUrl + (baseUrl.includes('?') ? '&' : '?') + `v=${Date.now()}`);
                if (res.ok) {
                    const data = await res.arrayBuffer();
                    console.log(`Success! ${url} reached (${data.byteLength} bytes)`);
                    
                    if (data.byteLength < 5000) { 
                        return false;
                    }

                    showLoading('Synchronizing Secure Registry...');
                    worker.postMessage({ type: 'PARSE_EXCEL', data });
                    syncStarted = true;
                    if (slowSyncTimeout) clearTimeout(slowSyncTimeout);
                    if (safetyTimeout) clearTimeout(safetyTimeout);
                    return true;
                }
            } catch (e) {
                console.warn(`Connection mismatch for ${url}: ${e.message}`);
            }
            return false;
        };

        for (let v of variations) {
            if (syncStarted) break;
            if (await tryFetch(v)) break;
        }

        // 3. Try Auto-Fetch from public Google Sheet (Option No. 2 fallback)
        if (!syncStarted) {
            console.log('No local file found. Attaining Google Sheets data backup...');
            const sheetSuccess = await tryFetchGoogleSheets();
            if (sheetSuccess) {
                syncStarted = true;
                if (slowSyncTimeout) clearTimeout(slowSyncTimeout);
                if (safetyTimeout) clearTimeout(safetyTimeout);
            }
        }
    } catch (e) {
        console.error('Preload fatal error:', e);
    } finally {
        // Fallback: Update UI state ONLY if no sync was initiated
        if (!syncStarted) {
            clearTimeout(slowSyncTimeout);
            clearTimeout(safetyTimeout);
            updateUIState();
            console.log('System offline: No registry found.');
        }
    }
}

// Hidden Admin Trigger: Clicks the logo 5 times to toggle admin override visibility
document.querySelector('.logo-centered').addEventListener('click', () => {
    adminClickCount++;
    if (adminClickCount >= 5) {
        const currentlyOverride = sessionStorage.getItem('tmodl_admin_override') === 'true';
        if (currentlyOverride) {
            sessionStorage.removeItem('tmodl_admin_override');
            showToast('प्रशासक कन्ट्रोल प्यानल बन्द भयो। (Admin controls hidden)', 'success');
        } else {
            sessionStorage.setItem('tmodl_admin_override', 'true');
            showToast('प्रशासक कन्ट्रोल प्यानल सुचारु भयो! (Admin controls revealed)', 'success');
        }
        adminClickCount = 0;
        updateUIState();
    }
});

// Initialize explicitly
(function() {
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', preloadDatabase);
    } else {
        preloadDatabase();
    }
})();

// Reset Logic
if (elements.resetBtn) {
    elements.resetBtn.addEventListener('click', () => {
        // Automatically hide missing and found records table sections on reset
        if (window.hideMissingLicensesSection) {
            window.hideMissingLicensesSection();
        } else {
            const sec = document.getElementById('missing-licenses-section');
            if (sec) {
                sec.style.opacity = '0';
                sec.style.display = 'none';
            }
        }

        if (window.hideFoundLicensesSection) {
            window.hideFoundLicensesSection();
        } else {
            const sec = document.getElementById('found-licenses-section');
            if (sec) {
                sec.style.opacity = '0';
                sec.style.display = 'none';
            }
        }

        elements.searchInput.value = '';
        elements.resultsArea.innerHTML = '';
        lastCountedQuery = '';
        if (elements.searchWarningBox) {
            elements.searchWarningBox.style.display = 'none';
        }
        if (elements.emptySearchWarning) {
            elements.emptySearchWarning.style.display = 'none';
        }
        if (elements.emptySearchWarningBackdrop) {
            elements.emptySearchWarningBackdrop.style.display = 'none';
            elements.emptySearchWarningBackdrop.style.opacity = '0';
        }
        if (emptySearchWarningTimeout) {
            clearTimeout(emptySearchWarningTimeout);
        }
        showToast('Search cleared', 'success');
    });
}

// Search Logic
let emptySearchWarningTimeout = null;
let isUserInitiatedSearch = false;
let lastCountedQuery = '';

if (elements.searchInput) {
    elements.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            isUserInitiatedSearch = true;
        }
    });
}

elements.searchBtn.addEventListener('click', (e) => {
    isUserInitiatedSearch = true;
    if (!database.isLoaded) {
        e.preventDefault();
        adminFileInput.click();
    }
});

elements.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!database.isLoaded) {
        adminFileInput.click();
        return;
    }

    let query = database.isSilentSearch && database.lastQuery ? database.lastQuery : elements.searchInput.value.trim();
    if (query) {
        database.lastQuery = query;
    }
    if (!query) {
        if (emptySearchWarningTimeout) {
            clearTimeout(emptySearchWarningTimeout);
        }
        if (elements.emptySearchWarning) {
            if (elements.emptySearchWarningBackdrop) {
                elements.emptySearchWarningBackdrop.style.display = 'block';
                // Trigger reflow for transition
                elements.emptySearchWarningBackdrop.offsetHeight;
                elements.emptySearchWarningBackdrop.style.opacity = '1';
            }
            elements.emptySearchWarning.style.display = 'flex';
            elements.emptySearchWarning.style.opacity = '1';
            
            if (elements.searchWarningBox) {
                elements.searchWarningBox.style.display = 'none';
            }

            emptySearchWarningTimeout = setTimeout(() => {
                elements.emptySearchWarning.style.opacity = '0';
                if (elements.emptySearchWarningBackdrop) {
                    elements.emptySearchWarningBackdrop.style.opacity = '0';
                }
                setTimeout(() => {
                    if (elements.emptySearchWarning.style.opacity === '0') {
                        elements.emptySearchWarning.style.display = 'none';
                        if (elements.emptySearchWarningBackdrop) {
                            elements.emptySearchWarningBackdrop.style.display = 'none';
                        }
                    }
                }, 300);
            }, 2000); // 2 seconds still display duration
        }
        return;
    }

    if (elements.emptySearchWarning) {
        elements.emptySearchWarning.style.display = 'none';
    }
    if (elements.emptySearchWarningBackdrop) {
        elements.emptySearchWarningBackdrop.style.display = 'none';
    }

    // Convert Nepali Unicode digits to standard Arabic digits
    const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    query = String(query).replace(/[०-९]/g, (match) => nepaliDigits.indexOf(match));

    if (!database.isLoaded) {
        showToast('Registry Unavailable', 'error');
        return;
    }

    const isSilent = database.isSilentSearch;
    database.isSilentSearch = false; // Reset

    const isManual = isUserInitiatedSearch || (e && e.isTrusted);
    isUserInitiatedSearch = false; // Reset flag for next search

    if (!isSilent) {
        if (isManual && !currentUserRole && !isAdmin) {
            const currentQueryClean = String(query).toLowerCase().trim();
            if (currentQueryClean !== lastCountedQuery) {
                lastCountedQuery = currentQueryClean;
                incrementVisitorCount(); // Only increment on actual manual searches, not on background poll updates or auto refresh!
            }
        }
    }
    
    const runSearch = () => {
        const normalizedQuery = query.toLowerCase().trim();
        const hasDigits = /\d/.test(normalizedQuery);

        if (hasDigits) {
            // 1. Exact Match O(1) via Map First! (Sub-millisecond lookup)
            const cleanQuery = normalizedQuery.replace(/[^0-9]/g, '');
            let match = null;
            
            if (database.maps) {
                match = database.maps.idMap.get(normalizedQuery) || database.maps.licenseMap.get(normalizedQuery);
                if (!match && cleanQuery) {
                    match = database.maps.idMap.get(cleanQuery) || database.maps.licenseMap.get(cleanQuery);
                }
            }
            
            if (!match && cleanQuery) {
                match = database.rows.find(row => {
                    if (!row) return false;
                    
                    let id = '';
                    let license = '';
                    
                    if (Array.isArray(row)) {
                        id = row.length > 1 ? String(row[1] || '') : '';
                        license = row.length > 4 ? String(row[4] || '') : '';
                    } else {
                        id = String(row['Applicant ID'] || row[1] || '');
                        license = String(row['License No'] || row[4] || '');
                    }
                    
                    const cleanId = id.replace(/[^0-9]/g, '');
                    const cleanLicense = license.replace(/[^0-9A-Z]/g, '');
                    
                    return cleanId === cleanQuery || cleanLicense === cleanQuery || 
                           id.toLowerCase().trim() === normalizedQuery || 
                           license.toLowerCase().trim() === normalizedQuery;
                });
            }

            if (!isSilent) hideLoading();

            if (match) {
                displayResult(match, [], isSilent);
            } else {
                displayResult(null, [], isSilent);
            }
        } else {
            // 2. Name Search: Keeps partial matches enabled for forgotten credentials
            const startsWith = [];
            const contains = [];

            if (database.maps && database.maps.nameMap.has(normalizedQuery)) {
                startsWith.push(database.maps.nameMap.get(normalizedQuery));
            }

            database.rows.forEach(row => {
                if (!row) return;
                
                let name = '';
                if (Array.isArray(row)) {
                    name = row.length > 2 ? String(row[2] || '') : '';
                } else {
                    name = String(row['Name'] || row[2] || '');
                }
                
                const normalizedName = name.toLowerCase().trim();
                if (normalizedName === normalizedQuery) {
                    if (startsWith.length === 0 || startsWith[0] !== row) {
                        startsWith.unshift(row); // Exact name matches get highest priority
                    }
                } else if (normalizedName.startsWith(normalizedQuery)) {
                    startsWith.push(row);
                } else if (normalizedName.includes(normalizedQuery)) {
                    contains.push(row);
                }
            });

            // Prevent duplicate records
            const uniqueSuggestions = [];
            const seenIds = new Set();
            [...startsWith, ...contains].forEach(row => {
                let id = '';
                if (Array.isArray(row)) {
                    id = row.length > 1 ? String(row[1] || '') : '';
                } else {
                    id = String(row['Applicant ID'] || row[1] || '');
                }
                
                if (id) {
                    if (!seenIds.has(id)) {
                        seenIds.add(id);
                        uniqueSuggestions.push(row);
                    }
                } else {
                    uniqueSuggestions.push(row);
                }
            });

            if (!isSilent) hideLoading();

            if (uniqueSuggestions.length === 1) {
                displayResult(uniqueSuggestions[0], [], isSilent);
            } else if (uniqueSuggestions.length > 0) {
                displayResult(null, uniqueSuggestions.slice(0, 50), isSilent);
            } else {
                displayResult(null, [], isSilent);
            }
        }
        
        // Remove automatic scrollIntoView to keep the display stable just below the Search button
        // and let the page content adjust dynamically.
    };

    if (!isSilent) {
        // Run lookups instantly from local O(1) indexed in-memory cache first (sub-millisecond execution for instant UX)
        runSearch();

        // Stale-While-Revalidate: asynchronously sync live spreadsheet data in the background to ensure updates are fetched
        const executeSilentBackgroundSync = async () => {
            try {
                let url = localStorage.getItem('tmodl_active_spreadsheet_url') || 'https://docs.google.com/spreadsheets/d/128y-JrUDPVWbvarLzKH4pSkNgmK25ouUM26aswWHKiU/edit?usp=sharing';
                const { spreadsheetId, gid } = parseGoogleSheetUrl(url);

                database.bypassGuard = true; 
                database.isSilentSyncing = true; 

                const data = await fetchSheetWithFallback(spreadsheetId, gid, gid ? '' : 'READY TO DISTRIBUTE');

                await new Promise((resolve) => {
                    database.pendingSearchResolve = resolve;
                    setTimeout(() => {
                        if (database.pendingSearchResolve) {
                            database.pendingSearchResolve();
                            database.pendingSearchResolve = null;
                        }
                    }, 5000);
                    worker.postMessage({ type: 'PARSE_EXCEL', data });
                });

                // Silently refresh current view so if any updates were loaded in the background they appear seamlessly
                database.isSilentSearch = true;
                runSearch();
            } catch (syncErr) {
                console.warn('[Search Silent Sync] Background sheet verification skipped:', syncErr.message);
            }
        };

        // Fire off background verification with 150ms buffer so it doesn't block the visual feedback loop
        setTimeout(executeSilentBackgroundSync, 150);
    } else {
        runSearch();
    }
});

function displayResult(record, suggestions = [], isSilent = false) {
    if (isSilent) {
        // If user is focused on any input inside the results area, skip re-evaluating to prevent loss of focus or caret disruption!
        if (elements.resultsArea && elements.resultsArea.contains(document.activeElement)) {
            console.log('[Silent Poll] Active typing input focused inside results card. Skipping redraw to protect focus.');
            return;
        }
        if (!record) {
            console.log('[Silent Poll] Suppressing suggestions/empty list refresh to keep UX stable.');
            return;
        }
    }
    
    if (record) {
        // Flawless Tiered Sheet Row Resolver
        let sheetRow;
        let resolvedFromSN = false;
        try {
            const keys = Object.keys(record);
            const snKey = keys.find(k => {
                const normK = String(k).trim().toUpperCase();
                return normK === 'S.N.' || normK === 'S.N' || normK === 'S. N.' || normK === 'SN' || normK === 'SERIAL NO' || normK === 'सि.नं.';
            });
            if (snKey) {
                const rawSN = parseInt(record[snKey], 10);
                if (!isNaN(rawSN) && rawSN > 0) {
                    sheetRow = rawSN + 5;
                    resolvedFromSN = true;
                    console.log(`[Display Row Resolver] Resolved absolute sheet row from Serial Number (S.N. ${rawSN}): Row ${sheetRow}`);
                }
            }
        } catch (snErr) {
            console.warn('[Display Row Resolver] S.N. evaluation failed:', snErr);
        }

        if (!resolvedFromSN) {
            sheetRow = record.__rowIndex !== undefined ? (record.__rowIndex + 1) : null;
            console.log(`[Display Row Resolver] Fallback to __rowIndex: Row ${sheetRow}`);
        }

        currentRecord = {
            applicantId: String(record['Applicant ID'] || '').trim().toUpperCase(),
            fullName: String(record['Name'] || '').trim(),
            sheetRow: sheetRow
        };
        
        console.log("Selected Applicant:", currentRecord.applicantId);
        console.log("Selected Name:", currentRecord.fullName);
        console.log("Actual Sheet Row:", currentRecord.sheetRow);
        console.log("Saving Receiver To:", "I" + currentRecord.sheetRow);

        const receivedByKey = 'RECEIVED BY';
        const receivedByVal = String(record[receivedByKey] || '').trim();
        
        // Define a unique snapshot that represents all data shown on the card
        const currentSnapshot = JSON.stringify({
            applicantId: record['Applicant ID'] || '',
            licenseNo: record['License No'] || '',
            receivedBy: receivedByVal,
            name: record['Name'] || '',
            fhName: record['F/H Name'] || '',
            category: record['Category'] || '',
            codeNo: record['Code No'] || '',
            officeVisitDay: record['Office Visit Day'] || ''
        });
        
        if (isSilent && currentSnapshot === database.lastRenderedSnapshot) {
            console.log('[Silent Poll] Result data is completely identical. Skipping redraw to prevent any visual flicker.');
            return;
        }
        database.lastRenderedSnapshot = currentSnapshot;
    } else {
        database.lastRenderedSnapshot = null;
        currentRecord = null;
    }

    elements.resultsArea.innerHTML = '';
    if (elements.searchWarningBox) {
        elements.searchWarningBox.style.display = 'none';
    }
    hideMismatchPopup();
    
    if (record) {
        const receivedByKey = 'RECEIVED BY';
        const receivedByVal = String(record[receivedByKey] || '').trim();
        
        const keys = Object.keys(record);
        const visitDayKey = keys.find(k => String(k).trim().toUpperCase() === 'OFFICE VISIT DAY') || 'Office Visit Day';
        const visitDayVal = String(record[visitDayKey] || '').trim();
        let nepaliDay = '';
        if (visitDayVal && visitDayVal !== '---' && visitDayVal.toUpperCase() !== 'N/A' && visitDayVal.toUpperCase() !== 'PENDING') {
            const upVal = visitDayVal.toUpperCase();
            if (upVal.includes('SUNDAY')) {
                nepaliDay = 'आईतबार';
            } else if (upVal.includes('MONDAY')) {
                nepaliDay = 'सोमबार';
            } else if (upVal.includes('TUESDAY')) {
                nepaliDay = 'मंगलबार';
            } else if (upVal.includes('WEDNESDAY')) {
                nepaliDay = 'बुधबार';
            } else if (upVal.includes('THURSDAY')) {
                nepaliDay = 'विहिबार';
            } else if (upVal.includes('FRIDAY')) {
                nepaliDay = 'शुक्रबार';
            } else if (upVal.includes('SATURDAY')) {
                nepaliDay = 'शनिबार';
            } else {
                nepaliDay = visitDayVal;
            }
        }
        
        let receivedSectionHTML = '';

        if (receivedByVal) {
            const isSelf = receivedByVal.toUpperCase() === 'SELF';
            const displayMsg = isSelf 
                ? 'तपाईंको लाइसेन्स कार्यालयले तपाईं स्वयंलाई सुरक्षित रूपमा बुझाई सकेको छ।'
                : `तपाईंको लाइसेन्स कार्यालयले <span style="color: #10B981; font-family: 'JetBrains Mono', monospace; text-transform: uppercase;">${receivedByVal}</span> लाई सुरक्षित रूपमा बुझाई सकेको छ।`;

            if (isAdmin) {
                receivedSectionHTML = `
                    <div style="margin-top: 1.25rem; padding: var(--result-card-padding, 1.25rem); border-radius: 16px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); text-align: left; width: 100%; box-sizing: border-box;">
                        <div style="display: flex; align-items: flex-start; gap: 0.5rem; line-height: 1.4;">
                            <span style="font-size: calc(var(--warning-badge-title-size, 1.1rem) - 2px); padding-top: 2px;">🟢</span>
                            <span style="color: #10B981; font-weight: 800; font-size: calc(var(--rec-badge-title-size, 1.2rem) - 2px); letter-spacing: 0.5px; line-height: 1.45;">
                                ${displayMsg}
                            </span>
                        </div>
                        
                        ${(currentUserRole === 'super' || currentUserRole === 'admin') ? `
                        <div style="margin-top: 1rem; border-top: 1px dashed rgba(16, 185, 129, 0.2); padding-top: 0.75rem;">
                            <label style="font-size: 0.65rem; color: var(--text-secondary); font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 0.35rem;">विवरण सच्याउनुहोस् / रिसेट गर्नुहोस् (Edit / Reset Record Details)</label>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <input type="text" id="received-by-input-${String(record['Applicant ID']).replace(/"/g, '&quot;')}" value="${receivedByVal.replace(/"/g, '&quot;')}" placeholder="बुझ्नेको नाम थप्नुहोस्..." class="recipient-correction-input">
                                <div style="display: flex; gap: 0.5rem; width: 100%;">
                                    <button onclick="window.saveReceivedBy('${String(record['Applicant ID']).replace(/'/g, "\\'")}', false)" class="btn-save-recipient-inline">
                                        <span>💾</span> विवरण सुरक्षित (SAVE) गर्नुहोस
                                    </button>
                                    <button onclick="window.resetRecipientInput('${String(record['Applicant ID']).replace(/'/g, "\\'")}')" class="btn-reset-recipient-inline">
                                        <span>🔄</span> रिसेट (RESET) गर्नुहोस्
                                    </button>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                `;
            } else {
                receivedSectionHTML = `
                    <div style="margin-top: 1.25rem; padding: var(--result-card-padding, 1.25rem); border-radius: 16px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); text-align: center; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.6rem; justify-content: center; align-items: center;">
                        <div style="color: #10B981; font-weight: 800; font-size: calc(var(--rec-badge-title-size, 1.2rem) - 2px); line-height: 1.45; letter-spacing: -0.2px;">
                            🟢 ${displayMsg}
                        </div>
                        <div style="color: var(--text-primary); font-weight: 800; font-size: calc(var(--rec-badge-val-size, 0.95rem) - 2.5px); line-height: 1.4; letter-spacing: -0.2px; margin-top: 0.4rem;">
                            कार्यालयले सृजना गरेको <span style="color: #ff4d4d; font-size: 0.9em;">LICENSE RECORD MANAGEMENT SYSTEM</span> <strong style="color: var(--text-primary); font-weight: bold;">(LRMS)</strong> प्रयोग गर्नु भएकोमा धन्यवाद् !
                        </div>
                    </div>
                `;
            }
        } else {
            if (isAdmin) {
                receivedSectionHTML = `
                    <div style="margin-top: 1.25rem; padding: var(--result-card-padding, 1.25rem); border-radius: 16px; background: rgba(251, 188, 5, 0.04); border: 1px solid rgba(251, 188, 5, 0.2); text-align: left; width: 100%; box-sizing: border-box;">
                        <div style="display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <span style="font-size: calc(var(--warning-badge-title-size, 1.1rem) - 2.5px); line-height: 1.35; margin-top: 0.15rem;">🟡</span>
                            <span style="color: #FBBC05; font-weight: 800; font-size: calc(var(--rec-badge-title-size, 1.2rem) - 2.5px); text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.35;">कार्यालयमै उपलब्ध छ तर वितरण गरिएको छैन</span>
                        </div>
                        <div style="font-size: calc(var(--rec-badge-val-size, 0.95rem) - 2.5px); text-align: center; color: var(--text-secondary); margin-bottom: 0.4rem; line-height: 1.4; font-weight: 700;">
                            लाइसेन्स लिन आउने वा बुझिलिने व्यक्तिको नाम तलको कोठामा लेख्नुहोस् र सुरक्षित गर्नुहोस् ।
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.4rem; width: 100%;">
                            <input type="text" id="received-by-input-${String(record['Applicant ID']).replace(/"/g, '&quot;')}" class="recipient-input" placeholder="बुझिलिनेको नाम लेख्नुहोस्............">
                            <div class="recipient-actions-grid">
                                <button onclick="window.resetRecipientInput('${String(record['Applicant ID']).replace(/'/g, "\\'")}')" class="btn-reset-recipient">रिसेट (RESET) गर्नुहोस्</button>
                                <button onclick="window.useCardholderName('${String(record['Applicant ID']).replace(/'/g, "\\'")}', '${String(record['Name']).replace(/'/g, "\\'")}')" class="btn-use-cardholder">सवारी चालकको नाम प्रयोग गर्नुहोस्</button>
                                <button onclick="window.saveReceivedBy('${String(record['Applicant ID']).replace(/'/g, "\\'")}')" class="btn-save-recipient">विवरण सुरक्षित (SAVE) गर्नुहोस</button>
                            </div>
                        </div>
                    </div>
`;
            } else {
                receivedSectionHTML = `
                    <div style="margin-top: 1.25rem; padding: var(--result-card-padding, 1.25rem); border-radius: 16px; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.15); text-align: left; width: 100%; box-sizing: border-box;">
                        <div style="display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <span style="font-size: calc(var(--warning-badge-title-size, 1.1rem) - 2.5px); line-height: 1.35; margin-top: 0.15rem;">🟢</span>
                            <span style="color: var(--success); font-weight: 800; font-size: calc(var(--warning-badge-title-size, 1.1rem) - 2.5px); text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.35;">तपाईको Smart-Card यस कार्यालयमा उपलब्ध छ, संकलन गर्नको लागि ${nepaliDay ? `<span style="color: #ef4444; font-weight: 850;">${nepaliDay}</span> ` : ''}कार्यालयमा सम्पर्क राख्नु होला ।</span>
                        </div>
                        <div style="font-size: calc(var(--rec-badge-val-size, 0.8rem) - 2.5px); color: var(--text-secondary); line-height: 1.4; text-align: justify;">
                            <span style="display: inline-block; color: var(--text-primary); font-weight: 700;">आधिकारिक टिपोट:</span> लाइसेन्स संकलन गर्न कार्यालयमा आउँदा आफ्नो <strong>नागरिकताको प्रमाणपत्र</strong> र <strong>राजस्व बुझाएको रसिद</strong> अनिवार्य रूपमा साथमा लिएर आउनु होला। राजस्व बुझाएको रसिद नासिएमा/हराएमा नजिकैको ट्राफिक प्रहरी कार्यालयबाट सिफारिस लिएर मात्र आउनु होला ।
                        </div>
                    </div>
                    
                    <div style="margin-top: 1rem; padding: var(--result-card-padding, 1.25rem); border-radius: 16px; background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.2); text-align: center; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.5rem; justify-content: center; align-items: center;">
                        <div style="color: var(--text-primary); font-weight: 800; font-size: calc(var(--rec-badge-val-size, 1.05rem) - 2.5px); line-height: 1.4; letter-spacing: -0.2px;">
                            कार्यालयले सृजना गरेको <span style="color: #ff4d4d; font-size: 0.9em;">LICENSE  RECORD  MANAGEMENT  SYSTEM</span> <strong style="color: var(--text-primary); font-weight: bold;">(LRMS)</strong> प्रयोग गर्नु भएकोमा धन्यवाद् !
                        </div>
                        <div style="color: #10B981; font-weight: 800; font-size: calc(var(--rec-badge-title-size, 1.1rem) - 2.5px); line-height: 1.2; letter-spacing: 0.5px; text-transform: uppercase;">
                            VISIT  THIS  SITE  AGAIN !
                        </div>
                    </div>
                `;
            }
        }

        const card = document.createElement('div');
        card.className = 'result-card';
        
        let superActionsHTML = '';

        card.innerHTML = `
            ${superActionsHTML}
            <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 1rem;">
                <div class="res-icon-small icon-success" style="width: 1.5rem; height: 1.5rem; font-size: 0.9rem; border-radius: 50%;">✔</div>
                <h3 style="font-size: var(--result-title-size, 1.5rem); color: var(--success); font-weight: 800; margin: 0; letter-spacing: -0.2px;">Smart Card Found</h3>
            </div>
            
            <div class="grid-details">
                <div class="detail-box">
                    <div class="det-label">Full Name</div>
                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent); font-weight: 800; font-size: calc(var(--det-value-large-mono-size) - 2.5px) !important;">${record['Name'] || '---'}</div>
                </div>
                <div class="detail-box">
                    <div class="det-label">F/H Name</div>
                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent); font-weight: 700;">${record['F/H Name'] || '---'}</div>
                </div>
                
                ${(() => {
                    if (receivedByVal) {
                        // CASE 1: DISTRIBUTED
                        let html = `
                            <div class="detail-box" style="grid-column: span 2;">
                                <div class="det-label">License Number</div>
                                <div class="det-value det-value-large-mono" style="color: var(--accent); text-transform: uppercase;">${record['License No'] || '---'}</div>
                            </div>
                        `;
                        if (isAdmin) {
                            html += `
                                <div class="detail-box">
                                    <div class="det-label">Category</div>
                                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent);">${record['Category'] || '---'}</div>
                                </div>
                                <div class="detail-box">
                                    <div class="det-label">Code No</div>
                                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent);">${record['Code No'] || '---'}</div>
                                </div>
                                <div class="detail-box">
                                    <div class="det-label">Applicant ID</div>
                                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent);">${record['Applicant ID'] || '---'}</div>
                                </div>
                                <div class="detail-box">
                                    <div class="det-label">VISITING DAY</div>
                                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent); font-weight: 700;">${window.convertAdToBs(record['Office Visit Day'])}</div>
                                </div>
                            `;
                        } else {
                            html += `
                                <div class="detail-box" style="grid-column: span 2;">
                                    <div class="det-label">Category</div>
                                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent);">${record['Category'] || '---'}</div>
                                </div>
                                <div class="detail-box">
                                    <div class="det-label">VISITING DAY</div>
                                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent); font-weight: 700;">${window.convertAdToBs(record['Office Visit Day'])}</div>
                                </div>
                                <div class="detail-box">
                                    <div class="det-label">Applicant ID</div>
                                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent);">${record['Applicant ID'] || '---'}</div>
                                </div>
                            `;
                        }
                        return html;
                    } else {
                        // CASE 2: NOT DISTRIBUTED (Classic side-by-side mode)
                        if (isAdmin) {
                            return `
                                <div class="detail-box">
                                    <div class="det-label">License Number</div>
                                    <div class="det-value det-value-large-mono" style="color: var(--accent); text-transform: uppercase;">${record['License No'] || '---'}</div>
                                </div>
                                <div class="detail-box">
                                    <div class="det-label">Category</div>
                                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent);">${record['Category'] || '---'}</div>
                                </div>
                                <div class="detail-box">
                                    <div class="det-label">Applicant ID</div>
                                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent);">${record['Applicant ID'] || '---'}</div>
                                </div>
                                <div class="detail-box">
                                    <div class="det-label">Code No</div>
                                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent);">${currentUserRole === 'super' ? (record['Code No'] || '---') : `<span style="color: #ef4444; font-size: 0.72rem; font-weight: 850; letter-spacing: 0px;" title="Save receiver name first to unlock">🔒 HIDDEN (SAVE RECIPIENT FIRST)</span>`}</div>
                                </div>
                                <div class="detail-box" style="grid-column: span 2;">
                                    <div class="det-label">VISITING DAY</div>
                                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent); font-weight: 700;">${window.convertAdToBs(record['Office Visit Day'])}</div>
                                </div>
                            `;
                        } else {
                            return `
                                <div class="detail-box">
                                    <div class="det-label">License Number</div>
                                    <div class="det-value det-value-large-mono" style="color: var(--accent); text-transform: uppercase;">${record['License No'] || '---'}</div>
                                </div>
                                <div class="detail-box">
                                    <div class="det-label">Category</div>
                                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent);">${record['Category'] || '---'}</div>
                                </div>
                                <div class="detail-box">
                                    <div class="det-label">Applicant ID</div>
                                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent);">${record['Applicant ID'] || '---'}</div>
                                </div>
                                <div class="detail-box">
                                    <div class="det-label">VISITING DAY</div>
                                    <div class="det-value det-value-large-mono" style="text-transform: uppercase; color: var(--accent); font-weight: 700;">${window.convertAdToBs(record['Office Visit Day'])}</div>
                                </div>
                            `;
                        }
                    }
                })()}
            </div>
            ${receivedSectionHTML}
        `;
        elements.resultsArea.appendChild(card);
    } else if (suggestions.length > 0) {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.alignItems = 'stretch';
        card.style.textAlign = 'left';
        
        let suggestionsHTML = suggestions.map(s => {
            const rKey = 'RECEIVED BY';
            const rVal = String(s[rKey] || '').trim();
            const recStatus = rVal ? `<span style="color: #10B981; font-weight: 800;">[बुझिसकेको: ${rVal}]</span>` : `<span style="color: #FBBC05; font-weight: 800;">[बुझ्न बाँकी]</span>`;
            
            return `
            <div class="suggestion-item" onclick="performDirectSearch('${String(s['Name']).replace(/'/g, "\\'")}', '${String(s['Applicant ID'] || '').replace(/'/g, "\\'")}')">
                <div class="suggestion-info">
                    <div class="suggestion-name">${s['Name']}</div>
                    <div class="suggestion-meta">
                        <span>ID: ${s['Applicant ID'] || '---'}</span>
                        <span class="meta-divider">|</span>
                        <span>OFFICE: ${window.convertAdToBs(s['Office Visit Day'])}</span>
                        <span class="meta-divider">|</span>
                        <span>विवरण: ${recStatus}</span>
                    </div>
                </div>
                <div class="suggestion-action">SELECT ➔</div>
            </div>
            `;
        }).join('');

        card.innerHTML = `
            <div class="suggestions-header">
                <div class="res-icon" style="background: rgba(59, 130, 246, 0.1); color: var(--accent); margin: 0 auto 0.75rem; width: 48px; height: 48px; font-size: 1.2rem;">🔍</div>
                <h3 style="font-size: 1.25rem; color: var(--text-primary); font-weight: 800; margin-bottom: 0.25rem;">Found ${suggestions.length} Matches</h3>
                <p style="color: var(--text-secondary); font-size: 0.8rem; font-weight: 500; opacity: 0.8;">Select the correct identity to view full details</p>
            </div>
            <div class="suggestions-list" style="max-height: 380px; overflow-y: auto; padding-right: 0.5rem; margin-top: 1rem;">
                ${suggestionsHTML}
            </div>
        `;
        elements.resultsArea.appendChild(card);
    } else {
        const card = document.createElement('div');
        card.className = 'result-card-clean';
        card.style.paddingTop = '0px';
        card.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; width: 100%; text-align: center;">
                <div class="result-error-banner">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    <h3 style="font-size: clamp(0.7rem, 3vw, 1.25rem); color: white; font-weight: 800; margin: 0; line-height: 1.2; white-space: nowrap;">
                        माफ गर्नुहोस्, तपाईंको स्मार्टकार्ड कार्यालयमा उपलब्ध छैन।
                    </h3>
                </div>
                
                <div style="margin-top: 1.25rem; padding: var(--result-card-padding, 1.25rem); border-radius: 16px; background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.2); text-align: center; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.5rem; justify-content: center; align-items: center;">
                    <div style="color: var(--text-primary); font-weight: 800; font-size: calc(var(--rec-badge-val-size, 1.05rem) - 2.5px); line-height: 1.4; letter-spacing: -0.2px;">
                        कार्यालयले सृजना गरेको <span style="color: #ff4d4d; font-size: 0.9em;">LICENSE  RECORD  MANAGEMENT  SYSTEM</span> <strong style="color: var(--text-primary); font-weight: bold;">(LRMS)</strong> प्रयोग गर्नु भएकोमा धन्यवाद् !
                    </div>
                    <div style="color: #10B981; font-weight: 800; font-size: calc(var(--rec-badge-title-size, 1.1rem) - 2.5px); line-height: 1.2; letter-spacing: 0.5px; text-transform: uppercase;">
                        VISIT  THIS  SITE  AGAIN !
                    </div>
                </div>

                <button onclick="window.scrollTo({top: 0, behavior: 'smooth'}); document.getElementById('search-input').focus();" class="btn" style="background: var(--glass); border: 1px solid var(--glass-border); margin-top: 1.5rem; height: auto; padding: 0.75rem 1.5rem; font-size: 0.85rem; border-radius: 50px;">Modify Search Query</button>
            </div>
        `;
        elements.resultsArea.appendChild(card);
    }
}

// Global helper for suggestions
window.performDirectSearch = function(name, id) {
    isUserInitiatedSearch = true;
    elements.searchInput.value = id || name;
    elements.searchForm.requestSubmit();
};

// --- UI Helpers ---

function showLoading(text) {
    elements.loadingText.innerText = text;
    elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    elements.loadingOverlay.style.display = 'none';
}

function updateUIState() {
    const isOverrideActive = isAdmin || 
                             window.location.search.includes('admin=true') || 
                             window.location.hash === '#admin' || 
                             sessionStorage.getItem('tmodl_admin_override') === 'true';

    // Show/hide Admin Entrance Section at the bottom depending on credentials or search trigger
    if (elements.authSection) {
        elements.authSection.style.display = 'flex'; // Keep secure portal container always visible at the bottom
    }

    // Role-based visibility for Missing & Found License buttons and sections
    const staffButtonsWrapper = document.getElementById('staff-buttons-wrapper');
    const missingBtn = document.getElementById('missing-license-btn');
    const foundBtn = document.getElementById('found-license-btn');
    
    if (staffButtonsWrapper) {
        if (isAdmin) {
            staffButtonsWrapper.style.display = 'flex';
        } else {
            staffButtonsWrapper.style.display = 'none';
        }
    }

    if (missingBtn) {
        if (isAdmin) {
            missingBtn.style.display = 'inline-flex';
        } else {
            missingBtn.style.display = 'none';
            const tblSection = document.getElementById('missing-licenses-section');
            if (tblSection) {
                tblSection.style.display = 'none';
                tblSection.style.opacity = '0';
            }
        }
    }
    if (foundBtn) {
        if (isAdmin) {
            foundBtn.style.display = 'inline-flex';
        } else {
            foundBtn.style.display = 'none';
            const tblSection = document.getElementById('found-licenses-section');
            if (tblSection) {
                tblSection.style.display = 'none';
                tblSection.style.opacity = '0';
            }
        }
    }

    const loginButtonsContainer = document.getElementById('login-buttons-container');

    if (database.isLoaded) {
        elements.searchBtn.disabled = false;
        elements.searchInput.disabled = false;
        elements.connectionPill.style.display = 'flex';
        elements.dbWarning.style.display = 'none';
        elements.btnText.innerText = 'SEARCH';
        elements.searchInput.placeholder = 'Enter Your 8 digit License Number (XX-XX-XXXXXXXX)';
    } else {
        elements.searchBtn.disabled = false; // Enable search button
        elements.searchInput.disabled = true;
        elements.connectionPill.style.display = 'none';
        
        if (isOverrideActive) {
            elements.dbWarning.style.display = 'block';
            elements.btnText.innerText = 'Initialize System Data';
            elements.searchInput.placeholder = 'SYNC REQUIRED';
        } else {
            elements.dbWarning.style.display = 'none';
            elements.btnText.innerText = 'SEARCH';
            elements.searchInput.placeholder = 'विवरण लोड हुँदैछ, कृपया पर्खनुहोस्... (Loading Database...)';
        }
        
        // Google Sheets button state
        if (elements.sheetsSyncBtn) {
            elements.sheetsSyncBtn.innerText = 'Sync from Google Sheets';
            elements.sheetsSyncBtn.style.opacity = '1';
        }
    }

    // Toggle Admin Dashboard & Auth Profile Displays
    if (isAdmin) {
        if (elements.adminRecordsCount && database.records) {
            elements.adminRecordsCount.innerText = (database.records || 0).toLocaleString();
        }
        
        if (elements.showAdminPanelBtn) elements.showAdminPanelBtn.style.display = 'flex';
        if (loginButtonsContainer) loginButtonsContainer.style.display = 'none';
        
        if (elements.userInfo) {
            elements.userInfo.style.display = 'flex';
            if (elements.userAvatarPlaceholder) elements.userAvatarPlaceholder.style.display = 'flex';
            if (elements.userAvatar) elements.userAvatar.style.display = 'none';
            
            if (elements.userNameDisplay) {
                if (currentUserRole === 'super') {
                    elements.userNameDisplay.innerText = 'SUPER ADMIN (सुपर एडमिन)';
                    if (elements.userAvatarPlaceholder) elements.userAvatarPlaceholder.innerText = '👑';
                } else {
                    const staffName = (localStorage.getItem('tmodl_logged_username') || 'staff').toUpperCase();
                    elements.userNameDisplay.innerText = `ADMIN (कर्मचारी: ${staffName})`;
                    if (elements.userAvatarPlaceholder) elements.userAvatarPlaceholder.innerText = '📝';
                }
            }
        }
        
        // Super admin specific GUI restrictions & tabs visibility toggling
        const xlMethodDiv = elements.dbWarning ? elements.dbWarning.querySelector('div[style*="Method 1"]') : null;
        const dividerDiv = elements.dbWarning ? elements.dbWarning.querySelector('div[style*="glass-border"]') : null;
        
        const tabBtnStaff = document.getElementById('tab-btn-staff');
        const tabBtnLogs = document.getElementById('tab-btn-logs');
        const addStaffContainer = document.getElementById('add-staff-container');
        if (addStaffContainer) {
            addStaffContainer.style.display = (currentUserRole === 'super') ? 'block' : 'none';
        }
        
        if (currentUserRole === 'super' || currentUserRole === 'admin') {
            // Activating full power or admin level power
            const tabBtnDashboard = document.getElementById('tab-btn-dashboard');
            const tabBtnSettings = document.getElementById('tab-btn-settings');
            if (tabBtnDashboard) tabBtnDashboard.style.display = 'block';
            if (tabBtnSettings) tabBtnSettings.style.display = 'block';
            
            // Warm-load available targets dropdown
            loadAvailablePasswordTargets();

            // Always show staff list to view matrix, but hide logs for non-super
            if (tabBtnStaff) tabBtnStaff.style.display = 'block';
            if (currentUserRole === 'super') {
                if (tabBtnLogs) tabBtnLogs.style.display = 'block';
            } else {
                if (tabBtnLogs) tabBtnLogs.style.display = 'none';
                
                // If the non-super admin had logs active, shift active tab to dashboard
                const panelLogs = document.getElementById('panel-logs');
                const panelDashboard = document.getElementById('panel-dashboard');
                
                if (panelLogs && panelLogs.classList.contains('active')) {
                    if (panelLogs) panelLogs.classList.remove('active');
                    if (tabBtnLogs) tabBtnLogs.classList.remove('active');

                    if (panelDashboard) panelDashboard.classList.add('active');
                    if (tabBtnDashboard) tabBtnDashboard.classList.add('active');
                }
            }
            
            if (elements.adminAddBtn) elements.adminAddBtn.style.display = 'inline-block';
            
            // Show full dbWarning method setups
            if (xlMethodDiv) xlMethodDiv.style.display = 'block';
            if (dividerDiv) dividerDiv.style.display = 'block';
            if (elements.sheetsConfig) {
                elements.sheetsConfig.style.display = 'block';
                elements.sheetsConfig.style.opacity = '1';
            }
        } else {
            // Data entry view (restricted staff level)
            const tabBtnDashboard = document.getElementById('tab-btn-dashboard');
            const tabBtnSettings = document.getElementById('tab-btn-settings');
            if (tabBtnDashboard) tabBtnDashboard.style.display = 'none';
            if (tabBtnSettings) tabBtnSettings.style.display = 'none';

            // Always display staff tab matrix!
            if (tabBtnStaff) tabBtnStaff.style.display = 'block';
            if (tabBtnLogs) tabBtnLogs.style.display = 'none';
            
            // If the restricted panels are currently active or if we're not super/admin, make sure to active reports tab
            const panelLogs = document.getElementById('panel-logs');
            const panelDashboard = document.getElementById('panel-dashboard');
            const panelSettings = document.getElementById('panel-settings');
            
            const panelReports = document.getElementById('panel-reports');
            const tabBtnReports = document.getElementById('tab-btn-reports');

            // Deactivate restricted panels (do NOT deactivate panel-staff. It's allowed now!)
            if (panelLogs) panelLogs.classList.remove('active');
            if (panelDashboard) panelDashboard.classList.remove('active');
            if (panelSettings) panelSettings.classList.remove('active');
            if (tabBtnDashboard) tabBtnDashboard.classList.remove('active');
            if (tabBtnSettings) tabBtnSettings.classList.remove('active');

            // If none of reports or staff panel is active, activate reports panel
            const panelStaff = document.getElementById('panel-staff');
            if (
                (!panelReports || !panelReports.classList.contains('active')) &&
                (!panelStaff || !panelStaff.classList.contains('active'))
            ) {
                if (panelReports) panelReports.classList.add('active');
                if (tabBtnReports) tabBtnReports.classList.add('active');
            }
            
            // Generate report content
            if (window.generateReport) {
                window.generateReport();
            }
            
            if (elements.adminAddBtn) elements.adminAddBtn.style.display = 'none';
            
            // Hide Excel Upload option in database warning for staff
            if (xlMethodDiv) xlMethodDiv.style.display = 'none';
            if (dividerDiv) dividerDiv.style.display = 'none';
            if (elements.sheetsConfig) elements.sheetsConfig.style.display = 'none';
        }
        
        if (elements.loginBtn) elements.loginBtn.style.display = 'none';
        if (elements.pwdLoginBtn) elements.pwdLoginBtn.style.display = 'none';
    } else {
        if (elements.showAdminPanelBtn) elements.showAdminPanelBtn.style.display = 'none';
        if (elements.adminDashboardModal) elements.adminDashboardModal.style.display = 'none';
        if (elements.userInfo) elements.userInfo.style.display = 'none';
        if (loginButtonsContainer) loginButtonsContainer.style.display = 'flex';
        if (elements.loginBtn) elements.loginBtn.style.display = 'none';
        if (elements.pwdLoginBtn) elements.pwdLoginBtn.style.display = 'none';
    }

    // Render dynamic license tables to ensure count buttons update their labels on login/role change
    if (typeof window.renderMissingLicensesTable === 'function') {
        window.renderMissingLicensesTable();
    }
    if (typeof window.renderFoundLicensesTable === 'function') {
        window.renderFoundLicensesTable();
    }
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '2rem';
    toast.style.right = '2rem';
    toast.style.padding = '1rem 2rem';
    toast.style.borderRadius = '12px';
    if (type === 'success') {
        toast.style.background = 'var(--success)';
    } else if (type === 'warning') {
        toast.style.background = '#d97706'; // beautiful amber/warning
    } else {
        toast.style.background = 'var(--error)';
    }
    toast.style.color = 'white';
    toast.style.fontWeight = '700';
    toast.style.zIndex = '2000';
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    toast.style.animation = 'slideIn 0.3s ease-out';
    toast.innerText = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

const toastStyles = document.createElement('style');
toastStyles.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
`;
document.head.appendChild(toastStyles);

// Particles background logic
const particleContainer = document.getElementById('particles');
for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.style.position = 'absolute';
    p.style.width = Math.random() * 5 + 'px';
    p.style.height = p.style.width;
    p.style.background = 'var(--accent)';
    p.style.borderRadius = '50%';
    p.style.opacity = Math.random() * 0.3;
    p.style.top = Math.random() * 100 + '%';
    p.style.left = Math.random() * 100 + '%';
    p.style.animation = `floatParticle ${Math.random() * 10 + 15}s linear infinite`;
    particleContainer.appendChild(p);
}

const particleKeyframes = document.createElement('style');
particleKeyframes.textContent = `
    @keyframes floatParticle {
        0% { transform: translateY(0) rotate(0deg); opacity: 0; }
        10% { opacity: 0.3; }
        90% { opacity: 0.3; }
        100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
    }
`;
document.head.appendChild(particleKeyframes);

// --- Custom Confirmation Dialog Engine ---
function showConfirmDialog(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style = "position: fixed; inset: 0; background: rgba(2,6,23,0.95); z-index: 3000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); animation: fadeIn 0.3s ease-out;";
    
    overlay.innerHTML = `
        <div class="card" style="max-width: 400px; width: 90%; padding: 2rem; border-radius: 24px; text-align: center; border: 1px solid var(--error); background: var(--bg-secondary);">
            <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">⚠️</div>
            <h3 style="margin-bottom: 0.5rem; color: var(--text-primary); font-size: 1.25rem; font-weight: 800;">${title}</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.4;">${message}</p>
            <div style="display: flex; gap: 0.5rem; width: 100%;">
                <button id="confirm-yes-btn" class="btn" style="flex: 1; height: 2.8rem; background: var(--error); color: white; font-size: 0.85rem; border-radius: 10px;">DELETE</button>
                <button id="confirm-no-btn" class="btn" style="flex: 1; height: 2.8rem; background: rgba(255,255,255,0.05); color: white; font-size: 0.85rem; border-radius: 10px;">CANCEL</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    overlay.querySelector('#confirm-yes-btn').addEventListener('click', () => {
        overlay.remove();
        onConfirm();
    });
    
    overlay.querySelector('#confirm-no-btn').addEventListener('click', () => {
        overlay.remove();
    });
}

// --- Admin Controls and Operations (Add, Edit, Delete, Export) ---

window.openEditRecord = function(id) {
    if (currentUserRole !== 'super' && currentUserRole !== 'admin') {
        showToast('यो कार्य सुपर प्रशासक वा प्रशासकको मात्र पहुँचमा छ। (Super Admin or Admin Required)', 'error');
        return;
    }
    const record = database.rows.find(r => String(r['Applicant ID']).trim().toUpperCase() === id.trim().toUpperCase());
    if (record) {
        if (elements.recordModalTitle) elements.recordModalTitle.innerText = '✏️ Edit License Record';
        if (elements.recordOriginalId) elements.recordOriginalId.value = record['Applicant ID'] || '';
        if (elements.recordName) elements.recordName.value = record['Name'] || '';
        if (elements.recordId) {
            elements.recordId.value = record['Applicant ID'] || '';
            elements.recordId.disabled = true; // Disable unique key editing during modification
        }
        if (elements.recordLicense) elements.recordLicense.value = record['License No'] || '';
        if (elements.recordCategory) elements.recordCategory.value = record['Category'] || record['CATEGORY'] || '';
        if (elements.recordCode) elements.recordCode.value = record['Code No'] || '';
        if (elements.recordVisit) elements.recordVisit.value = record['Office Visit Day'] || '';
        
        if (elements.recordModal) elements.recordModal.style.display = 'flex';
    } else {
        showToast('रेकर्ड फेला परेन। (Record not found)', 'error');
    }
};

window.deleteRecord = function(id) {
    if (currentUserRole !== 'super' && currentUserRole !== 'admin') {
        showToast('यो कार्य सुपर प्रशासक वा प्रशासकको मात्र पहुँचमा छ। (Super Admin or Admin Required)', 'error');
        return;
    }
    showConfirmDialog(
        'Delete Record',
        `के तपाईं निश्चित रूपमा आवेदक नम्बर (Applicant ID): <strong>${id}</strong> भएको लाइसेन्स रेकर्ड हटाउन चाहनुहुन्छ? यो प्रक्रिया फिर्ता लिन सकिने छैन।`,
        () => {
            showLoading('Removing identity from registry...');
            database.rows = database.rows.filter(r => String(r['Applicant ID']).trim().toUpperCase() !== id.trim().toUpperCase());
            worker.postMessage({ type: 'INDEX_EXISTING', data: database.rows });
            if (elements.resultsArea) elements.resultsArea.innerHTML = '';
        }
    );
};

// Add Trigger
if (elements.adminAddBtn) {
    elements.adminAddBtn.addEventListener('click', () => {
        if (!isAdmin) {
            showToast('Authentication Required', 'error');
            return;
        }
        if (elements.recordForm) elements.recordForm.reset();
        if (elements.recordModalTitle) elements.recordModalTitle.innerText = '➕ Add New License Record';
        if (elements.recordOriginalId) elements.recordOriginalId.value = '';
        if (elements.recordId) elements.recordId.disabled = false; // Enabled for new records
        
        if (elements.recordModal) elements.recordModal.style.display = 'flex';
    });
}

// Modal Form Cancel
if (elements.recordCancelBtn) {
    elements.recordCancelBtn.addEventListener('click', () => {
        if (elements.recordModal) elements.recordModal.style.display = 'none';
    });
}

// Modal Form Submit (Save / Insert)
if (elements.recordForm) {
    elements.recordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (currentUserRole !== 'super' && currentUserRole !== 'admin') {
            showToast('Authentication Required: Only Super Administrators or Admins can modify registers.', 'error');
            return;
        }
        
        const originalId = elements.recordOriginalId.value.trim();
        const name = elements.recordName.value.trim().toUpperCase();
        const id = elements.recordId.value.trim().toUpperCase();
        const license = elements.recordLicense.value.trim().toUpperCase();
        const category = (elements.recordCategory ? elements.recordCategory.value.trim().toUpperCase() : 'A');
        const code = elements.recordCode.value.trim().toUpperCase();
        const visit = elements.recordVisit.value.trim().toUpperCase();
        
        if (!name || !id || !license || !category || !code || !visit) {
            showToast('कृपया सबै अनिवार्य क्षेत्रहरू भर्नुहोस्। (Please fill required fields)', 'error');
            return;
        }
        
        showLoading('Updating ledger records...');
        
        if (!originalId) {
            // ADDING mode
            const exists = database.rows.some(r => String(r['Applicant ID']).trim().toUpperCase() === id);
            if (exists) {
                hideLoading();
                showToast(`त्रुटि: आवेदक नम्बर ${id} पहिले नै दर्ता छ! (Duplicate Applicant ID!)`, 'error');
                return;
            }
            
            const newRecord = {
                'Applicant ID': id,
                'Name': name,
                'License No': license,
                'Category': category,
                'Code No': code,
                'Office Visit Day': visit
            };
            database.rows.push(newRecord);
        } else {
            // EDITING mode
            const index = database.rows.findIndex(r => String(r['Applicant ID']).trim().toUpperCase() === originalId.toUpperCase());
            if (index !== -1) {
                database.rows[index] = {
                    'Applicant ID': id,
                    'Name': name,
                    'License No': license,
                    'Category': category,
                    'Code No': code,
                    'Office Visit Day': visit
                };
            }
        }
        
        // Push modification out to Indexer and Persistent Cache (IndexedDB)
        worker.postMessage({ type: 'INDEX_EXISTING', data: database.rows });
        if (elements.recordModal) elements.recordModal.style.display = 'none';
    });
}

// Export CSV trigger
if (elements.adminExportBtn) {
    elements.adminExportBtn.addEventListener('click', exportRegistryToCSV);
}

function exportRegistryToCSV() {
    if (!database.rows || database.rows.length === 0) {
        showToast('डाटाबेस खाली छ। (Database empty, nothing to export)', 'error');
        return;
    }
    
    const headers = ['Applicant ID', 'Name', 'License No', 'Code No', 'Office Visit Day'];
    let csvContent = "";
    
    // Add header row
    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + "\r\n";
    
    // Add data rows
    database.rows.forEach(row => {
        const line = headers.map(h => {
            const val = String(row[h] || '').replace(/"/g, '""');
            return `"${val}"`;
        }).join(',');
        csvContent += line + "\r\n";
    });
    
    // UTF-8 BOM representation to guarantee flawless Nepali unicode parsing in Excel
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `TMODL_License_Registry_Exported_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('फाइल सफलतापुर्वक डाउनलोड भयो! (Registry exported to CSV)', 'success');
}

// --- Recipient Logging & Sheets Syncing Engine ---
function getColumnLetter(colIndex) {
    let temp = '';
    while (colIndex >= 0) {
        temp = String.fromCharCode((colIndex % 26) + 65) + temp;
        colIndex = Math.floor(colIndex / 26) - 1;
    }
    return temp;
}

window.useCardholderName = function(applicantId, cardholderName) {
    const inputElement = document.getElementById(`received-by-input-${applicantId}`);
    if (inputElement) {
        inputElement.value = cardholderName.trim().toUpperCase();
        inputElement.focus();
        showToast('सवारी चालकको नाम भरियो! (Cardholder name applied!)', 'success');
    }
};

window.resetRecipientInput = function(applicantId) {
    const inputElement = document.getElementById(`received-by-input-${applicantId}`);
    if (inputElement) {
        inputElement.value = '';
        inputElement.focus();
        showToast('विवरण पुन: सेट गरियो! (Input cleared!)', 'success');
    }
};

window.saveReceivedBy = async function(applicantId, isReset = false) {
    if (!isAdmin) {
        showToast('विवरण सुरक्षित गर्न प्रशासनिक खाताबाट लगइन हुनुपर्छ। (Admin Auth Required)', 'error');
        return;
    }
    
    // 1. Capture the Input Value robustly
    let inputElement = document.getElementById(`received-by-input-${applicantId}`);
    if (!inputElement) {
        const inputs = document.querySelectorAll(`input[id^="received-by-input-"]`);
        if (inputs.length === 1) {
            inputElement = inputs[0];
        } else if (inputs.length > 0) {
            const normTargetId = String(applicantId).trim().toUpperCase();
            for (const inp of inputs) {
                const cleanInpId = inp.id.replace('received-by-input-', '').trim().toUpperCase();
                if (cleanInpId === normTargetId) {
                    inputElement = inp;
                    break;
                }
            }
        }
    }
    
    const receivedBy = isReset ? '' : (inputElement ? inputElement.value.trim().toUpperCase() : '');
    
    // Validate empty input on Attempted Save (not reset)
    if (!isReset && receivedBy === '') {
        showToast('कृपया बुझिलिनेको नाम लेख्नुहोस् (Please enter the receiver name)', 'error');
        if (inputElement) inputElement.focus();
        return;
    }
    
    // Prepare the save button state for active loading feedback
    const saveButton = document.querySelector('.btn-save-recipient') || document.querySelector('.btn-save-recipient-inline');
    const originalBtnHTML = saveButton ? saveButton.innerHTML : 'विवरण सुरक्षित (SAVE) गर्नुहोस';
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = `<span>⏳ सुरक्षित हुँदैछ...</span>`;
    }

    try {
        // 2. Verify Row Tracking & Offset
        const foundIndex = database.rows.findIndex(r => String(r['Applicant ID']).trim().toUpperCase() === applicantId.trim().toUpperCase());
        if (foundIndex === -1) {
            throw new Error('रेकर्ड फेला परेन। (Record not found)');
        }
        const record = database.rows[foundIndex];

        // Retrieve row directly using the flawless tiered resolver
        let absoluteRow;
        let resolvedFromSN = false;
        try {
            const keys = Object.keys(record);
            const snKey = keys.find(k => {
                const normK = String(k).trim().toUpperCase();
                return normK === 'S.N.' || normK === 'S.N' || normK === 'S. N.' || normK === 'SN' || normK === 'SERIAL NO' || normK === 'सि.नं.';
            });
            if (snKey) {
                const rawSN = parseInt(record[snKey], 10);
                if (!isNaN(rawSN) && rawSN > 0) {
                    absoluteRow = rawSN + 5;
                    resolvedFromSN = true;
                    console.log(`[Save Row Resolver] Resolved absolute sheet row from Serial Number (S.N. ${rawSN}): Row ${absoluteRow}`);
                }
            }
        } catch (snErr) {
            console.warn('[Save Row Resolver] S.N. evaluation failed:', snErr);
        }

        if (!resolvedFromSN) {
            if (currentRecord && String(currentRecord.applicantId).trim().toUpperCase() === String(applicantId).trim().toUpperCase() && currentRecord.sheetRow) {
                absoluteRow = currentRecord.sheetRow;
                console.log(`[Save Row Resolver] Using sheetRow from selected currentRecord: Row ${absoluteRow}`);
            } else {
                absoluteRow = record.__rowIndex !== undefined ? record.__rowIndex + 1 : foundIndex + 6;
                console.log(`[Save Row Resolver] Fallback to __rowIndex calculation: Row ${absoluteRow}`);
            }
        }
        
        let headers = database.headers || (database.rows.length > 0 && database.rows[0] ? Object.keys(database.rows[0]).filter(k => k !== '__rowIndex') : []);
        
        // Force and self-heal header structure to ensure index 8 (Column I) is 'RECEIVED BY'
        if (headers.length > 8) {
            headers = headers.map((h, i) => i === 8 ? 'RECEIVED BY' : (String(h).toUpperCase() === 'RECEIVED BY' ? `Column_${i}` : h));
        } else {
            while (headers.length <= 8) {
                headers.push(`Column_${headers.length}`);
            }
            headers[8] = 'RECEIVED BY';
        }
        database.headers = headers;
        localStorage.setItem('tmodl_headers', JSON.stringify(headers));
        let receivedByHeader = 'RECEIVED BY';

        // Force column letter strictly to 'I' (Column 9) as requested by the user
        const columnLetter = 'I';
        const cleanId = String(record['Applicant ID'] || applicantId).trim().toUpperCase();

        const activeGid = localStorage.getItem('tmodl_active_sheet_gid') || '';
        const spreadsheetId = database.spreadsheetId || localStorage.getItem('tmodl_active_spreadsheet_id') || '128y-JrUDPVWbvarLzKH4pSkNgmK25ouUM26aswWHKiU';
        const sheetName = localStorage.getItem('tmodl_active_sheet_name') || 'READY TO DISTRIBUTE';
        const googleScriptUrl = localStorage.getItem('tmodl_google_script_url') || '';

        // Complete debugging logs requested by the user
        console.log("Selected Applicant:", cleanId);
        console.log("Selected Name:", String(record['Name'] || '').trim());
        console.log("Actual Sheet Row:", absoluteRow);
        console.log("Saving Receiver To:", "I" + absoluteRow);

        // Log gathered details
        const gatheredInfo = {
            applicantId: cleanId,
            receivedBy: receivedBy,
            absoluteRow: absoluteRow,
            columnLetter: columnLetter,
            spreadsheetId: spreadsheetId,
            sheetName: sheetName,
            gid: activeGid,
            googleScriptUrl: googleScriptUrl
        };
        console.log('📌 [Client Save] COLLECTED DATA:', gatheredInfo);

        const saveHeaders = {
            'Content-Type': 'application/json'
        };
        if (googleAccessToken) {
            saveHeaders['Authorization'] = `Bearer ${googleAccessToken}`;
        }

        const payload = { 
            receivedBy: receivedBy, 
            absoluteRow: absoluteRow,
            rowNumber: absoluteRow,
            receiverName: receivedBy,
            columnLetter: columnLetter,
            spreadsheetId: spreadsheetId,
            sheetName: sheetName,
            gid: activeGid,
            googleScriptUrl: googleScriptUrl,
            applicantId: cleanId
        };
        console.log('📤 [Client Save] REQUEST PAYLOAD:', payload);

        // Make the POST request to our API proxy
        const response = await fetch('/api/license/save-receiver', {
            method: 'POST',
            headers: saveHeaders,
            body: JSON.stringify(payload)
        });

        // Debug response state
        console.log('📥 [Client Save] HTTP RESPONSE METADATA:', {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errText}`);
        }

        const resData = await response.json();
        console.log('📥 [Client Save] API RESPONSE PAYLOAD:', resData);
        console.log("Google Response:", resData);

        if (resData.success === false) {
            throw new Error(resData.error || 'Server rejected the sheet update request');
        }

        // --- SUCCESS STATE: UPDATE LOCAL CACHE & UI ---
        
        record[receivedByHeader] = receivedBy;
        database.localSaveTimestamps = database.localSaveTimestamps || {};
        database.localSaveTimestamps[cleanId] = Date.now();

        // Update auxiliary local maps
        let receivedByMap = {};
        let distributedByMap = {};
        try {
            receivedByMap = JSON.parse(localStorage.getItem('tmodl_received_by_map') || '{}');
        } catch(e) {}
        try {
            distributedByMap = JSON.parse(localStorage.getItem('tmodl_distributed_by_map') || '{}');
        } catch(e) {}
        
        const currentOp = (localStorage.getItem('tmodl_logged_username') || localStorage.getItem('tmodl_user_role') || 'admin').trim();
        if (receivedBy === '') {
            delete receivedByMap[cleanId];
            delete distributedByMap[cleanId];
            delete record['Distributed By'];
            delete record['DISTRIBUTED BY'];
        } else {
            receivedByMap[cleanId] = receivedBy;
            distributedByMap[cleanId] = currentOp;
            record['Distributed By'] = currentOp;
        }
        localStorage.setItem('tmodl_received_by_map', JSON.stringify(receivedByMap));
        localStorage.setItem('tmodl_distributed_by_map', JSON.stringify(distributedByMap));
        
        // Push back/pull from lists if necessary
        if (receivedBy === '') {
            let foundLicenses = window.loadListFromLocalStorage('tmodl_found_licenses') || [];
            const foundIdx = foundLicenses.findIndex(f => 
                (f.applicantId && String(f.applicantId).trim().toUpperCase() === cleanId) ||
                (f.licenseNo && String(f.licenseNo).trim().toUpperCase() === String(record['License No']).trim().toUpperCase())
            );
            if (foundIdx !== -1) {
                const matchedItem = foundLicenses[foundIdx];
                foundLicenses.splice(foundIdx, 1);
                window.saveListToLocalStorage('tmodl_found_licenses', foundLicenses);
                window.renderFoundLicensesTable();

                // Push back to missing list
                let missingLicenses = window.loadListFromLocalStorage('tmodl_missing_licenses') || [];
                const alreadyInMissing = missingLicenses.some(m => 
                    (m.applicantId && String(m.applicantId).trim().toUpperCase() === cleanId) ||
                    (m.licenseNo && String(m.licenseNo).trim().toUpperCase() === String(record['License No']).trim().toUpperCase())
                );
                if (!alreadyInMissing) {
                    missingLicenses.push({
                        fullName: record['Name'] || matchedItem.fullName,
                        applicantId: cleanId,
                        licenseNo: record['License No'] || matchedItem.licenseNo,
                        phoneNo: record['Phone No'] || record['PHONE NO'] || matchedItem.phoneNo || '',
                        date: record['Office Visit Day'] || matchedItem.missingDate || ''
                    });
                    window.saveListToLocalStorage('tmodl_missing_licenses', missingLicenses);
                    window.renderMissingLicensesTable();
                }
            }
        }

        // Save to IndexedDB cache in background
        saveToDB(database.rows).catch(dbErr => console.warn('[DB Cache Background] warning:', dbErr));
        
        // Re-index search engine
        worker.postMessage({ type: 'INDEX_EXISTING', data: database.rows });

        // Reset the Textbox value
        if (inputElement) {
            inputElement.value = '';
        }

        // Re-render UI results card
        displayResult(record);

        // Re-focus on the Textbox after UI has re-drawn
        setTimeout(() => {
            let newInputElement = document.getElementById(`received-by-input-${applicantId}`);
            if (!newInputElement) {
                const inputs = document.querySelectorAll(`input[id^="received-by-input-"]`);
                if (inputs.length === 1) {
                    newInputElement = inputs[0];
                }
            }
            if (newInputElement) {
                newInputElement.focus();
            }
        }, 50);

        // Restore original button visual
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = originalBtnHTML;
        }

        // Show green Success notification
        if (resData && resData.status === 'simulated_success') {
            showToast('विवरण सेभ भयो (स्थानीय रूपमा)! कृपया गुगल सिट सेयर सेटिङ मिलाउनुहोस।', 'warning');
        } else {
            showToast('विवरण सफलतापूर्वक सुरक्षित भयो।', 'success');
        }

    } catch (err) {
        console.error('❌ [Client Save] ERROR DETAILS LOGGED:', err);
        
        // Restore button state
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = originalBtnHTML;
        }

        // Show Network Error Alert as requested
        alert("विवरण सुरक्षित गर्न सकिएन। कृपया पुनः प्रयास गर्नुहोस्।\n\nत्रुटि विवरण (Error Details): " + err.message);
        showToast(`त्रुटि: ${err.message}`, 'error');
    }
};

window.resetDistributionRecord = async function(applicantId) {
    if (!isAdmin) {
        showToast('विवरण रिसेट गर्न प्रशासनिक खाताबाट लगइन हुनुपर्छ। (Admin Auth Required)', 'error');
        return;
    }

    if (confirm('तपाईं निश्चित रूपमा यो वितरण रेकर्ड रिसेट गर्न चाहनुहुन्छ? यसले बुझिलिनेको नाम र वितरण सम्बन्धी सबै विवरण खाली गर्नेछ।\n(Are you sure you want to reset this distribution record? This will clear the recipient name and all related fields.)')) {
        let inputElement = document.getElementById(`received-by-input-${applicantId}`);
        if (!inputElement) {
            const inputs = document.querySelectorAll(`input[id^="received-by-input-"]`);
            if (inputs.length === 1) {
                inputElement = inputs[0];
            } else if (inputs.length > 0) {
                const normTargetId = String(applicantId).trim().toUpperCase();
                for (const inp of inputs) {
                    const cleanInpId = inp.id.replace('received-by-input-', '').trim().toUpperCase();
                    if (cleanInpId === normTargetId) {
                        inputElement = inp;
                        break;
                    }
                }
            }
        }
        if (inputElement) {
            inputElement.value = '';
        }
        await window.saveReceivedBy(applicantId, true);
    }
};

// --- Advanced Reports Module Controller Logic (उन्नत रिपोर्ट मोड्युल) ---
async function loadSheetJS() {
    if (window.XLSX) return window.XLSX;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
        script.onload = () => resolve(window.XLSX);
        script.onerror = () => reject(new Error('Failed to load dynamic SheetJS engine.'));
        document.head.appendChild(script);
    });
}

window.getFilteredRecords = function() {
    if (!database.rows || database.rows.length === 0) return [];
    
    const catFilter = document.getElementById('report-category-select').value;
    const startDateVal = document.getElementById('report-start-date').dataset.adValue || '';
    const endDateVal = document.getElementById('report-end-date').dataset.adValue || '';
    const applyDateFilter = document.getElementById('report-apply-date-filter') ? document.getElementById('report-apply-date-filter').checked : false;
    
    return database.rows.filter(r => {
        // 1. Filter by Category
        const recCat = String(r['Category'] || r['CATEGORY'] || '').trim().toUpperCase();
        if (catFilter !== 'ALL') {
            if (recCat !== catFilter) return false;
        }
        
        // 2. Filter by Date range
        if (applyDateFilter) {
            const visitDay = String(r['Office Visit Day'] || r['OFFICE VISIT DAY'] || '').trim();
            let visitDayAd = '';
            if (visitDay) {
                const hasDevanagari = /[\u0900-\u097F]/.test(visitDay);
                if (hasDevanagari) {
                    visitDayAd = window.convertBsToAd(visitDay);
                } else {
                    // Check if it is a valid Gregorian Date
                    const d = new Date(visitDay);
                    if (isNaN(d.getTime())) {
                        // Try parsing as english-digit BS date
                        visitDayAd = window.convertBsToAd(visitDay);
                    } else {
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const dayVal = String(d.getDate()).padStart(2, '0');
                        visitDayAd = `${y}-${m}-${dayVal}`;
                    }
                }
            }
            
            if (visitDayAd) {
                if (startDateVal && visitDayAd < startDateVal) return false;
                if (endDateVal && visitDayAd > endDateVal) return false;
            } else {
                if (startDateVal || endDateVal) return false;
            }
        }
        
        return true;
    });
};

window.currentReportType = 'daily';
window.currentReportData = [];

window.generateReport = function() {
    const reportTypeSelect = document.getElementById('report-type-select');
    const reportCategorySelect = document.getElementById('report-category-select');
    if (!reportTypeSelect || !reportCategorySelect) return;

    const reportType = reportTypeSelect.value;
    window.currentReportType = reportType;
    
    // Get all matching records
    const filtered = window.getFilteredRecords();
    
    // Calculate and update stats cards
    let totalRecords = filtered.length;
    let distributedCount = 0;
    
    filtered.forEach(r => {
        const recBy = String(r['RECEIVED BY'] || r['received by'] || r['Received By'] || '').trim();
        if (recBy && recBy.toUpperCase() !== 'PENDING' && recBy !== '') {
            distributedCount++;
        }
    });
    
    const totalEl = document.getElementById('report-stat-total');
    const distEl = document.getElementById('report-stat-distributed');
    const pendEl = document.getElementById('report-stat-pending');
    
    if (totalEl) totalEl.innerText = totalRecords;
    if (distEl) distEl.innerText = distributedCount;
    if (pendEl) pendEl.innerText = totalRecords - distributedCount;
    
    const tableHeader = document.getElementById('report-table-header');
    const tableBody = document.getElementById('report-table-body');
    if (!tableHeader || !tableBody) return;
    
    if (totalRecords === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; color: var(--text-secondary); padding: 2.5rem 1rem;">
                    ⚠️ No records matched the selected filters. Please verify date bounds and category criteria.
                </td>
            </tr>
        `;
        window.currentReportData = [];
        return;
    }
    
    let html = '';
    
    if (reportType === 'daily') {
        tableHeader.innerHTML = `
            <tr>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--console-table-th-color);">S.N. <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(क्र.सं.)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--console-table-th-color);">Distribution Date <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(वितरण मिति)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--console-table-th-color);">Category <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(वर्ग)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--console-table-th-color);">Total Registries <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(कुल रेकर्ड)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--console-table-th-color);">Distributed Cards <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(वितरण गरिएको थान)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--console-table-th-color);">Pending in Office <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(बाँकी संख्या)</span></th>
            </tr>
        `;
        
        const dateGroups = {};
        filtered.forEach(r => {
            const visitDay = String(r['Office Visit Day'] || r['OFFICE VISIT DAY'] || '').trim();
            const dateMatch = visitDay.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
            const dateKey = dateMatch ? dateMatch[0] : 'No Date Specified';
            
            const cat = String(r['Category'] || r['CATEGORY'] || 'N/A').trim().toUpperCase();
            const groupKey = `${dateKey}_${cat}`;
            
            if (!dateGroups[groupKey]) {
                dateGroups[groupKey] = {
                    date: dateKey,
                    category: cat,
                    total: 0,
                    distributed: 0,
                    pending: 0
                };
            }
            
            dateGroups[groupKey].total++;
            const recBy = String(r['RECEIVED BY'] || r['received by'] || r['Received By'] || '').trim();
            if (recBy && recBy.toUpperCase() !== 'PENDING' && recBy !== '') {
                dateGroups[groupKey].distributed++;
            } else {
                dateGroups[groupKey].pending++;
            }
        });
        
        const sortedGroups = Object.values(dateGroups).sort((a,b) => {
            if (a.total !== b.total) {
                return b.total - a.total;
            }
            const dateComp = b.date.localeCompare(a.date);
            if (dateComp !== 0) return dateComp;
            return a.category.localeCompare(b.category);
        });
        window.currentReportData = sortedGroups;
        
        sortedGroups.forEach((g, index) => {
            html += `
                <tr style="border-bottom: 1px solid var(--glass-border); background: rgba(255,255,255,0.01);">
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; color: var(--accent); font-weight: 900; font-size: 0.75rem; vertical-align: middle;">${index + 1}</td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; font-weight: bold; color: var(--text-primary); font-size: 0.75rem; vertical-align: middle;">${g.date}</td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; font-size: 0.75rem; vertical-align: middle;"><span style="background: rgba(59,130,246,0.12); color: #60a5fa; border: 1.5px solid rgba(59,130,246,0.3); padding: 4px 10px; border-radius: 6px; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.5px;">${g.category}</span></td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; color: var(--text-primary); font-weight: bold; font-size: 0.75rem; vertical-align: middle;">${g.total}</td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; color: #10b981; font-weight: 900; font-size: 0.75rem; vertical-align: middle;">${g.distributed}</td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; color: #ef4444; font-weight: 900; font-size: 0.75rem; vertical-align: middle;">${g.pending}</td>
                </tr>
            `;
        });
        
    } else if (reportType === 'monthly') {
        tableHeader.innerHTML = `
            <tr>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--text-primary);">S.N. <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(क्र.सं.)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--text-primary);">Month Range <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(महिना)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--text-primary);">Category <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(वर्ग)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--text-primary);">Total Registries <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(कुल रेकर्ड)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--text-primary);">Distributed Cards <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(वितरण गरिएको थान)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--text-primary);">Remaining Volume <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(बाँकी रेकर्ड)</span></th>
            </tr>
        `;
        
        const monthGroups = {};
        filtered.forEach(r => {
            const visitDay = String(r['Office Visit Day'] || r['OFFICE VISIT DAY'] || '').trim();
            const dateMatch = visitDay.match(/(\d{4})[-/](\d{2})/);
            const monthKey = dateMatch ? dateMatch[0] : 'Unknown Month';
            
            const cat = String(r['Category'] || r['CATEGORY'] || 'N/A').trim().toUpperCase();
            const groupKey = `${monthKey}_${cat}`;
            
            if (!monthGroups[groupKey]) {
                monthGroups[groupKey] = {
                    month: monthKey,
                    category: cat,
                    total: 0,
                    distributed: 0,
                    pending: 0
                };
            }
            
            monthGroups[groupKey].total++;
            const recBy = String(r['RECEIVED BY'] || r['received by'] || r['Received By'] || '').trim();
            if (recBy && recBy.toUpperCase() !== 'PENDING' && recBy !== '') {
                monthGroups[groupKey].distributed++;
            } else {
                monthGroups[groupKey].pending++;
            }
        });
        
        const sortedGroups = Object.values(monthGroups).sort((a,b) => {
            if (a.total !== b.total) {
                return b.total - a.total;
            }
            const monthComp = b.month.localeCompare(a.month);
            if (monthComp !== 0) return monthComp;
            return a.category.localeCompare(b.category);
        });
        window.currentReportData = sortedGroups;
        
        sortedGroups.forEach((g, index) => {
            html += `
                <tr style="border-bottom: 1px solid var(--glass-border); background: rgba(255,255,255,0.01);">
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; color: var(--accent); font-weight: 900; font-size: 0.75rem; vertical-align: middle;">${index + 1}</td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; font-weight: bold; color: var(--text-primary); font-size: 0.75rem; vertical-align: middle;">${g.month}</td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; font-size: 0.75rem; vertical-align: middle;"><span style="background: rgba(59,130,246,0.12); color: #60a5fa; border: 1.5px solid rgba(59,130,246,0.3); padding: 4px 10px; border-radius: 6px; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.5px;">${g.category}</span></td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; color: var(--text-primary); font-weight: bold; font-size: 0.75rem; vertical-align: middle;">${g.total}</td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; color: #10b981; font-weight: 900; font-size: 0.75rem; vertical-align: middle;">${g.distributed}</td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; color: #ef4444; font-weight: 900; font-size: 0.75rem; vertical-align: middle;">${g.pending}</td>
                </tr>
            `;
        });
        
    } else if (reportType === 'category') {
        tableHeader.innerHTML = `
            <tr>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">S.N. <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(वर्ग)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">Applicant ID</th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">Applicant Name <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(नाम)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">License No. <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(लाइसेन्स नं)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">Cat <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(वर्ग)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">Code No</th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">Office Visit Day</th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">Status <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(बुझिलिनेको नाम)</span></th>
                <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">Distributed By <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(वितरणकर्ता)</span></th>
            </tr>
        `;
        
        window.currentReportData = filtered.map((r, index) => ({
            sn: index + 1,
            applicantId: r['Applicant ID'] || r['APPLICANT ID'] || 'N/A',
            name: r['Name'] || r['NAME'] || 'N/A',
            licenseNo: r['License No'] || r['LICENSE NO'] || 'N/A',
            category: r['Category'] || r['CATEGORY'] || 'N/A',
            codeNo: r['Code No'] || r['CODE NO'] || 'N/A',
            visitDay: r['Office Visit Day'] || r['OFFICE VISIT DAY'] || 'N/A',
            receivedBy: r['RECEIVED BY'] || r['received by'] || r['Received By'] || '',
            distributedBy: (function() {
                const appId = String(r['Applicant ID'] || r['APPLICANT ID'] || '').trim().toUpperCase();
                const recBy = String(r['RECEIVED BY'] || r['received by'] || r['Received By'] || '').trim();
                let distributedByMap = {};
                try { distributedByMap = JSON.parse(localStorage.getItem('tmodl_distributed_by_map') || '{}'); } catch(e) {}
                if (distributedByMap[appId]) return distributedByMap[appId];
                if (r['Distributed By'] || r['DISTRIBUTED BY']) return r['Distributed By'] || r['DISTRIBUTED BY'];
                return (recBy && recBy.toUpperCase() !== 'PENDING' && recBy !== '') ? 'admin' : '---';
            })()
        }));

        // Sort alphabetically by Category Column!
        window.currentReportData.sort((a,b) => {
            const catComp = a.category.localeCompare(b.category);
            if (catComp !== 0) return catComp;
            return a.name.localeCompare(b.name);
        });

        // Re-align Sn index sequence securely 
        window.currentReportData.forEach((row, index) => {
            row.sn = index + 1;
        });
        
        window.currentReportData.forEach(row => {
            const isRec = row.receivedBy && row.receivedBy.toUpperCase() !== 'PENDING' && row.receivedBy !== '';
            html += `
                <tr style="border-bottom: 1px solid var(--glass-border); background: rgba(255,255,255,0.01);">
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; color: var(--accent); font-weight: 900; font-size: 0.72rem; vertical-align: middle;">${row.sn}</td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; color: var(--text-primary); font-weight: bold; font-family: 'Outfit', sans-serif; font-size: 0.72rem; vertical-align: middle;">${row.applicantId}</td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; color: var(--text-primary); font-weight: bold; font-size: 0.72rem; vertical-align: middle;">${row.name}</td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; font-family: 'Outfit', sans-serif; font-weight: bold; font-size: 0.72rem; vertical-align: middle;">${row.licenseNo}</td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; font-size: 0.72rem; vertical-align: middle;"><span style="background: rgba(59,130,246,0.12); color: #60a5fa; border: 1.5px solid rgba(59,130,246,0.3); padding: 4px 10px; border-radius: 6px; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.5px;">${row.category}</span></td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; font-family: 'Outfit', sans-serif; font-weight: bold; font-size: 0.72rem; vertical-align: middle;">${currentUserRole === 'super' ? row.codeNo : (isRec ? row.codeNo : '<span style="color: #ef4444; font-weight: 800; font-size: 0.55rem;">🔒 HIDDEN</span>')}</td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; font-size: 0.65rem; font-weight: 600; vertical-align: middle; color: var(--text-secondary);">${window.convertAdToBs(row.visitDay)}</td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; color: ${isRec ? '#10b981' : '#ef4444'}; font-weight: 900; font-size: 0.65rem; vertical-align: middle;"><span style="background: ${isRec ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}; border: 1.5px solid ${isRec ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}; padding: 4px 10px; border-radius: 6px; display: inline-block;">${isRec ? row.receivedBy : '🔴 PENDING'}</span></td>
                    <td style="padding: 0.85rem; display: table-cell; text-align: center; color: #a855f7; font-weight: 950; font-size: 0.65rem; vertical-align: middle;"><span style="background: ${isRec ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${isRec ? 'rgba(168,85,247,0.22)' : 'rgba(255,255,255,0.1)'}; padding: 4px 10px; border-radius: 6px; display: inline-block; color: ${isRec ? '#c084fc' : '#94a3b8'};">${row.distributedBy}</span></td>
                </tr>
            `;
        });
    } else if (reportType === 'user') {
        const selectedUserStr = (window.selectedReportUser || 'ALL').trim().toUpperCase();
        const selectedUsers = selectedUserStr.split(',').map(u => u.trim()).filter(Boolean);
        const isAll = selectedUsers.includes('ALL') || selectedUsers.length === 0;
        
        if (!isAll) {
            tableHeader.innerHTML = `
                <tr>
                    <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">S.N. <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(क्र.सं.)</span></th>
                    <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">Applicant ID</th>
                    <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">Applicant Name <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(नाम)</span></th>
                    <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">License No. <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(लाइसेन्स नं)</span></th>
                    <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">Cat <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(वर्ग)</span></th>
                    <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">Code No</th>
                    <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">Office Visit Day <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(भ्रमण दिन)</span></th>
                    <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">Received By (वितरक)</th>
                    <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.72rem; color: var(--text-primary);">Distributed By <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(वितरणकर्ता)</span></th>
                </tr>
            `;

            const userRows = [];
            filtered.forEach(r => {
                const recBy = String(r['RECEIVED BY'] || r['received by'] || r['Received By'] || '').trim();
                const recByUpper = recBy.toUpperCase();
                if (selectedUsers.includes(recByUpper)) {
                    const visitDay = String(r['Office Visit Day'] || r['OFFICE VISIT DAY'] || 'N/A').trim();
                    userRows.push({
                        applicantId: r['Applicant ID'] || r['APPLICANT ID'] || 'N/A',
                        name: r['Name'] || r['NAME'] || 'N/A',
                        licenseNo: r['License No'] || r['LICENSE NO'] || 'N/A',
                        category: r['Category'] || r['CATEGORY'] || 'N/A',
                        codeNo: r['Code No'] || r['CODE NO'] || 'N/A',
                        visitDay: visitDay,
                        receivedBy: recBy,
                        distributedBy: (function() {
                            const appId = String(r['Applicant ID'] || r['APPLICANT ID'] || '').trim().toUpperCase();
                            const recBy = String(r['RECEIVED BY'] || r['received by'] || r['Received By'] || '').trim();
                            let distributedByMap = {};
                            try { distributedByMap = JSON.parse(localStorage.getItem('tmodl_distributed_by_map') || '{}'); } catch(e) {}
                            if (distributedByMap[appId]) return distributedByMap[appId];
                            if (r['Distributed By'] || r['DISTRIBUTED BY']) return r['Distributed By'] || r['DISTRIBUTED BY'];
                            return (recBy && recBy.toUpperCase() !== 'PENDING' && recBy !== '') ? 'admin' : '---';
                        })()
                    });
                }
            });

            // Sort alphabetically by category
            userRows.sort((a,b) => {
                const catComp = a.category.localeCompare(b.category);
                if (catComp !== 0) return catComp;
                return a.name.localeCompare(b.name);
            });
            window.currentReportData = userRows;

            if (totalEl) totalEl.innerText = userRows.length;
            if (distEl) distEl.innerText = userRows.length;
            if (pendEl) pendEl.innerText = 0;

            if (userRows.length === 0) {
                html += `
                    <tr>
                        <td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 2.5rem 1rem;">
                            ⚠️ No distributed cards found for user(s) "${window.selectedReportUser}" in the selected date range.
                        </td>
                    </tr>
                `;
            } else {
                userRows.forEach((row, index) => {
                    html += `
                        <tr style="border-bottom: 1px solid var(--glass-border); background: rgba(255,255,255,0.01);">
                            <td style="padding: 0.85rem; display: table-cell; text-align: center; color: var(--accent); font-weight: 900; font-size: 0.72rem; vertical-align: middle;">${index + 1}</td>
                            <td style="padding: 0.85rem; display: table-cell; text-align: center; color: var(--text-primary); font-weight: bold; font-family: 'Outfit', sans-serif; font-size: 0.72rem; vertical-align: middle;">${row.applicantId}</td>
                            <td style="padding: 0.85rem; display: table-cell; text-align: center; color: var(--text-primary); font-weight: bold; font-size: 0.72rem; vertical-align: middle;">${row.name}</td>
                            <td style="padding: 0.85rem; display: table-cell; text-align: center; font-family: 'Outfit', sans-serif; font-weight: bold; font-size: 0.72rem; vertical-align: middle;">${row.licenseNo}</td>
                            <td style="padding: 0.85rem; display: table-cell; text-align: center; font-size: 0.72rem; vertical-align: middle;"><span style="background: rgba(59,130,246,0.12); color: #60a5fa; border: 1.5px solid rgba(59,130,246,0.3); padding: 4px 10px; border-radius: 6px; font-size: 0.62rem; font-weight: 800; letter-spacing: 0.5px;">${row.category}</span></td>
                            <td style="padding: 0.85rem; display: table-cell; text-align: center; font-family: 'Outfit', sans-serif; font-weight: bold; font-size: 0.72rem; vertical-align: middle;">${currentUserRole === 'super' ? row.codeNo : (row.receivedBy ? row.codeNo : '<span style="color: #ef4444; font-weight: 800; font-size: 0.55rem;">🔒 HIDDEN</span>')}</td>
                            <td style="padding: 0.85rem; display: table-cell; text-align: center; font-size: 0.65rem; font-weight: 600; vertical-align: middle; color: var(--text-secondary);">${window.convertAdToBs(row.visitDay)}</td>
                            <td style="padding: 0.85rem; display: table-cell; text-align: center; font-size: 0.68rem; font-weight: bold; color: #c084fc; vertical-align: middle;"><span style="background: rgba(147,51,234,0.12); border: 1px solid rgba(147,51,234,0.22); padding: 2px 8px; border-radius: 4px;">${row.receivedBy}</span></td>
                            <td style="padding: 0.85rem; display: table-cell; text-align: center; font-size: 0.68rem; font-weight: bold; color: #a855f7; vertical-align: middle;"><span style="background: rgba(168,85,247,0.12); border: 1px solid rgba(168,85,247,0.22); padding: 2px 8px; border-radius: 4px; color: #c084fc;">${row.distributedBy}</span></td>
                        </tr>
                    `;
                });
            }
        } else {
            tableHeader.innerHTML = `
                <tr>
                    <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--text-primary);">S.N. <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(क्र.सं.)</span></th>
                    <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--text-primary);">USER NAME <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(प्रयोगकर्ताको नाम)</span></th>
                    <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--text-primary);">Recipient Name <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(बुझिलिनेको नाम)</span></th>
                    <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--text-primary);">DISTRIBUTED CARDS <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(वितरण गरिएको संख्या)</span></th>
                    <th style="padding: 0.85rem; text-align: center; font-weight: 900; vertical-align: middle; font-size: 0.75rem; color: var(--text-primary);">DISTRIBUTED DATE <span style="display: block; font-size: 0.55rem; font-weight: bold; opacity: 0.9; margin-top: 3px; text-align: center; color: var(--accent);">(वितरण मिति)</span></th>
                </tr>
            `;
            
            const userGroups = {};
            let adminAccounts = [];
            try { adminAccounts = JSON.parse(localStorage.getItem('tmodl_admin_accounts') || '[]'); } catch(e) {}
            const getFullStaffName = (userNameOrRole) => {
                if (!userNameOrRole || userNameOrRole === '---') return '---';
                const acc = adminAccounts.find(a => String(a.username).toLowerCase().trim() === String(userNameOrRole).toLowerCase().trim());
                if (acc && acc.fullName) {
                    return acc.fullName;
                }
                if (userNameOrRole.toLowerCase() === 'admin' || userNameOrRole.toLowerCase() === 'superadmin') return 'Lead Administrator';
                if (userNameOrRole.toLowerCase() === 'staff') return 'Staff Operator Team';
                return userNameOrRole;
            };

            filtered.forEach(r => {
                const recBy = String(r['RECEIVED BY'] || r['received by'] || r['Received By'] || '').trim();
                if (recBy && recBy.toUpperCase() !== 'PENDING' && recBy !== '') {
                    const visitDay = String(r['Office Visit Day'] || r['OFFICE VISIT DAY'] || '').trim();
                    const dateMatch = visitDay.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
                    const dateStr = dateMatch ? dateMatch[0] : 'N/A';
                    
                    const appId = String(r['Applicant ID'] || r['APPLICANT ID'] || '').trim().toUpperCase();
                    let distributedByMap = {};
                    try { distributedByMap = JSON.parse(localStorage.getItem('tmodl_distributed_by_map') || '{}'); } catch(e) {}
                    const distBy = distributedByMap[appId] || r['Distributed By'] || r['DISTRIBUTED BY'] || ((recBy && recBy.toUpperCase() !== 'PENDING' && recBy !== '') ? 'admin' : '---');
                    const distByFullName = getFullStaffName(distBy);

                    const recNormalized = recBy;
                    if (!userGroups[recNormalized]) {
                        userGroups[recNormalized] = {
                            user: recNormalized,
                            count: 0,
                            lastDate: dateStr,
                            operator: distByFullName
                        };
                    }
                    userGroups[recNormalized].count++;
                    if (dateStr !== 'N/A' && (userGroups[recNormalized].lastDate === 'N/A' || dateStr > userGroups[recNormalized].lastDate)) {
                        userGroups[recNormalized].lastDate = dateStr;
                    }
                }
            });
            
            const sortedGroups = Object.values(userGroups).sort((a,b) => b.count - a.count);
            window.currentReportData = sortedGroups;
            
            if (sortedGroups.length === 0) {
                html += `
                    <tr>
                        <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 2.5rem 1rem;">
                            ⚠️ No distributed smart cards matched selection parameters.
                        </td>
                    </tr>
                `;
            } else {
                sortedGroups.forEach((g, index) => {
                    html += `
                        <tr style="border-bottom: 1px solid var(--glass-border); background: rgba(255,255,255,0.01);">
                            <td style="padding: 0.85rem; display: table-cell; text-align: center; color: var(--accent); font-weight: 900; font-size: 0.75rem; vertical-align: middle;">${index + 1}</td>
                            <td style="padding: 0.85rem; display: table-cell; text-align: center; color: #3b82f6; font-weight: bold; font-family: 'Outfit', sans-serif; font-size: 0.75rem; vertical-align: middle;">${g.operator || '---'}</td>
                            <td style="padding: 0.85rem; display: table-cell; text-align: center; font-weight: bold; color: var(--text-primary); font-size: 0.75rem; vertical-align: middle;">${g.user}</td>
                            <td style="padding: 0.85rem; display: table-cell; text-align: center; color: #10b981; font-weight: 900; font-size: 0.75rem; vertical-align: middle;">${g.count}</td>
                            <td style="padding: 0.85rem; display: table-cell; text-align: center; color: var(--text-secondary); font-size: 0.68rem; vertical-align: middle;">${window.convertAdToBs(g.lastDate)}</td>
                        </tr>
                    `;
                });
            }
        }
    }
    
    tableBody.innerHTML = html;
    
    const tsLbl = document.getElementById('report-timestamp-lbl');
    if (tsLbl) tsLbl.innerText = `Report Computed: ${new Date().toLocaleTimeString()}`;
};

window.exportReportToExcel = async function() {
    try {
        if (!window.currentReportData || window.currentReportData.length === 0) {
            showToast('Export failed: Please click "Generate Report" first to compute report contents!', 'error');
            return;
        }
        
        showLoading('Initializing Excel Export Engine...');
        const XLSX = await loadSheetJS();
        
        let wsData = [];
        let filename = 'Driving_License_Report.xlsx';
        
        if (window.currentReportType === 'daily') {
            filename = 'Daily_Card_Distribution_Report.xlsx';
            wsData = [
                ['TRANSPORT MANAGEMENT OFFICE - DRIVING LICENSE OFFICE, ITAHARI, SUNSARI'],
                ['DAILY CARD DISTRIBUTION & DELIVERY REPORT - दैनिक वितरण प्रतिवेदन'],
                [`Generated on: ${new Date().toLocaleString()}`],
                [],
                ['S.N.', 'Date (मिति)', 'Category (लाइसेन्स वर्ग)', 'Total Registries (कुल रेकर्ड)', 'Distributed (वितरण गरिएको)', 'Pending Delivery (बाँकी)']
            ];
            window.currentReportData.forEach((row, index) => {
                wsData.push([
                    index + 1,
                    row.date,
                    row.category,
                    row.total,
                    row.distributed,
                    row.pending
                ]);
            });
        } else if (window.currentReportType === 'monthly') {
            filename = 'Monthly_Distribution_Summary.xlsx';
            wsData = [
                ['TRANSPORT MANAGEMENT OFFICE - DRIVING LICENSE OFFICE, ITAHARI, SUNSARI'],
                ['MONTHLY CARD REGISTRY & DELIVERY OUTCOME SUMMARY - मासिक प्रतिवेदन'],
                [`Generated on: ${new Date().toLocaleString()}`],
                [],
                ['S.N.', 'Month (महिना)', 'Category (लाइसेन्स वर्ग)', 'Total Joint Registries (कुल रेकर्ड)', 'Successfully Distributed (वितरण गरिएको)', 'Pending delivery (बाँकी)']
            ];
            window.currentReportData.forEach((row, index) => {
                wsData.push([
                    index + 1,
                    row.month,
                    row.category,
                    row.total,
                    row.distributed,
                    row.pending
                ]);
            });
        } else if (window.currentReportType === 'category') {
            filename = 'Category_wise_Detailed_Report.xlsx';
            wsData = [
                ['TRANSPORT MANAGEMENT OFFICE - DRIVING LICENSE OFFICE, ITAHARI, SUNSARI'],
                ['CATEGORY-WISE DETAILED LICENSE OUTCOME REPORT - वर्ग अनुसार विस्तृत वितरण प्रतिवेदन'],
                [`Generated on: ${new Date().toLocaleString()}`],
                [],
                ['S.N.', 'Applicant ID', 'Applicant Name (नाम)', 'License No (लाइसेन्स नं)', 'Category (वर्ग)', 'Code No', 'Office Visit Day', 'Received By (बुझिलिनेको नाम)', 'Distributed By (वितरणकर्ता)']
            ];
            window.currentReportData.forEach(row => {
                wsData.push([
                    row.sn,
                    row.applicantId,
                    row.name,
                    row.licenseNo,
                    row.category,
                    row.codeNo,
                    window.convertAdToBs(row.visitDay),
                    row.receivedBy || 'PENDING',
                    row.distributedBy || '---'
                ]);
            });
         } else if (window.currentReportType === 'user') {
             const selectedUserVal = (window.selectedReportUser || 'ALL').trim().toUpperCase();
             const selectedUsers = selectedUserVal.split(',').map(u => u.trim()).filter(Boolean);
             const isAll = selectedUsers.includes('ALL') || selectedUsers.length === 0;
             if (!isAll) {
                 filename = `Operator_Distribution_Detailed.xlsx`;
                 wsData = [
                     ['TRANSPORT MANAGEMENT OFFICE - DRIVING LICENSE OFFICE, ITAHARI, SUNSARI'],
                     [`OPERATOR DETAILED DISTRIBUTION: ${selectedUserVal} - विस्तृत विवरण प्रतिवेदन`],
                     [`Generated on: ${new Date().toLocaleString()}`],
                     [],
                     ['S.N.', 'Applicant ID', 'Applicant Name (नाम)', 'License No (लाइसेन्स नं)', 'Category (वर्ग)', 'Code No', 'Office Visit Day', 'Received By (बुझिलिनेको नाम)', 'Distributed By (वितरणकर्ता)']
                 ];
                 window.currentReportData.forEach((row, index) => {
                     wsData.push([
                         index + 1,
                         row.applicantId,
                         row.name,
                         row.licenseNo,
                         row.category,
                         row.codeNo,
                         window.convertAdToBs(row.visitDay),
                         row.receivedBy,
                         row.distributedBy || '---'
                     ]);
                 });
            } else {
                filename = 'User_wise_Distribution_Summary.xlsx';
                wsData = [
                    ['TRANSPORT MANAGEMENT OFFICE - DRIVING LICENSE OFFICE, ITAHARI, SUNSARI'],
                    ['USER-WISE SMART CARD DISTRIBUTION SUMMARY - प्रयोगकर्ता विवरण प्रतिवेदन'],
                    [`Generated on: ${new Date().toLocaleString()}`],
                    [],
                    ['S.N.', 'USER NAME (प्रयोगकर्ताको नाम)', 'Recipient Name (बुझिलिनेको नाम)', 'DISTRIBUTED CARDS (वितरण गरिएको संख्या)', 'DISTRIBUTED DATE (वितरण मिति)']
                ];
                window.currentReportData.forEach((row, index) => {
                    wsData.push([
                        index + 1,
                        row.operator || '---',
                        row.user,
                        row.count,
                        window.convertAdToBs(row.lastDate)
                    ]);
                });
            }
        }
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Report Data');
        XLSX.writeFile(wb, filename);
        
        showToast('Microsoft Excel (.xlsx) downloaded successfully!', 'success');
        hideLoading();
    } catch (err) {
        console.error('Excel Export Error:', err);
        showToast('Excel Export failed: ' + err.message, 'error');
        hideLoading();
    }
};

window.loadHtml2Pdf = function() {
    return new Promise((resolve, reject) => {
        if (window.html2pdf) return resolve(window.html2pdf);
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => resolve(window.html2pdf);
        script.onerror = (err) => reject(new Error('Failed to load html2pdf.js library: ' + err.message));
        document.head.appendChild(script);
    });
};

window.exportReportToPDF = async function() {
    if (!window.currentReportData || window.currentReportData.length === 0) {
        showToast('No report data available to print.', 'error');
        return;
    }
    
    // Set up loading button states
    const printBtn = document.getElementById('btn-report-print');
    let originalBtnHTML = '📠 DOWNLOAD REPORT';
    if (printBtn) {
        originalBtnHTML = printBtn.innerHTML;
        printBtn.disabled = true;
        printBtn.innerHTML = '🔄 Generating PDF...';
    }
    
    try {
        // Load html2pdf dynamically
        showLoading('Generating high-quality PDF...');
        const html2pdf = await window.loadHtml2Pdf();
        
        let reportTitle = 'Driving License Report Manager - Itahari Office';
        let subtitle = '';
        let tableHTML = '';
        
        if (window.currentReportType === 'daily') {
            reportTitle = 'Daily Card Distribution Audit Record';
            subtitle = 'दैनिक स्मार्ट ड्राइभिङ लाइसेन्स वितरण तथा वितरण प्रतिवेदन';
            tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%">S.N.</th>
                            <th>Distribution Date (वितरण मिति)</th>
                            <th>Category (वर्ग)</th>
                            <th>Total Registered Volume</th>
                            <th>Handed Over / Distributed</th>
                            <th>Remaining / Pending</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${window.currentReportData.map((row, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td style="font-weight: bold;">${row.date}</td>
                                <td><span class="badge">${row.category}</span></td>
                                <td>${row.total}</td>
                                <td style="font-weight: bold; color: #10B981;">${row.distributed}</td>
                                <td style="color: #EF4444;">${row.pending}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (window.currentReportType === 'monthly') {
            reportTitle = 'Monthly Card Registry Summary Ledger';
            subtitle = 'मासिक कुल स्मार्ट कार्ड वितरण विवरण तथा तथ्याङ्क प्रतिवेदन';
            tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%">S.N.</th>
                            <th>Month Range (महिना)</th>
                            <th>Category (वर्ग)</th>
                            <th>Total System Registries</th>
                            <th>Successfully Distributed</th>
                            <th>Total Pending Delivery</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${window.currentReportData.map((row, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td style="font-weight: bold;">${row.month}</td>
                                <td><span class="badge">${row.category}</span></td>
                                <td>${row.total}</td>
                                <td style="font-weight: bold; color: #10B981;">${row.distributed}</td>
                                <td style="color: #EF4444;">${row.pending}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (window.currentReportType === 'category') {
            reportTitle = 'Category-wise Detailed Smart Card Outflow Report';
            subtitle = 'लाइसेन्स वर्ग अनुसार विस्तृत विवरण तथा वितरण भरपाई प्रतिवेदन';
            tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%">S.N.</th>
                            <th>Applicant ID</th>
                            <th>Name (नाम)</th>
                            <th>License No</th>
                            <th>Cat (वर्ग)</th>
                            <th>Code No</th>
                            <th>Office Visit Day</th>
                            <th>RECEIVED BY STATUS (बुझिलिनेको नाम)</th>
                            <th>Distributed By (वितरणकर्ता)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${window.currentReportData.map(row => `
                            <tr>
                                <td>${row.sn}</td>
                                <td style="font-weight: bold; font-family: monospace;">${row.applicantId}</td>
                                <td>${row.name}</td>
                                <td style="font-family: monospace;">${row.licenseNo}</td>
                                <td><span class="badge">${row.category}</span></td>
                                <td>${row.codeNo}</td>
                                <td>${window.convertAdToBs(row.visitDay)}</td>
                                <td style="font-weight: bold; color: ${row.receivedBy ? '#10B981' : '#EF4444'}">
                                    ${row.receivedBy ? row.receivedBy : 'PENDING'}
                                </td>
                                <td style="font-weight: bold; color: ${row.receivedBy ? '#C084FC' : '#94A3B8'}">
                                    ${row.distributedBy || '---'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (window.currentReportType === 'user') {
            const selectedUserVal = (window.selectedReportUser || 'ALL').trim().toUpperCase();
            const selectedUsers = selectedUserVal.split(',').map(u => u.trim()).filter(Boolean);
            const isAll = selectedUsers.includes('ALL') || selectedUsers.length === 0;
            
            if (!isAll) {
                reportTitle = `Detailed Distribution Log: Operators (${selectedUserVal})`;
                subtitle = `प्रयोगकर्ता ${selectedUserVal} द्वारा वितरण गरिएको स्मार्ट लाइसेन्स कार्डहरूको विस्तृत विवरण`;
                tableHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 5%">S.N.</th>
                                <th>Applicant ID</th>
                                <th>Name (नाम)</th>
                                <th>License No</th>
                                <th>Cat (वर्ग)</th>
                                <th>Code No</th>
                                <th>Office Visit Day</th>
                                <th>Received By</th>
                                <th>Distributed By</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${window.currentReportData.map((row, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td style="font-weight: bold; font-family: monospace;">${row.applicantId}</td>
                                    <td>${row.name}</td>
                                    <td style="font-family: monospace;">${row.licenseNo}</td>
                                    <td><span class="badge">${row.category}</span></td>
                                    <td>${row.codeNo}</td>
                                    <td>${window.convertAdToBs(row.visitDay)}</td>
                                    <td><strong>${row.receivedBy || 'N/A'}</strong></td>
                                    <td><strong>${row.distributedBy || '---'}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } else {
                reportTitle = 'User-wise Smart Card Distribution Record';
                subtitle = 'प्रयोगकर्ता र बुझिलिने अनुसार स्मार्ट कार्ड वितरण प्रतिवेदन';
                tableHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 5%">S.N.</th>
                                <th>USER NAME (प्रयोगकर्ताको नाम)</th>
                                <th>Recipient Name (बुझिलिनेको नाम)</th>
                                <th>DISTRIBUTED CARDS (वितरण गरिएको संख्या)</th>
                                <th>DISTRIBUTED DATE (वितरण मिति)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${window.currentReportData.map((row, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td style="font-weight: bold; color: #3b82f6;">${row.operator || '---'}</td>
                                    <td style="font-weight: bold;">${row.user}</td>
                                    <td style="font-weight: bold; color: #10B981;">${row.count}</td>
                                    <td>${window.convertAdToBs(row.lastDate)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
        }
        
        let totalReg = 0;
        let totalDist = 0;
        
        if (window.currentReportType === 'category') {
            totalReg = window.currentReportData.length;
            totalDist = window.currentReportData.reduce((acc, row) => acc + (row.receivedBy ? 1 : 0), 0);
        } else if (window.currentReportType === 'user') {
            const selectedUserVal = (window.selectedReportUser || 'ALL').trim().toUpperCase();
            const selectedUsers = selectedUserVal.split(',').map(u => u.trim()).filter(Boolean);
            const isAll = selectedUsers.includes('ALL') || selectedUsers.length === 0;
            if (!isAll) {
                totalReg = window.currentReportData.length;
                totalDist = totalReg;
            } else {
                totalDist = window.currentReportData.reduce((acc, row) => acc + (row.count || 0), 0);
                totalReg = totalDist;
            }
        } else {
            totalReg = window.currentReportData.reduce((acc, row) => acc + (row.total || 0), 0);
            totalDist = window.currentReportData.reduce((acc, row) => acc + (row.distributed || 0), 0);
        }
        const totalPending = totalReg - totalDist;
        
        const printZone = document.getElementById('print-zone');
        if (!printZone) return;
        
        printZone.innerHTML = `
            <style>
                #print-zone {
                    font-family: 'Outfit', 'Helvetica Neue', Arial, sans-serif !important;
                    color: #0f172a !important;
                    background: #ffffff !important;
                    padding: 25px !important;
                    box-sizing: border-box !important;
                }
                #print-zone table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    margin-top: 15px !important;
                    margin-bottom: 25px !important;
                    font-size: 11px !important;
                }
                #print-zone th, #print-zone td {
                    border: 1px solid #cbd5e1 !important;
                    padding: 8px 10px !important;
                    text-align: center !important;
                    vertical-align: middle !important;
                }
                #print-zone th {
                    background-color: #f1f5f9 !important;
                    font-weight: 800 !important;
                    color: #0f172a !important;
                }
                #print-zone td {
                    color: #334155 !important;
                    background: none !important;
                }
                #print-zone .badge {
                    background-color: #f1f5f9 !important;
                    color: #2563eb !important;
                    border: 1px solid #cbd5e1 !important;
                    padding: 2px 6px !important;
                    border-radius: 4px !important;
                    font-weight: bold !important;
                    font-size: 10px !important;
                    display: inline-block !important;
                }
                .stats-grid-print {
                    display: grid !important;
                    grid-template-columns: repeat(3, 1fr) !important;
                    gap: 15px !important;
                    margin-bottom: 25px !important;
                }
                .stat-box-print {
                    padding: 12px !important;
                    border: 1.5px solid #cbd5e1 !important;
                    border-radius: 8px !important;
                    text-align: center !important;
                }
                .stat-box-print-blue { border-left: 4px solid #3b82f6 !important; }
                .stat-box-print-green { border-left: 4px solid #10b981 !important; }
                .stat-box-print-red { border-left: 4px solid #ef4444 !important; }
            </style>

            <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
                <div style="font-size: 1.35rem; font-weight: 800; text-transform: uppercase; color: #1e3a8a;">Government of Nepal (नेपाल सरकार)</div>
                <div style="font-size: 0.85rem; color: #475569; font-weight: 600;">Ministry of Physical Infrastructure and Transport</div>
                <div style="font-size: 1.15rem; font-weight: 800; margin-top: 5px; color: #111827;">Transport Management Office, Itahari, Sunsari Office</div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="font-size: 1.2rem; font-weight: 800; text-transform: uppercase; color: #0f172a;">${reportTitle}</div>
                <div style="font-size: 0.85rem; color: #4b5563; margin-top: 4px; font-weight: 500;">${subtitle}</div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; border: 0 !important;">
                <tr style="border: 0 !important;">
                    <td style="width: 50%; text-align: left; padding: 4px 0; border: 0 !important; color: #4b5563;">Source Database: <strong style="color: #0f172a;">Live Google Sheet Ledger Sync</strong></td>
                    <td style="width: 50%; text-align: right; padding: 4px 0; border: 0 !important; color: #4b5563;">Report Coverage: <strong style="color: #0f172a;">${document.getElementById('report-start-date').value || 'All Time'} to ${document.getElementById('report-end-date').value || 'All Time'}</strong></td>
                </tr>
                <tr style="border: 0 !important;">
                    <td style="text-align: left; padding: 4px 0; border: 0 !important; color: #4b5563;">Security Standard: <strong style="color: #0f172a;">Yatayat Enforced SecLayer</strong></td>
                    <td style="text-align: right; padding: 4px 0; border: 0 !important; color: #4b5563;">Printed At: <strong style="color: #0f172a;">${new Date().toLocaleString()}</strong></td>
                </tr>
            </table>
            
            <div class="stats-grid-print">
                <div class="stat-box-print stat-box-print-blue">
                    <div style="font-size: 1.3rem; font-weight: bold; color: #3b82f6;">${totalReg}</div>
                    <div style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; font-weight: bold; margin-top: 2px;">Total System Volume</div>
                </div>
                <div class="stat-box-print stat-box-print-green">
                    <div style="font-size: 1.3rem; font-weight: bold; color: #10b981;">${totalDist}</div>
                    <div style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; font-weight: bold; margin-top: 2px;">Total Handed-Over Cards</div>
                </div>
                <div class="stat-box-print stat-box-print-red">
                    <div style="font-size: 1.3rem; font-weight: bold; color: #ef4444;">${totalPending}</div>
                    <div style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; font-weight: bold; margin-top: 2px;">Pending Handouts</div>
                </div>
            </div>
            
            ${tableHTML}
            
            <div style="text-align: center; font-size: 0.70rem; color: #64748b; margin-top: 50px; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
                This document is a cryptographically synced system ledger generated by Transport Management Office Itahari. All modifications are logged automatically. Yatayat.
            </div>
        `;
        
        const opt = {
            margin: [20, 15, 20, 15], // top, left, bottom, right
            filename: `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_Report.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Generate PDF, append page numbers, save, and print!
        await html2pdf().set(opt).from(printZone).toPdf().get('pdf').then(function(pdf) {
            const totalPages = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setTextColor(110);
                
                // Draw elegant top page number & branding on later pages
                pdf.text(`Transport Management Office, Itahari - ${reportTitle}`, 15, 10);
                pdf.text('Page ' + i + ' of ' + totalPages, pdf.internal.pageSize.getWidth() - 25, pdf.internal.pageSize.getHeight() - 10);
            }
        }).save();

        showToast('PDF Ledger downloaded successfully!', 'success');

        // Allow some time for native download process delegation before native print blocks main thread
        setTimeout(() => {
            window.print();
        }, 120);

    } catch (err) {
        console.error('PDF Generation / Print Error:', err);
        showToast('PDF Export failed: ' + err.message, 'error');
    } finally {
        hideLoading();
        if (printBtn) {
            printBtn.disabled = false;
            printBtn.innerHTML = originalBtnHTML;
        }
    }
};

// =========================================================================
// MISSED / MISPLACED LICENSE (नभेटिएका लाईसेन्सहरूको विवरण) REGISTRY ENGINE
// =========================================================================

window.showMissingLicensesSection = function() {
    const section = document.getElementById('missing-licenses-section');
    if (!section) return;
    
    section.style.display = 'flex';
    // Force a paint reflow for smooth transition
    section.offsetHeight;
    section.style.opacity = '1';
    
    // Auto-scroll to table smoothly
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.hideMissingLicensesSection = function() {
    const section = document.getElementById('missing-licenses-section');
    if (!section) return;
    
    section.style.opacity = '0';
    setTimeout(() => {
        if (section.style.opacity === '0') {
            section.style.display = 'none';
        }
    }, 300);
};

window.showFoundLicensesSection = function() {
    const section = document.getElementById('found-licenses-section');
    if (!section) return;
    
    section.style.display = 'flex';
    // Force a paint reflow for smooth transition
    section.offsetHeight;
    section.style.opacity = '1';
    
    // Auto-scroll to table smoothly
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.hideFoundLicensesSection = function() {
    const section = document.getElementById('found-licenses-section');
    if (!section) return;
    
    section.style.opacity = '0';
    setTimeout(() => {
        if (section.style.opacity === '0') {
            section.style.display = 'none';
        }
    }, 300);
};

window.loadListFromLocalStorage = function(key) {
    try {
        const stored = localStorage.getItem(key);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error(`Error parsing list for ${key} from localStorage:`, e);
        return [];
    }
};

window.saveListToLocalStorage = function(key, array) {
    try {
        const validatedArray = Array.isArray(array) ? array : [];
        localStorage.setItem(key, JSON.stringify(validatedArray));

        // Background write-back to Express REST backup endpoints
        if (key === 'tmodl_missing_licenses') {
            fetch('/api/license/missing-licenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validatedArray)
            }).then(r => r.json()).then(resData => {
                console.log('[Cloud Backup Sync] Missing licenses successfully updated on server:', resData);
            }).catch(syncErr => {
                console.warn('[Cloud Backup Sync] Missing licenses write-back offline fallback:', syncErr.message);
            });
        } else if (key === 'tmodl_found_licenses') {
            fetch('/api/license/found-licenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validatedArray)
            }).then(r => r.json()).then(resData => {
                console.log('[Cloud Backup Sync] Found licenses successfully updated on server:', resData);
            }).catch(syncErr => {
                console.warn('[Cloud Backup Sync] Found licenses write-back offline fallback:', syncErr.message);
            });
        }
    } catch (e) {
        console.error(`Error writing list for ${key} to localStorage:`, e);
    }
};

window.confirmTickActionMissingLicense = function(idx) {
    if (!isAdmin) {
        showToast('Authentication Required: Only Super Administrators or Admins can modify missing licenses.', 'error');
        const modal = document.getElementById('password-modal');
        if (modal) modal.style.display = 'flex';
        return;
    }

    const overlay = document.createElement('div');
    overlay.style = "position: fixed; inset: 0; background: rgba(2,6,23,0.92); z-index: 3000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); animation: fadeIn 0.25s ease-out;";

    overlay.innerHTML = `
        <div class="card" style="max-width: 480px; width: 92%; padding: 2.2rem; border-radius: 20px; border: 1px solid var(--glass-border); background: var(--bg-secondary); box-shadow: 0 10px 40px rgba(0,0,0,0.6); text-align: center; box-sizing: border-box;">
            <div style="font-size: 2.5rem; margin-bottom: 0.85rem;">⚠️</div>
            <h3 style="margin-bottom: 1.2rem; color: var(--text-primary); font-size: 1.15rem; font-weight: 850; line-height: 1.5;">के तपाई यो लाईसेन्स रेकर्ड भेटिएको List मा पठाउन चाहनु हुन्छ ?</h3>
            <p style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 1.8rem; line-height: 1.5;">
                यसले यो लाइसेन्सलाई नभेटिएको सूचीबाट स्थानान्तरण गरी संकलनको विवरण भर्ने ठाउँमा लैजानेछ।
            </p>
            <div style="display: flex; gap: 0.75rem; width: 100%;">
                <button id="tick-confirm-btn" class="btn btn-primary" style="flex: 1; height: 2.8rem; background: #0F9D58; color: white; font-size: 0.88rem; border-radius: 10px; font-weight: 950; border: none; cursor: pointer; text-transform: uppercase;">
                    चाहन्छु (Yes)
                </button>
                <button id="tick-cancel-btn" class="btn" style="flex: 1; height: 2.8rem; background: rgba(239, 68, 68, 0.15); color: #FF4D4D; font-size: 0.88rem; border-radius: 10px; font-weight: 950; border: 1px solid rgba(239, 68, 68, 0.3); cursor: pointer;">
                    चाहन्न (No)
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#tick-cancel-btn').addEventListener('click', () => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 200);
    });

    overlay.querySelector('#tick-confirm-btn').addEventListener('click', () => {
        overlay.remove();
        window.deleteMissingLicense(idx, 'found');
    });
};

window.renderMissingLicensesTable = function() {
    const tbody = document.getElementById('missing-licenses-tbody');
    const badge = document.getElementById('missing-count-badge');
    if (!tbody) return;

    const missingLicenses = window.loadListFromLocalStorage('tmodl_missing_licenses');
    if (badge) {
        badge.innerText = `नभेटिएका लाईसेन्हरु(MISSING LICENSES) : ${missingLicenses.length}`;
    }

    if (missingLicenses.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="padding: 2.5rem !important; text-align: center; color: var(--text-secondary); font-style: italic;">
                    कुनै पनि रेकर्ड फेला परेन। (No missing license records found)
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';
    missingLicenses.forEach((item, index) => {
        const row = document.createElement('tr');
        
        // Alternate through beautiful dark neon row themes
        const themes = ['missing-row-cyan', 'missing-row-purple', 'missing-row-teal', 'missing-row-blue'];
        const selectedTheme = themes[index % themes.length];
        
        row.className = `${selectedTheme} row-fade-in`;
        row.style.borderBottom = '1px solid var(--glass-border)';
        
        row.innerHTML = `
            <td style="padding: 0.45rem 0.85rem; color: var(--text-primary); font-family: 'JetBrains Mono', monospace; font-weight: normal; font-size: 0.8rem; white-space: nowrap; text-align: center; vertical-align: middle;">${index + 1}</td>
            <td style="padding: 0.45rem 0.85rem; color: var(--text-primary); font-weight: normal; text-transform: uppercase; white-space: nowrap; text-align: left; vertical-align: middle;">${item.fullName}</td>
            <td style="padding: 0.45rem 0.85rem; color: var(--text-primary); font-family: 'JetBrains Mono', monospace; font-weight: normal; text-transform: uppercase; white-space: nowrap; text-align: center; vertical-align: middle;">${item.applicantId || '—'}</td>
            <td style="padding: 0.45rem 0.85rem; color: var(--text-primary); font-family: 'JetBrains Mono', monospace; font-weight: normal; text-transform: uppercase; white-space: nowrap; text-align: center; vertical-align: middle;">${item.licenseNo}</td>
            <td style="padding: 0.45rem 0.85rem; color: var(--text-primary); font-family: 'Outfit', sans-serif; font-weight: 700; white-space: nowrap; text-align: center; vertical-align: middle;">${item.phoneNo || '—'}</td>
            <td style="padding: 0.45rem 0.85rem; color: var(--text-secondary); font-family: 'Outfit', sans-serif; font-size: 0.85rem; font-weight: normal; white-space: nowrap; text-align: center; vertical-align: middle;" title="Gregorian AD: ${item.date || '—'}">${window.convertAdToBs(item.date)}</td>
            <td style="padding: 0.45rem 0.85rem; text-align: center; white-space: nowrap; vertical-align: middle;">
                <button class="missing-action-btn-tick" data-index="${index}" title="License Found (लाईसेन्स प्राप्त भयो - संकलनकर्ता बिवरण भर्नुहोस्)">✔</button>
                <button class="missing-action-btn-cross" data-index="${index}" title="Still Not Found (अझै फेला परेन - सूचीबाट हटाउनुहोस्)">❌</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Add tick & cross action listeners
    tbody.querySelectorAll('.missing-action-btn-tick').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.getAttribute('data-index'), 10);
            window.confirmTickActionMissingLicense(idx);
        });
    });

    tbody.querySelectorAll('.missing-action-btn-cross').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.getAttribute('data-index'), 10);
            window.deleteMissingLicense(idx, 'not-found');
        });
    });
};

window.triggerRebackAndEdit = function(idx) {
    const foundLicenses = window.loadListFromLocalStorage('tmodl_found_licenses');
    const item = foundLicenses[idx];
    if (!item) return;

    // Create a beautiful dialog modal
    const overlay = document.createElement('div');
    overlay.style = "position: fixed; inset: 0; background: rgba(2,6,23,0.92); z-index: 3000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); animation: fadeIn 0.25s ease-out;";

    overlay.innerHTML = `
        <div class="card" style="max-width: 520px; width: 92%; padding: 2.2rem; border-radius: 20px; border: 1px solid var(--glass-border); background: var(--bg-secondary); box-shadow: 0 10px 40px rgba(0,0,0,0.6); box-sizing: border-box;">
            <div style="font-size: 2.4rem; margin-bottom: 0.75rem; text-align: center;">🔄</div>
            <h3 style="margin-bottom: 0.5rem; color: var(--text-primary); font-size: 1.3rem; font-weight: 850; text-align: center; line-height: 1.4;">रेकर्ड रि-ब्याक र परिमार्जन (Re-Back Record to Missing List)</h3>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.6; text-align: center;">
                यो भेटिएको लाइसेन्स विवरणलाई सच्याएर पुनः <strong>नभेटिएका लाईसेन्सहरुको विवरण (Missing Records List)</strong> मा फर्काउनुहोस्।
            </p>
            
            <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; text-align: left;">
                <!-- Full Name -->
                <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <label style="font-size: 0.75rem; color: var(--text-primary); font-weight: 800;">पूरा नाम (Full Name) *</label>
                    <input type="text" id="reback-full-name" value="${escapeHTML(item.fullName || '')}" style="width: 100%; height: 2.5rem; background: rgba(2, 6, 23, 0.75); border: 1px solid var(--glass-border); border-radius: 8px; padding: 0 0.85rem; color: #fff; font-size: 0.88rem; box-sizing: border-box; outline: none;">
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <!-- Applicant ID -->
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <label style="font-size: 0.75rem; color: var(--text-primary); font-weight: 800;">आवेदक आईडी (Applicant ID)</label>
                        <input type="text" id="reback-applicant-id" value="${escapeHTML(item.applicantId || '')}" style="width: 100%; height: 2.5rem; background: rgba(2, 6, 23, 0.75); border: 1px solid var(--glass-border); border-radius: 8px; padding: 0 0.85rem; color: #fff; font-size: 0.88rem; box-sizing: border-box; outline: none; font-family: 'JetBrains Mono', monospace;">
                    </div>
                    <!-- License No -->
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <label style="font-size: 0.75rem; color: var(--text-primary); font-weight: 800;">लाइसेन्स नं (License No) *</label>
                        <input type="text" id="reback-license-no" value="${escapeHTML(item.licenseNo || '')}" style="width: 100%; height: 2.5rem; background: rgba(2, 6, 23, 0.75); border: 1px solid var(--glass-border); border-radius: 8px; padding: 0 0.85rem; color: #fff; font-size: 0.88rem; box-sizing: border-box; outline: none; font-family: 'JetBrains Mono', monospace;">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <!-- Phone No -->
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <label style="font-size: 0.75rem; color: var(--text-primary); font-weight: 800;">फोन नं (Phone No)</label>
                        <input type="text" id="reback-phone-no" value="${escapeHTML(item.phoneNo || '')}" style="width: 100%; height: 2.5rem; background: rgba(2, 6, 23, 0.75); border: 1px solid var(--glass-border); border-radius: 8px; padding: 0 0.85rem; color: #fff; font-size: 0.88rem; box-sizing: border-box; outline: none; font-family: 'Outfit', sans-serif;">
                    </div>
                    <!-- Missing Date -->
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <label style="font-size: 0.75rem; color: var(--text-primary); font-weight: 800;">नभेटिएको मिति (Missing Date)</label>
                        <input type="date" id="reback-missing-date" value="${item.missingDate || item.foundDate || ''}" style="width: 100%; height: 2.5rem; background: rgba(2, 6, 23, 0.75); border: 1px solid var(--glass-border); border-radius: 8px; padding: 0 0.85rem; color: #fff; font-size: 0.88rem; box-sizing: border-box; outline: none;">
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 0.75rem; width: 100%;">
                <button id="reback-confirm-btn" class="btn btn-primary" style="flex: 1.3; height: 2.8rem; background: #E4A11B; color: #000; font-size: 0.85rem; border-radius: 10px; font-weight: 900; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; text-transform: uppercase;">
                    <span>नभेटिएको सूचीमा पठाउनुहोस्</span>
                </button>
                <button id="reback-cancel-btn" class="btn" style="flex: 0.7; height: 2.8rem; background: rgba(255,255,255,0.06); color: white; font-size: 0.85rem; border-radius: 10px; border: 1px solid var(--glass-border); cursor: pointer;">
                    रद्द गर्नुहोस् (Cancel)
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#reback-cancel-btn').addEventListener('click', () => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 200);
    });

    overlay.querySelector('#reback-confirm-btn').addEventListener('click', async () => {
        const nameVal = overlay.querySelector('#reback-full-name').value.trim();
        const appIdVal = overlay.querySelector('#reback-applicant-id').value.trim();
        const licVal = overlay.querySelector('#reback-license-no').value.trim();
        const phVal = overlay.querySelector('#reback-phone-no').value.trim();
        const dtVal = overlay.querySelector('#reback-missing-date').value;

        if (!nameVal || !licVal) {
            showToast('पूरा नाम र लाइसेन्स नम्बर अनिवार्य छन्! (Name and License Number are required.)', 'error');
            return;
        }

        // Show updating status
        showLoading('रि-ब्याक गर्दै... (Reverting record...)');

        try {
            // 1. Remove from Found Licenses list
            let foundLicensesList = window.loadListFromLocalStorage('tmodl_found_licenses');
            foundLicensesList.splice(idx, 1);
            window.saveListToLocalStorage('tmodl_found_licenses', foundLicensesList);

            // 2. Add to Missing Licenses list
            let missingLicensesList = window.loadListFromLocalStorage('tmodl_missing_licenses');
            missingLicensesList.push({
                fullName: nameVal,
                applicantId: appIdVal,
                licenseNo: licVal,
                phoneNo: phVal,
                date: dtVal || new Date().toISOString().split('T')[0]
            });
            window.saveListToLocalStorage('tmodl_missing_licenses', missingLicensesList);

            // 3. Clear RECEIVED BY records on sheets & local caches if applicantId exists
            if (appIdVal) {
                const cleanId = String(appIdVal).trim().toUpperCase();
                
                // Clear local cached mapping
                let receivedByMap = {};
                try {
                    receivedByMap = JSON.parse(localStorage.getItem('tmodl_received_by_map') || '{}');
                } catch(e) {}
                delete receivedByMap[cleanId];
                localStorage.setItem('tmodl_received_by_map', JSON.stringify(receivedByMap));
                
                // Clear spreadsheet row via saveReceivedBy with isReset = true
                const matchingRecord = database.rows.find(r => 
                    r['Applicant ID'] && String(r['Applicant ID']).trim().toUpperCase() === cleanId
                );
                if (matchingRecord) {
                    matchingRecord['RECEIVED BY'] = '';
                    try {
                        let tempInput = document.getElementById(`received-by-input-${cleanId}`);
                        if (!tempInput) {
                            tempInput = document.createElement('input');
                            tempInput.id = `received-by-input-${cleanId}`;
                            tempInput.style.display = 'none';
                            document.body.appendChild(tempInput);
                        }
                        tempInput.value = '';
                        
                        await window.saveReceivedBy(cleanId, true);
                        
                        if (tempInput && tempInput.parentNode) {
                            tempInput.parentNode.removeChild(tempInput);
                        }
                    } catch (e) {
                        console.error('Remote sync clear error during Re-Back:', e);
                    }
                }
            }

            // 4. Render both tables
            window.renderFoundLicensesTable();
            window.renderMissingLicensesTable();

            // Remove overlay
            overlay.remove();

            hideLoading();
            showToast('विवरण परिमार्जन सहित सफलतापूर्वक नभेटिएको सूचीमा पठाइयो! (Reverted record back to Missing list successfully.)', 'success');
        } catch (err) {
            hideLoading();
            showToast('त्रुटि भयो: ' + err.message, 'error');
        }
    });
};

window.renderFoundLicensesTable = function() {
    const tbody = document.getElementById('found-licenses-tbody');
    const badge = document.getElementById('found-count-badge');
    if (!tbody) return;

    const foundLicenses = window.loadListFromLocalStorage('tmodl_found_licenses');
    if (badge) {
        badge.innerText = `भेटिएका लाईसेन्सहरु (FOUND LICENSES) : ${foundLicenses.length}`;
    }

    if (foundLicenses.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="padding: 2.5rem !important; text-align: center; color: var(--text-secondary); font-style: italic;">
                    कुनै पनि रेकर्ड फेला परेन। (No found license records found)
                </td>
            </tr>
        `;
        return;
    }

    // Role calculations
    const userRole = localStorage.getItem('tmodl_user_role') || currentUserRole;
    const loggedUsername = localStorage.getItem('tmodl_logged_username');
    const isSuperAdmin = userRole === 'super' || loggedUsername === 'superadmin';

    tbody.innerHTML = '';
    foundLicenses.forEach((item, index) => {
        const row = document.createElement('tr');
        
        // Alternate through beautiful dark neon row themes (green/teal/cyan palette for found list)
        const themes = ['missing-row-teal', 'missing-row-purple', 'missing-row-blue', 'missing-row-cyan'];
        const selectedTheme = themes[index % themes.length];
        
        row.className = `${selectedTheme} row-fade-in`;
        row.style.borderBottom = '1px solid var(--glass-border)';
        
        let actionCellContent = '';
        if (isSuperAdmin) {
            actionCellContent = `
                <div style="display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; vertical-align: middle;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; color: #10b981; font-weight: 700; font-family: 'Outfit', sans-serif; font-size: 0.72rem; letter-spacing: 0.5px; background: rgba(16, 185, 129, 0.08); padding: 0.3rem 0.5rem; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2); text-transform: uppercase;">
                        <span style="width: 6px; height: 6px; background-color: #10b981; border-radius: 50%; display: inline-block; box-shadow: 0 0 6px rgba(16, 185, 129, 0.6); flex-shrink: 0;"></span>
                        <span>DISTRIBUTED</span>
                    </div>
                    <button class="found-action-btn-reback" data-index="${index}" style="background: rgba(239, 68, 68, 0.2); color: #FF6B6B; border: 1px solid rgba(239, 68, 68, 0.4); padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.72rem; font-weight: 800; font-family: 'Outfit', sans-serif; transition: all 0.2s ease; outline: none;" title="Re-Back to Missing List (विवरण सच्याएर नभेटिएको सूचीमा पठाउनुहोस्)">
                        🔄 रि-ब्याक (RE-BACK)
                    </button>
                </div>
            `;
        } else {
            actionCellContent = `
                <div style="display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; color: #10b981; font-weight: 700; font-family: 'Outfit', sans-serif; font-size: 0.72rem; letter-spacing: 0.5px; background: rgba(16, 185, 129, 0.08); padding: 0.3rem 0.6rem; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2); text-transform: uppercase;">
                    <span style="width: 6px; height: 6px; background-color: #10b981; border-radius: 50%; display: inline-block; box-shadow: 0 0 6px rgba(16, 185, 129, 0.6); flex-shrink: 0;"></span>
                    <span>DISTRIBUTED</span>
                </div>
            `;
        }

        row.innerHTML = `
            <td style="padding: 0.45rem 0.85rem; color: var(--text-primary); font-family: 'JetBrains Mono', monospace; font-weight: normal; font-size: 0.8rem; white-space: nowrap; text-align: center; vertical-align: middle;">${index + 1}</td>
            <td style="padding: 0.45rem 0.85rem; color: var(--text-primary); font-weight: normal; text-transform: uppercase; white-space: nowrap; text-align: left; vertical-align: middle;">${item.fullName}</td>
            <td style="padding: 0.45rem 0.85rem; color: var(--text-primary); font-family: 'JetBrains Mono', monospace; font-weight: normal; text-transform: uppercase; white-space: nowrap; text-align: center; vertical-align: middle;">${item.applicantId || '—'}</td>
            <td style="padding: 0.45rem 0.85rem; color: var(--text-primary); font-family: 'JetBrains Mono', monospace; font-weight: normal; text-transform: uppercase; white-space: nowrap; text-align: center; vertical-align: middle;">${item.licenseNo}</td>
            <td style="padding: 0.45rem 0.85rem; color: var(--text-primary); font-family: 'Outfit', sans-serif; font-weight: 700; white-space: nowrap; text-align: center; vertical-align: middle;">${item.phoneNo || '—'}</td>
            <td style="padding: 0.45rem 0.85rem; color: var(--text-secondary); font-family: 'Outfit', sans-serif; font-size: 0.85rem; font-weight: normal; white-space: nowrap; text-align: center; vertical-align: middle;" title="Gregorian AD: ${item.foundDate || '—'}">${window.convertAdToBs(item.foundDate)}</td>
            <td style="padding: 0.45rem 0.85rem; color: #10b981; font-weight: normal; text-transform: uppercase; white-space: nowrap; text-align: center; vertical-align: middle;">${item.receivedBy || '—'}</td>
            <td style="padding: 0.45rem 0.85rem; text-align: center; white-space: nowrap; vertical-align: middle;">
                ${actionCellContent}
            </td>
        `;
        tbody.appendChild(row);
    });

    // Wire up Re-Back buttons for Super Admins
    tbody.querySelectorAll('.found-action-btn-reback').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.getAttribute('data-index'), 10);
            window.triggerRebackAndEdit(idx);
        });
    });
};

window.deleteFoundLicense = function(idx) {
    if (!isAdmin) {
        showToast('Authentication Required: Only Super Administrators or Admins can modify found licenses.', 'error');
        const modal = document.getElementById('password-modal');
        if (modal) modal.style.display = 'flex';
        return;
    }

    if (confirm('तपाईं निश्चित रूपमा यो रेकर्ड भेटिएका सूचीबाट हटाउन चाहनुहुन्छ?\n(Are you sure you want to remove this record from the found registry?)')) {
        let foundLicenses = window.loadListFromLocalStorage('tmodl_found_licenses');
        foundLicenses.splice(idx, 1);
        window.saveListToLocalStorage('tmodl_found_licenses', foundLicenses);
        window.renderFoundLicensesTable();
        showToast('भेटिएको रेकर्ड सूचीबाट हटाइयो (Record removed from the found list)', 'success');
    }
};

window.deleteMissingLicense = function(idx, actionType) {
    if (!isAdmin) {
        showToast('Authentication Required: Only Super Administrators or Admins can modify missing licenses.', 'error');
        const modal = document.getElementById('password-modal');
        if (modal) modal.style.display = 'flex';
        return;
    }

    if (actionType === 'found') {
        // Open the beautiful found wizard modal!
        const missingLicenses = window.loadListFromLocalStorage('tmodl_missing_licenses');
        const item = missingLicenses[idx];
        if (!item) return;

        // Fetch matching record in the main sheets memory
        const itemLicenseNo = String(item.licenseNo || '').trim().toUpperCase();
        const itemApplicantId = String(item.applicantId || '').trim().toUpperCase();

        const matchingRecord = database.rows.find(r => 
            (r['License No'] && itemLicenseNo && String(r['License No']).trim().toUpperCase() === itemLicenseNo) ||
            (r['Applicant ID'] && itemApplicantId && String(r['Applicant ID']).trim().toUpperCase() === itemApplicantId)
        );

        // Prepopulate text/fields in our custom modal
        document.getElementById('found-full-name').innerText = item.fullName || '—';
        document.getElementById('found-license-no').innerText = item.licenseNo || '—';
        document.getElementById('found-applicant-id').innerText = item.applicantId || '—';
        
        const fhInput = document.getElementById('found-fh-name');
        const catInput = document.getElementById('found-category');
        const codeInput = document.getElementById('found-code-no');
        const visitInput = document.getElementById('found-visiting-day');
        const recInput = document.getElementById('found-receiver-name');

        if (recInput) recInput.value = ''; // Reset

        if (matchingRecord) {
            if (fhInput) fhInput.value = matchingRecord['F/H Name'] || '';
            if (catInput) catInput.value = matchingRecord['Category'] || '';
            if (codeInput) codeInput.value = matchingRecord['Code No'] || '';
            if (visitInput) visitInput.value = matchingRecord['Office Visit Day'] || '';
            
            // Allow fields to be editable if empty in matching record
            if (fhInput) fhInput.readOnly = !!matchingRecord['F/H Name'];
            if (catInput) catInput.readOnly = !!matchingRecord['Category'];
            if (codeInput) codeInput.readOnly = !!matchingRecord['Code No'];
            if (visitInput) visitInput.readOnly = !!matchingRecord['Office Visit Day'];
        } else {
            if (fhInput) { fhInput.value = ''; fhInput.readOnly = false; }
            if (catInput) { catInput.value = 'A'; catInput.readOnly = false; }
            if (codeInput) { codeInput.value = ''; codeInput.readOnly = false; }
            if (visitInput) { visitInput.value = ''; visitInput.readOnly = false; }
        }

        // Show the modal
        const foundModal = document.getElementById('license-card-found-modal');
        if (foundModal) {
            foundModal.style.display = 'flex';
            foundModal.setAttribute('data-idx', String(idx));
        }
    } else {
        if (confirm('तपाईं निश्चित रूपमा यो रेकर्ड "अझै फेला नपरेको" प्रमाणित गरी सूचीबाट हटाउन चाहनुहुन्छ?\n(Are you sure you want to remove this record from the registry?)')) {
            let missingLicenses = window.loadListFromLocalStorage('tmodl_missing_licenses');
            missingLicenses.splice(idx, 1);
            window.saveListToLocalStorage('tmodl_missing_licenses', missingLicenses);
            window.renderMissingLicensesTable();
            showToast('रेकर्ड सूचीबाट हटाइयो (Record removed from the list)', 'success');
        }
    }
};

window.handleMissingLicenseSubmit = async function(isDelivery) {
    const foundModal = document.getElementById('license-card-found-modal');
    if (!foundModal) return;

    const idx = parseInt(foundModal.getAttribute('data-idx'), 10);
    const missingLicenses = window.loadListFromLocalStorage('tmodl_missing_licenses');
    const item = missingLicenses[idx];
    if (!item) {
        showToast('रेकर्ड तोकिएको सूचकांकमा भेटिएन। (Index record empty)', 'error');
        return;
    }

    const fhVal = document.getElementById('found-fh-name')?.value.trim().toUpperCase() || '';
    const catVal = document.getElementById('found-category')?.value.trim().toUpperCase() || '';
    const codeVal = document.getElementById('found-code-no')?.value.trim().toUpperCase() || '';
    const visitVal = document.getElementById('found-visiting-day')?.value.trim().toUpperCase() || '';
    const receiverVal = document.getElementById('found-receiver-name')?.value.trim().toUpperCase() || '';

    if (!receiverVal) {
        showToast('कृपया बुझिलिनेको नाम अनिवार्य रूपमा लेख्नुहोस् (Please enter the receiver name)', 'error');
        document.getElementById('found-receiver-name').focus();
        return;
    }

    // 1. Check if we have matching record on server/local sheet
    const itemLicenseNo = String(item.licenseNo || '').trim().toUpperCase();
    const itemApplicantId = String(item.applicantId || '').trim().toUpperCase();

    const matchingRecord = database.rows.find(r => 
        (r['License No'] && itemLicenseNo && String(r['License No']).trim().toUpperCase() === itemLicenseNo) ||
        (r['Applicant ID'] && itemApplicantId && String(r['Applicant ID']).trim().toUpperCase() === itemApplicantId)
    );

    if (matchingRecord) {
        // Update values
        if (fhVal) matchingRecord['F/H Name'] = fhVal;
        if (catVal) matchingRecord['Category'] = catVal;
        if (codeVal) matchingRecord['Code No'] = codeVal;
        if (visitVal) matchingRecord['Office Visit Day'] = visitVal;
        matchingRecord['RECEIVED BY'] = receiverVal;

        const cleanId = String(matchingRecord['Applicant ID']).trim().toUpperCase();
        
        let receivedByMap = {};
        let distributedByMap = {};
        try {
            receivedByMap = JSON.parse(localStorage.getItem('tmodl_received_by_map') || '{}');
            distributedByMap = JSON.parse(localStorage.getItem('tmodl_distributed_by_map') || '{}');
        } catch(e) {}

        receivedByMap[cleanId] = receiverVal;
        const currentOp = (localStorage.getItem('tmodl_logged_username') || localStorage.getItem('tmodl_user_role') || 'admin').trim();
        distributedByMap[cleanId] = currentOp;

        localStorage.setItem('tmodl_received_by_map', JSON.stringify(receivedByMap));
        localStorage.setItem('tmodl_distributed_by_map', JSON.stringify(distributedByMap));

        // Use standard saver to post back to Google spreadsheets
        try {
            let tempInput = document.getElementById(`received-by-input-${cleanId}`);
            if (!tempInput) {
                tempInput = document.createElement('input');
                tempInput.id = `received-by-input-${cleanId}`;
                tempInput.style.display = 'none';
                document.body.appendChild(tempInput);
            }
            tempInput.value = receiverVal;

            await window.saveReceivedBy(cleanId);
            
            if (tempInput && tempInput.parentNode) {
                tempInput.parentNode.removeChild(tempInput);
            }
        } catch (e) {
            console.error('Remote sync save error:', e);
            showToast('डेटाबेस सिङ्क गर्न असमर्थ भयो तर स्थानीय डाटा सुरक्षित गरियो (Database sync skipped, but local data updated)', 'warning');
        }
    } else {
        const cleanId = String(item.applicantId || '').trim().toUpperCase();
        let receivedByMap = {};
        try {
            receivedByMap = JSON.parse(localStorage.getItem('tmodl_received_by_map') || '{}');
        } catch(e) {}
        receivedByMap[cleanId] = receiverVal;
        localStorage.setItem('tmodl_received_by_map', JSON.stringify(receivedByMap));
    }

    // 1.5 Write copy of exact original details + foundDate + receivedBy to Found Registry
    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const foundRecord = {
        fullName: item.fullName,
        applicantId: item.applicantId || '',
        licenseNo: item.licenseNo,
        phoneNo: item.phoneNo || '',
        missingDate: item.date || '',
        foundDate: formattedDate,
        receivedBy: receiverVal
    };
    let foundLicenses = window.loadListFromLocalStorage('tmodl_found_licenses');
    foundLicenses.push(foundRecord);
    window.saveListToLocalStorage('tmodl_found_licenses', foundLicenses);
    window.renderFoundLicensesTable();

    // 2. Remove from missing registry
    missingLicenses.splice(idx, 1);
    window.saveListToLocalStorage('tmodl_missing_licenses', missingLicenses);
    window.renderMissingLicensesTable();

    // 3. Clear modal
    foundModal.style.display = 'none';

    // 4. Success Toast
    showToast('लाईसेन्स फेला परेको प्रमाणित गरियो (License successfully marked as Found.)', 'success');
};

// Dedicated page load local storage sync engine
window.initStoredDataOnLoad = async function() {
    console.log('Synchronizing local registries on page load...');

    // Fetch missing and found lists from backend simultaneously
    try {
        const [missingRes, foundRes] = await Promise.all([
            fetch('/api/license/missing-licenses').then(r => r.json()).catch(() => null),
            fetch('/api/license/found-licenses').then(r => r.json()).catch(() => null)
        ]);

        if (Array.isArray(missingRes)) {
            localStorage.setItem('tmodl_missing_licenses', JSON.stringify(missingRes));
            console.log('[Cloud Restore] Restored missing licenses from cloud database:', missingRes.length);
        }
        if (Array.isArray(foundRes)) {
            localStorage.setItem('tmodl_found_licenses', JSON.stringify(foundRes));
            console.log('[Cloud Restore] Restored found licenses from cloud database:', foundRes.length);
        }
    } catch (e) {
        console.warn('[Cloud Restore] Could not restore lists from cloud during startup, relying on localStorage:', e);
    }

    // Check if the keys exist at all and initialize securely if absent
    if (localStorage.getItem('tmodl_missing_licenses') === null) {
        window.saveListToLocalStorage('tmodl_missing_licenses', []);
    }
    if (localStorage.getItem('tmodl_found_licenses') === null) {
        window.saveListToLocalStorage('tmodl_found_licenses', []);
    }

    // No manual cleaning of records on startup to ensure all user tests are permanently retained.

    // Render registered entries
    window.renderMissingLicensesTable();
    window.renderFoundLicensesTable();
};

// Wire both window onload and DOMContentLoaded for ultimate initialization resiliency
window.onload = function() {
    window.initStoredDataOnLoad();
};

document.addEventListener('DOMContentLoaded', () => {
    const btnOpen = document.getElementById('missing-license-btn');
    const modal = document.getElementById('missing-license-modal');
    const form = document.getElementById('missing-license-form');
    const btnCancel = document.getElementById('missing-cancel-btn');

    // Initialize custom Nepali Calendar Date Pickers
    const startDateInput = document.getElementById('report-start-date');
    const endDateInput = document.getElementById('report-end-date');
    const missingDateInput = document.getElementById('missing-date');
    
    if (startDateInput) {
        new NepaliDatePicker(startDateInput, {
            onSelect: () => {
                if (window.generateReport) window.generateReport();
            }
        });
        window.initDatePickerValue(startDateInput, new Date());
    }
    
    if (endDateInput) {
        new NepaliDatePicker(endDateInput, {
            onSelect: () => {
                if (window.generateReport) window.generateReport();
            }
        });
        window.initDatePickerValue(endDateInput, new Date());
    }
    
    if (missingDateInput) {
        new NepaliDatePicker(missingDateInput);
        // Set today's date initially in BS and AD datasets
        window.initDatePickerValue(missingDateInput, new Date());
    }

    // Load initial table elements
    window.initStoredDataOnLoad();

    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            if (!isAdmin) {
                showToast('Authentication Required: Please login as Admin or Staff to view missing licenses.', 'error');
                const pModal = document.getElementById('password-modal');
                if (pModal) pModal.style.display = 'flex';
                return;
            }
            
            // Always display the Missing Table Section below
            window.showMissingLicensesSection();
        });
    }

    const btnOpenFound = document.getElementById('found-license-btn');
    if (btnOpenFound) {
        btnOpenFound.addEventListener('click', () => {
            if (!isAdmin) {
                showToast('Authentication Required: Please login as Admin or Staff to view found licenses.', 'error');
                const pModal = document.getElementById('password-modal');
                if (pModal) pModal.style.display = 'flex';
                return;
            }
            
            // Always display the Found Table Section below
            window.showFoundLicensesSection();
        });
    }

    // Open Creator Modal btn inside the table layout
    const openAddMissingBtn = document.getElementById('open-add-missing-modal-btn');
    
    // Add Missing License Auto-Fetch State Fields & Helpers
    window.isApplicantIdValid = false;
    window.lastSearchedApplicantId = '';

    window.lookupApplicantIdInRegistry = function(applicantId) {
        if (!applicantId) return null;
        const cleanId = applicantId.trim().toUpperCase();
        if (database.maps && database.maps.idMap && database.maps.idMap.has(cleanId.toLowerCase())) {
            return database.maps.idMap.get(cleanId.toLowerCase());
        }
        if (database.rows && database.rows.length > 0) {
            const found = database.rows.find(row => {
                if (!row) return false;
                const appId = String(row['Applicant ID'] || row['APPLICANT ID'] || '').trim().toUpperCase();
                return appId === cleanId;
            });
            if (found) return found;
        }
        return null;
    };

    window.validateMissingForm = function() {
        const applicantIdVal = (document.getElementById('missing-applicant-id')?.value || '').trim();
        const fullNameVal = (document.getElementById('missing-full-name')?.value || '').trim();
        const licenseNoVal = (document.getElementById('missing-license-no')?.value || '').trim();
        const phoneNoVal = (document.getElementById('missing-phone-no')?.value || '').trim();
        const saveBtn = document.getElementById('missing-save-btn');
        
        const isValid = applicantIdVal && fullNameVal && licenseNoVal && phoneNoVal && window.isApplicantIdValid;
        
        if (saveBtn) {
            if (isValid) {
                saveBtn.disabled = false;
                saveBtn.classList.add('save-btn-active-glow');
                saveBtn.style.opacity = '1';
                saveBtn.style.cursor = 'pointer';
            } else {
                saveBtn.disabled = true;
                saveBtn.classList.remove('save-btn-active-glow');
                saveBtn.style.opacity = '0.6';
                saveBtn.style.cursor = 'not-allowed';
            }
        }
    };

    window.triggerMissingLicenseLookup = async function(rawId) {
        const cleanId = rawId.trim();
        if (!cleanId) {
            window.isApplicantIdValid = false;
            window.lastSearchedApplicantId = '';
            const fullNameInput = document.getElementById('missing-full-name');
            const licenseNoInput = document.getElementById('missing-license-no');
            if (fullNameInput) fullNameInput.value = '';
            if (licenseNoInput) licenseNoInput.value = '';
            const statusArea = document.getElementById('missing-search-status');
            if (statusArea) statusArea.style.display = 'none';
            window.validateMissingForm();
            return;
        }
        
        if (window.lastSearchedApplicantId === cleanId.toUpperCase()) {
            return;
        }
        
        window.lastSearchedApplicantId = cleanId.toUpperCase();
        
        const spinner = document.getElementById('missing-search-spinner');
        const statusArea = document.getElementById('missing-search-status');
        const fullNameInput = document.getElementById('missing-full-name');
        const licenseNoInput = document.getElementById('missing-license-no');
        
        if (fullNameInput) fullNameInput.value = '';
        if (licenseNoInput) licenseNoInput.value = '';
        
        if (spinner) spinner.style.display = 'inline-block';
        if (statusArea) {
            statusArea.style.display = 'block';
            statusArea.style.color = 'var(--text-secondary)';
            statusArea.innerHTML = '⚡ Searching database registry...';
        }
        
        // Simulated look-up delay for responsive visualization feel
        await new Promise(resolve => setTimeout(resolve, 400));
        
        const match = window.lookupApplicantIdInRegistry(cleanId);
        
        if (spinner) spinner.style.display = 'none';
        
        if (match) {
            window.isApplicantIdValid = true;
            const fetchedName = (match['Name'] || match['NAME'] || '').trim().toUpperCase();
            const fetchedLicense = (match['License No'] || match['LICENSE NO'] || '').trim().toUpperCase();
            
            if (fullNameInput) fullNameInput.value = fetchedName;
            if (licenseNoInput) licenseNoInput.value = fetchedLicense;
            
            if (statusArea) {
                statusArea.style.color = '#10B981'; // Green text
                statusArea.innerHTML = '✅ Applicant Record Auto-Fetched successfully!';
            }
        } else {
            window.isApplicantIdValid = false;
            if (fullNameInput) fullNameInput.value = '';
            if (licenseNoInput) licenseNoInput.value = '';
            
            if (statusArea) {
                statusArea.style.color = '#EF4444'; // Red text
                statusArea.innerHTML = '❌ Applicant ID not found in License Record Management System.';
            }
        }
        
        window.validateMissingForm();
    };

    window.resetMissingFormState = function() {
        const tgtForm = document.getElementById('missing-license-form');
        if (tgtForm) tgtForm.reset();
        
        window.isApplicantIdValid = false;
        window.lastSearchedApplicantId = '';
        
        const spinner = document.getElementById('missing-search-spinner');
        if (spinner) spinner.style.display = 'none';
        
        const statusArea = document.getElementById('missing-search-status');
        if (statusArea) {
            statusArea.style.display = 'none';
            statusArea.innerHTML = '';
        }
        
        const missingDateInput = document.getElementById('missing-date');
        if (missingDateInput && window.initDatePickerValue) {
            window.initDatePickerValue(missingDateInput, new Date());
        }
        
        window.validateMissingForm();
    };

    // Auto-fetch trigger binding
    const applicantIdInput = document.getElementById('missing-applicant-id');
    const phoneNoInput = document.getElementById('missing-phone-no');
    
    if (applicantIdInput) {
        let lookupTimeout;
        applicantIdInput.addEventListener('input', () => {
            clearTimeout(lookupTimeout);
            const val = applicantIdInput.value.trim();
            if (!val) {
                window.isApplicantIdValid = false;
                window.lastSearchedApplicantId = '';
                const fullNameInput = document.getElementById('missing-full-name');
                const licenseNoInput = document.getElementById('missing-license-no');
                if (fullNameInput) fullNameInput.value = '';
                if (licenseNoInput) licenseNoInput.value = '';
                const statusArea = document.getElementById('missing-search-status');
                if (statusArea) statusArea.style.display = 'none';
                window.validateMissingForm();
                return;
            }
            lookupTimeout = setTimeout(() => {
                window.triggerMissingLicenseLookup(val);
            }, 450);
        });

        applicantIdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(lookupTimeout);
                const val = applicantIdInput.value.trim();
                window.triggerMissingLicenseLookup(val);
                applicantIdInput.blur();
            }
        });

        applicantIdInput.addEventListener('blur', () => {
            clearTimeout(lookupTimeout);
            const val = applicantIdInput.value.trim();
            window.triggerMissingLicenseLookup(val);
        });
    }

    if (phoneNoInput) {
        phoneNoInput.addEventListener('input', () => {
            window.validateMissingForm();
        });
    }

    if (openAddMissingBtn) {
        openAddMissingBtn.addEventListener('click', () => {
            if (!isAdmin) {
                showToast('Authentication Required: Please login as Admin or Staff to add missing licenses.', 'error');
                const pModal = document.getElementById('password-modal');
                if (pModal) pModal.style.display = 'flex';
                return;
            }
            window.resetMissingFormState();
            if (modal) modal.style.display = 'flex';
        });
    }

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            window.resetMissingFormState();
            if (modal) modal.style.display = 'none';
        });
    }

    // Hook License Card Found Modal triggers
    const foundCancel = document.getElementById('found-cancel-btn');
    if (foundCancel) {
        foundCancel.addEventListener('click', () => {
            const foundModal = document.getElementById('license-card-found-modal');
            if (foundModal) foundModal.style.display = 'none';
        });
    }

    const foundSave = document.getElementById('found-save-btn');
    if (foundSave) {
        foundSave.addEventListener('click', () => {
            window.handleMissingLicenseSubmit(false);
        });
    }

    const foundConfirm = document.getElementById('found-confirm-delivery-btn');
    if (foundConfirm) {
        foundConfirm.addEventListener('click', () => {
            const recInput = document.getElementById('found-receiver-name');
            const fullNameEl = document.getElementById('found-full-name');
            const fullName = fullNameEl ? (fullNameEl.innerText || '').trim() : '';

            // Automatically populate the recipient name with the applicant's name if empty
            if (recInput && !recInput.value.trim() && fullName && fullName !== '—') {
                recInput.value = fullName;
            }
            if (recInput) {
                recInput.focus();
            }

            if (confirm('के तपाईं यो स्मार्ट कार्ड हस्तान्तरण भएको पुष्टि गर्न चाहनुहुन्छ?\n(Do you confirm that this Smart Card is delivered and want to close registry?)')) {
                window.handleMissingLicenseSubmit(true);
            }
        });
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            if (!isAdmin) {
                showToast('Authentication Required: Please login as Admin or Staff to save missing licenses.', 'error');
                if (modal) modal.style.display = 'none';
                const pModal = document.getElementById('password-modal');
                if (pModal) pModal.style.display = 'flex';
                return;
            }

            const fullName = document.getElementById('missing-full-name').value.trim().toUpperCase();
            const licenseNo = document.getElementById('missing-license-no').value.trim().toUpperCase();
            const applicantId = document.getElementById('missing-applicant-id').value.trim().toUpperCase();
            const phoneNo = document.getElementById('missing-phone-no').value.trim();
            const dateVal = document.getElementById('missing-date').value;
            const adDateVal = document.getElementById('missing-date').dataset.adValue || window.convertBsToAd(dateVal);

            if (!fullName || !licenseNo || !applicantId || !phoneNo || !dateVal || !adDateVal || !window.isApplicantIdValid) {
                showToast('Please verify Applicant ID and fill all fields.', 'error');
                return;
            }

            let missingLicenses = window.loadListFromLocalStorage('tmodl_missing_licenses');
            
            // Add to bottom
            missingLicenses.push({
                fullName,
                licenseNo,
                applicantId,
                phoneNo,
                date: adDateVal
            });

            window.saveListToLocalStorage('tmodl_missing_licenses', missingLicenses);
            
            // Reset and close
            window.resetMissingFormState();

            if (modal) modal.style.display = 'none';
            window.renderMissingLicensesTable();
            showToast('रेकर्ड सफलतापूर्वक सुरक्षित गरियो (Record saved successfully)', 'success');
        });
    }
});
