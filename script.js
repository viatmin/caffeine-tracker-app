// script.js

// !!! 중요: 여기에 배포된 Google Apps Script 웹 앱 URL을 붙여넣으세요.
// 예를 들어, 'https://script.google.com/macros/s/AKfycbz_YOUR_DEPLOYMENT_ID/exec'
// 이 URL은 Apps Script 배포 후 얻게 됩니다.
const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/library/d/1POic6lHefSrYrZFdgjnnxvqu4F9ltxuEMG9ojRiodzMbf6iDRcDrx6xD/4'; // 이 값을 반드시 업데이트하세요!

// 이 함수는 사용자에게 앱스 스크립트 URL을 입력하라고 알려주는 용도로만 사용됩니다.
// 실제 배포 시에는 위 APPS_SCRIPT_WEB_APP_URL에 URL을 직접 입력해야 합니다.
function checkAppsScriptUrlAndPrompt() {
    if (APPS_SCRIPT_WEB_APP_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE' || !APPS_SCRIPT_WEB_APP_URL.startsWith('https://script.google.com/macros/s/')) {
        showCustomAlert("⚠️ Apps Script 웹 앱 URL을 설정해야 합니다! 이 앱을 사용하려면 `script.js` 파일에서 `APPS_SCRIPT_WEB_APP_URL` 변수를 업데이트해주세요.");
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', function() {
    const weightInput = document.getElementById('weightInput');
    const gradeInput = document.getElementById('gradeInput');
    const classNumInput = document.getElementById('classNumInput');
    const studentNumInput = document.getElementById('studentNumInput');
    const studentNameInput = document.getElementById('studentNameInput');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn'); // 설정 저장 버튼 추가

    const recommendedCaffeineSpan = document.getElementById('recommendedCaffeine');
    const currentCaffeineSpan = document.getElementById('currentCaffeine');
    const caffeineProgressBar = document.getElementById('caffeineProgressBar');
    const caffeinePercentageSpan = document.getElementById('caffeinePercentage');
    const predefinedDrinksSelect = document.getElementById('predefinedDrinks');
    const foodNameInput = document.getElementById('foodName');
    const amountInput = document.getElementById('amount');
    const caffeineMgInput = document.getElementById('caffeineMg');
    const addEntryBtn = document.getElementById('addEntryBtn');

    // 모달 관련 요소
    const bodyStatusModal = document.getElementById('bodyStatusModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const humanModel = document.getElementById('humanModel');
    const caffeineStatusText = document.getElementById('caffeineStatusText');
    const statusDescription = document.getElementById('statusDescription');

    // 사용자 정의 알림 모달 요소
    const customAlertModal = document.getElementById('customAlertModal');
    const customAlertMessage = document.getElementById('customAlertMessage');
    const closeCustomAlertBtn = document.getElementById('closeCustomAlertBtn');

    let currentUserId = localStorage.getItem('caffeineTrackerUserId'); // 로컬 스토리지에서 사용자 ID 로드
    if (!currentUserId) {
        currentUserId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now(); // 고유 ID 생성
        localStorage.setItem('caffeineTrackerUserId', currentUserId); // 로컬 스토리지에 저장
    }

    // 사용자 정의 알림 모달을 표시하는 함수
    function showCustomAlert(message) {
        customAlertMessage.textContent = message;
        customAlertModal.classList.add('visible');

        closeCustomAlertBtn.onclick = function() {
            customAlertModal.classList.remove('visible');
        };
    }

    // Apps Script API 호출을 위한 범용 fetch 헬퍼 함수
    async function callAppsScriptAPI(action, method = 'GET', data = null) {
        if (!checkAppsScriptUrlAndPrompt()) {
            return { error: "Apps Script URL이 설정되지 않았습니다." };
        }

        let url = `${APPS_SCRIPT_WEB_APP_URL}?action=${action}&userId=${currentUserId}`;
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (data && method === 'POST') {
            options.body = JSON.stringify({ ...data, action: action, userId: currentUserId });
        } else if (data && method === 'GET') {
             // GET 요청의 경우 URL 쿼리 파라미터에 데이터 추가 (간단한 데이터에만 적합)
             // 현재 API 설계는 action과 userId만 GET 파라미터로 사용
             // 더 복잡한 GET 요청 데이터는 필요시 여기에 추가
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP 오류! 상태: ${response.status}, 응답: ${errorText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Apps Script API 호출 오류:', error);
            showCustomAlert('데이터 처리 중 오류가 발생했습니다: ' + error.message);
            return { error: error.message };
        }
    }

    // 초기 데이터 로드 및 UI 업데이트
    async function loadInitialData() {
        const settings = await callAppsScriptAPI('getUserSettings', 'GET');
        if (settings && !settings.error) {
            // 사용자 설정 UI 업데이트
            if (settings.weight) weightInput.value = settings.weight;
            if (settings.grade) gradeInput.value = settings.grade;
            if (settings.classNum) classNumInput.value = settings.classNum;
            if (settings.studentNum) studentNumInput.value = settings.studentNum;
            if (settings.studentName) studentNameInput.value = settings.studentName;
            updateRecommendedCaffeineUI(settings.recommendedCaffeine);
        }

        const summary = await callAppsScriptAPI('getDailyCaffeineSummary', 'GET');
        if (summary && !summary.error) {
            updateCaffeineSummaryUI(summ