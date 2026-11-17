// Shared by every page: send the user to the login page when the session ends,
// and after "Cerrar sesión".
(function () {
  const realFetch = window.fetch.bind(window);
  const toLogin = () => {
    const next = location.pathname + location.search;
    location.href = '/login.html' + (next && next !== '/' ? '?next=' + encodeURIComponent(next) : '');
  };
  window.fetch = async function (input, init) {
    const res = await realFetch(input, init);
    try {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
        if (url.pathname === '/api/logout' && res.ok) location.href = '/login.html';
        else if (res.status === 401 && url.pathname !== '/api/login') toLogin();
      }
    } catch (e) { /* never break the page's own fetch */ }
    return res;
  };
})();
