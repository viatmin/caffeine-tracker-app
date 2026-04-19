/**
 * gas-bridge.js
 * ─────────────────────────────────────────────────────────────────────────────
 * GitHub Pages에서 google.script.run 을 그대로 사용할 수 있도록 폴리필하는 모듈.
 *
 * 사용법:
 *   1. <script src="gas-bridge.js"></script> 를 HTML에 추가
 *   2. GAS_API_URL 에 배포된 GAS 웹앱 URL 입력 (index.html에서 window.GAS_API_URL 설정)
 *   3. 기존 google.script.run.XXX(...) 코드는 수정 없이 그대로 동작
 *
 * 동작 원리:
 *   google.script.run.checkLogin(id, name)
 *   → fetch(GAS_API_URL, { method:'POST', body: { action:'checkLogin', params:[id,name] } })
 *   → GAS doPost() → 구글 시트 연동 → 결과 반환
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function (global) {
  'use strict';

  // ── GAS 웹앱 URL (index.html에서 window.GAS_API_URL = '...' 로 설정) ──────
  // 또는 이 파일 상단에서 직접 설정 가능
  // const GAS_API_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

  // ── 내부 상태 ─────────────────────────────────────────────────────────────
  let _successHandler = null;
  let _failureHandler = null;

  /**
   * fetch로 GAS API 호출
   * @param {string} action  - 호출할 GAS 함수명
   * @param {Array}  params  - 함수 인자 배열
   */
  async function _callGAS(action, params) {
    const baseUrl = global.GAS_API_URL;
    if (!baseUrl) {
      throw new Error('[gas-bridge] window.GAS_API_URL 이 설정되지 않았습니다.');
    }

    const paramsJson = JSON.stringify(params);
    console.log('[gas-bridge] 호출:', action, '| params 길이:', paramsJson.length);

    // ── 전송 방식 자동 선택 ─────────────────────────────────
    // params가 크면(1500자 초과) POST + text/plain 사용
    // (text/plain은 CORS 단순 요청 → preflight 없음)
    // params가 작으면 기존 GET 방식 유지
    const USE_POST = paramsJson.length > 1500;
    let res;

    if (USE_POST) {
      console.log('[gas-bridge] POST 방식 사용 (대용량 데이터)');
      res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // preflight 없이 CORS 통과
        body: JSON.stringify({ action, params }),
        redirect: 'follow',
      });
    } else {
      const url = new URL(baseUrl);
      url.searchParams.set('action', action);
      url.searchParams.set('params', paramsJson);
      res = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow',
      });
    }

    if (!res.ok) {
      throw new Error(`HTTP 오류: ${res.status}`);
    }

    const json = await res.json();
    console.log('[gas-bridge] 응답:', action, json);

    // GAS handleAPIRequest가 { success, data } 형태로 반환
    if (json.success === false) {
      throw new Error(json.error || '알 수 없는 오류');
    }

    return json.data !== undefined ? json.data : json;
  }

  /**
   * google.script.run 폴리필 객체
   * 체이닝 지원: .withSuccessHandler(fn).withFailureHandler(fn).funcName(args)
   */
  const scriptRunProxy = {
    // 핸들러 등록 메서드 (체이닝 반환)
    withSuccessHandler(fn) {
      _successHandler = fn;
      return this;
    },
    withFailureHandler(fn) {
      _failureHandler = fn;
      return this;
    },
  };

  /**
   * Proxy로 임의 함수명 호출을 가로채서 GAS API 요청으로 변환
   */
  const gasRunProxy = new Proxy(scriptRunProxy, {
    get(target, prop) {
      // 기존 메서드(withSuccessHandler 등)는 그대로 반환
      if (prop in target) return target[prop];

      // 그 외 속성 접근 = GAS 함수 호출로 간주
      return function (...args) {
        // 핸들러를 지역 변수에 캡처 (연속 호출 간 덮어쓰기 방지)
        const onSuccess = _successHandler;
        const onFailure = _failureHandler;

        // 핸들러 초기화 (다음 호출을 위해)
        _successHandler = null;
        _failureHandler = null;

        _callGAS(prop, args)
          .then(result => {
            if (typeof onSuccess === 'function') onSuccess(result);
          })
          .catch(err => {
            console.error('[gas-bridge] 오류:', prop, err);
            if (typeof onFailure === 'function') {
              onFailure({ message: err.message });
            }
          });
      };
    }
  });

  // ── 전역 등록 ──────────────────────────────────────────────────────────────
  // google.script.run 을 폴리필로 교체
  if (typeof global.google === 'undefined') {
    global.google = {};
  }
  if (typeof global.google.script === 'undefined') {
    global.google.script = {};
  }
  global.google.script.run = gasRunProxy;

  // google.script.history, google.script.host 등 빈 객체로 폴백
  global.google.script.history = global.google.script.history || {
    push: () => {},
    replace: () => {},
  };
  global.google.script.host = global.google.script.host || {
    close: () => {},
    editor: { focus: () => {} },
  };
  global.google.script.url = global.google.script.url || {
    getActive: () => global.location.href,
    getLocation: cb => cb && cb({ parameter: {}, hash: '' }),
  };

  console.log('[gas-bridge] 초기화 완료 — google.script.run 폴리필 활성화');

})(typeof window !== 'undefined' ? window : globalThis);
