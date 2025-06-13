const BASE_URL = "https://script.google.com/macros/s/AKfycbwXuVeQYg6kOXrWkVXrJ8ElYgK9xOkamCNqaNebhNKVXPZdH4PRqzb65qLiWTAON8ji/exec";

document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
  const settings = {
    grade: document.getElementById("gradeInput").value,
    classNum: document.getElementById("classNumInput").value,
    studentNum: document.getElementById("studentNumInput").value,
    studentName: document.getElementById("studentNameInput").value,
    weight: parseFloat(document.getElementById("weightInput").value)
  };

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "saveUserSettings", settings: settings })
  });

  const result = await response.json();
  if (result.recommendedCaffeine) {
    document.getElementById("recommendedCaffeine").innerText = result.recommendedCaffeine.toFixed(1);
    updateCaffeineSummary();
    showCustomAlert("설정이 저장되었습니다!");
  } else {
    showCustomAlert("설정 저장 실패. 다시 시도해주세요.");
  }
});

document.getElementById("addEntryBtn").addEventListener("click", async () => {
  const entry = {
    name: document.getElementById("foodName").value,
    amount: parseFloat(document.getElementById("amount").value),
    caffeineMg: parseFloat(document.getElementById("caffeineMg").value)
  };

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addCaffeineEntry", entry: entry })
  });

  const result = await response.json();
  updateCaffeineSummary(result);
  showCustomAlert("섭취 기록이 추가되었습니다!");
});

async function updateCaffeineSummary() {
  const response = await fetch(`${BASE_URL}?action=getDailyCaffeineSummary`);
  const result = await response.json();
  document.getElementById("currentCaffeine").innerText = result.cumulativeCaffeine.toFixed(1);
  document.getElementById("caffeinePercentage").innerText = result.percentage.toFixed(1) + "%";
  document.getElementById("caffeineProgressBar").style.width = result.percentage.toFixed(1) + "%";
}

// 선택 음료 자동 입력 (선택사항)
document.getElementById("predefinedDrinks").addEventListener("change", async (e) => {
  const selected = e.target.value;
  if (!selected) return;
  const response = await fetch(`${BASE_URL}?action=getPredefinedCaffeineData`);
  const data = await response.json();
  const item = data.find(d => d.name === selected);
  if (item) {
    document.getElementById("foodName").value = item.name;
    document.getElementById("amount").value = item.amount;
    document.getElementById("caffeineMg").value = item.caffeine;
  }
});

// 커스텀 알림 모달
function showCustomAlert(message) {
  document.getElementById("customAlertMessage").innerText = message;
  document.getElementById("customAlertModal").style.display = "block";
}
document.getElementById("closeCustomAlertBtn").addEventListener("click", () => {
  document.getElementById("customAlertModal").style.display = "none";
});

// 초기 데이터 로드
window.addEventListener("load", () => {
  updateCaffeineSummary();
});
