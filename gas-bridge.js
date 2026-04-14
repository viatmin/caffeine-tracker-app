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

    console.log('[gas-bridge] 호출:', action, params);

    // ── GET 방식으로 전송 (CORS 문제 우회) ─────────────────
    // GAS는 GET 요청에 대해 CORS 헤더를 정상적으로 반환함
    const url = new URL(baseUrl);
    url.searchParams.set('action', action);
    url.searchParams.set('params', JSON.stringify(params));

    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
    });

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
   * google.script.run 폴리필
   * 체이닝 지원: .withSuccessHandler(fn).withFailureHandler(fn).funcName(args)
   *
   * ⭐ 호출마다 독립적인 컨텍스트를 생성하여 동시 다중 호출 시
   *    핸들러가 서로 덮어쓰이는 버그를 방지합니다.
   */
  function _createCallContext() {
    let _successHandler = null;
    let _failureHandler = null;

    const ctx = {
      withSuccessHandler(fn) {
        _successHandler = fn;
        return ctx;
      },
      withFailureHandler(fn) {
        _failureHandler = fn;
        return ctx;
      },
    };

    return new Proxy(ctx, {
      get(target, prop) {
        if (prop in target) return target[prop];

        // GAS 함수 호출
        return function (...args) {
          const onSuccess = _successHandler;
          const onFailure = _failureHandler;

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
  }

  /**
   * google.script.run 에 접근할 때마다 새 컨텍스트를 반환하는 최상위 Proxy
   */
  const gasRunProxy = new Proxy({}, {
    get(_target, prop) {
      // 매 접근마다 독립 컨텍스트 생성 → 동시 호출 간 핸들러 충돌 없음
      const ctx = _createCallContext();
      return ctx[prop] !== undefined ? ctx[prop] : ctx.withSuccessHandler.bind(ctx);
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
