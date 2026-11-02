/* Adapt the existing dashboard RPC calls to the code-protected HTTPS backend. */
(() => {
  'use strict';
  const endpoint = 'https://script.google.com/macros/s/AKfycbzughLfW4vcpW4eujWa4CDf87O7rurrAAi1kMTQ8s8utUwJX6CN0M0wdxIHvozqQ_JQ/exec';
  async function request(action, code, token) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'omit', redirect: 'follow',
        headers: {'Content-Type': 'text/plain;charset=UTF-8'},
        body: JSON.stringify({action, code, token}), signal: controller.signal,
      });
      if (!response.ok) throw new Error('The data service is unavailable. Please retry.');
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error || 'Could not complete the request.');
      return payload.data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The data service took too long. Please retry.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function runner(success = () => {}, failure = () => {}) {
    const call = (action, code, token) => request(action, code, token).then(success, failure);
    return {
      withSuccessHandler: fn => runner(fn, failure),
      withFailureHandler: fn => runner(success, fn),
      authenticateLeadership: (code, token) => call('login', code, token),
      getLeadershipData: token => call('data', undefined, token),
      lockLeadershipSession: token => call('lock', undefined, token),
    };
  }
  window.google = {script: {run: runner()}};
})();
