/* Mobile header: avatar + arrow; dropdown shows name, username and logout */
(function () {
  function init() {
    var name = '', user = '';
    try {
      name = localStorage.getItem('staffName') || '';
      user = localStorage.getItem('username') || '';
      if (localStorage.getItem('isGuest') === 'true') { name = name || 'Guest User'; user = user || 'guest'; }
    } catch (e) {}
    name = name || user || 'User';
    var initials = name.trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase() || 'U';
    var av = document.getElementById('userAvatar');
    var n = document.getElementById('mobileFullname');
    var u = document.getElementById('mobileUsername');
    if (av) av.textContent = initials;
    if (n) n.textContent = name;
    if (u) u.textContent = user ? '@' + user : '';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
