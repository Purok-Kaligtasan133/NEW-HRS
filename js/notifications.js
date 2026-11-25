/* Barangay notifications: bell + dropdown + live toast.
   Server side (sql/05-notifications.sql) decides who may see what; this file only displays it. */
(function () {
  var state = { uid: null, seenAt: 0, items: [], open: false, channel: null };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var client = function () { try { return typeof supabaseClient !== 'undefined' ? supabaseClient : null; } catch (e) { return null; } };

  function myBarangay() { try { return (localStorage.getItem('assignedBarangay') || '').trim().toLowerCase(); } catch (e) { return ''; } }
  function visibleToMe(n) {
    if (n.actor_auth_id && n.actor_auth_id === state.uid) return false;
    var mine = myBarangay();
    if (!mine || mine === 'all') return true;
    return String(n.barangay || '').trim().toLowerCase() === mine;
  }
  function ago(ts) {
    var s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function unreadCount() { return state.items.filter(function (n) { return new Date(n.created_at).getTime() > state.seenAt; }).length; }
  var ICON = { created: 'fa-plus-circle', updated: 'fa-pen', deleted: 'fa-trash' };

  function buildUI() {
    if ($('notifMenuItem')) return;
    var menu = document.querySelector('#userDropdown .dropdown-menu') || document.querySelector('.dropdown-menu');
    if (!menu) return;
    var item = document.createElement('a');
    item.href = '#'; item.id = 'notifMenuItem'; item.className = 'notif-menu-item';
    item.innerHTML = '<i class="fas fa-bell"></i><span class="notif-label">Notifications</span>' +
      '<span id="notifBadge" class="notif-badge-inline" style="display:none">0</span><i class="fas fa-chevron-down notif-caret"></i>';
    var box = document.createElement('div');
    box.id = 'notifList'; box.className = 'notif-inline';
    var logout = menu.querySelector('#logoutBtn');
    menu.insertBefore(box, logout || null);
    menu.insertBefore(item, box);
    item.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toggle(); });
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    // closing the whole menu also counts as "seen"
    document.addEventListener('click', function () { if (state.open) toggle(false); });
  }

  function render() {
    var n = unreadCount();
    var badge = $('notifBadge');
    if (badge) { badge.style.display = n ? 'inline-flex' : 'none'; badge.textContent = n > 9 ? '9+' : String(n); }
    // red dot on the avatar button so new items are visible before opening the menu
    var btn = $('userBtn');
    if (btn) {
      var dot = btn.querySelector('.notif-dot');
      if (n && !dot) { dot = document.createElement('span'); dot.className = 'notif-dot'; btn.appendChild(dot); }
      else if (!n && dot) dot.remove();
    }
    var list = $('notifList'); if (!list) return;
    if (!state.items.length) { list.innerHTML = '<div class="notif-empty">No notifications yet</div>'; return; }
    list.innerHTML = state.items.map(function (it) {
      var unread = new Date(it.created_at).getTime() > state.seenAt;
      return '<div class="notif-item' + (unread ? ' unread' : '') + '"><span class="notif-ico ' + esc(it.action) + '"><i class="fas ' + (ICON[it.action] || 'fa-bell') + '"></i></span>' +
        '<div class="notif-body"><div class="notif-msg">' + esc(it.message) + '</div>' +
        '<div class="notif-meta">' + esc(it.barangay || '') + ' · ' + ago(it.created_at) + '</div></div></div>';
    }).join('');
  }

  function toggle(force) {
    state.open = typeof force === 'boolean' ? force : !state.open;
    var list = $('notifList'), item = $('notifMenuItem');
    if (list) list.classList.toggle('open', state.open);
    if (item) item.classList.toggle('open', state.open);
    if (state.open) render();
    else if (unreadCount()) markRead();       // collapsing = you've seen them
  }

  async function markRead() {
    var c = client(); if (!c || !state.uid) return;
    state.seenAt = Date.now();
    render();
    try { await c.from('notification_state').upsert({ auth_id: state.uid, seen_at: new Date(state.seenAt).toISOString() }); } catch (e) {}
  }

  function toast(n) {
    var t = document.createElement('div');
    t.className = 'notif-toast';
    t.innerHTML = '<i class="fas ' + (ICON[n.action] || 'fa-bell') + '"></i><div><div class="notif-toast-msg">' + esc(n.message) + '</div><div class="notif-toast-sub">' + esc(n.barangay || '') + '</div></div>';
    t.addEventListener('click', function () { t.remove(); var d = $('userDropdown'); if (d) d.classList.add('active'); toggle(true); });
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('hide'); setTimeout(function () { t.remove(); }, 400); }, 5500);
  }

  function addItem(n, announce) {
    if (!visibleToMe(n) || state.items.some(function (x) { return x.id === n.id; })) return;
    state.items.unshift(n);
    state.items.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    state.items = state.items.slice(0, 30);
    render();
    if (announce) toast(n);
  }

  async function load() {
    var c = client();
    var r = await c.from('notifications').select('*').order('created_at', { ascending: false }).limit(30);
    if (r.error) { console.warn('Notifications unavailable:', r.error.message); return false; }
    state.items = (r.data || []).filter(visibleToMe);
    return true;
  }

  async function poll() {
    if (document.hidden) return;
    var c = client(); if (!c) return;
    var latest = state.items.length ? state.items[0].created_at : new Date(state.seenAt).toISOString();
    var r = await c.from('notifications').select('*').gt('created_at', latest).order('created_at', { ascending: true }).limit(20);
    if (!r.error && r.data) r.data.forEach(function (n) { addItem(n, true); });
  }

  async function start() {
    try {
      if (localStorage.getItem('loggedIn') !== 'true' || localStorage.getItem('isGuest') === 'true') return;
    } catch (e) { return; }
    var c = null, tries = 0;
    while (!(c = client()) && tries++ < 100) await new Promise(function (r) { setTimeout(r, 100); });
    if (!c) return;
    var u = await c.auth.getUser();
    state.uid = u && u.data && u.data.user ? u.data.user.id : null;
    if (!state.uid) return;
    buildUI();

    var st = await c.from('notification_state').select('seen_at').eq('auth_id', state.uid).maybeSingle();
    if (st.data && st.data.seen_at) state.seenAt = new Date(st.data.seen_at).getTime();
    else { state.seenAt = Date.now(); try { await c.from('notification_state').upsert({ auth_id: state.uid, seen_at: new Date(state.seenAt).toISOString() }); } catch (e) {} }

    if (!(await load())) return;
    render();

    state.channel = c.channel('notifications-' + state.uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, function (p) { addItem(p.new, true); })
      .subscribe();
    setInterval(poll, 30000);                                   // fallback if realtime is not enabled
    document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
