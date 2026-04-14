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

  /**
   * fetch로 GAS API 호출
   */
  async function _callGAS(action, params) {
    const baseUrl = global.GAS_API_URL;
    if (!baseUrl) {
      throw new Error('[gas-bridge] window.GAS_API_URL 이 설정되지 않았습니다.');
    }

    console.log('[gas-bridge] 호출:', action, params);

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

    if (json.success === false) {
      throw new Error(json.error || '알 수 없는 오류');
    }

    return json.data !== undefined ? json.data : json;
  }

  /**
   * google.script.run 폴리필
   * ⭐ 핵심 수정: withSuccessHandler/withFailureHandler도 항상 같은 Proxy를 반환
   *    → 체이닝의 마지막에 어떤 함수명이 오더라도 Proxy가 가로채서 처리함
   */
  function _createCallContext() {
    let _successHandler = null;
    let _failureHandler = null;

    const proxy = new Proxy({}, {
      get(target, prop) {
        // 체이닝 메서드 — proxy 자신을 반환해야 이후 .funcName()도 Proxy를 통함
        if (prop === 'withSuccessHandler') {
          return function(fn) {
            _successHandler = fn;
            return proxy;
          };
        }
        if (prop === 'withFailureHandler') {
          return function(fn) {
            _failureHandler = fn;
            return proxy;
          };
        }

        // GAS 함수 호출 (checkLogin, saveBadgeThresholds 등 모든 함수명)
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

    return proxy;
  }

  /**
   * google.script.run 에 접근할 때마다 새 컨텍스트를 반환하는 최상위 Proxy
   */
  const gasRunProxy = new Proxy({}, {
    get(_target, prop) {
      const ctx = _createCallContext();
      // withSuccessHandler / withFailureHandler 직접 접근도 지원
      if (prop === 'withSuccessHandler' || prop === 'withFailureHandler') {
        return ctx[prop];
      }
      // google.script.run.checkLogin(...) 처럼 바로 함수 호출도 지원
      return ctx[prop];
    }
  });

  // ── 전역 등록 ──────────────────────────────────────────────────────────────
  if (typeof global.google === 'undefined') {
    global.google = {};
  }
  if (typeof global.google.script === 'undefined') {
    global.google.script = {};
  }
  global.google.script.run = gasRunProxy;

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
