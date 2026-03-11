/* =========================================================
   TCG Trust Dex — App Logic
   ========================================================= */

let ALL_ENTRIES = [];
let activeFilter = 'all';

/* ---------- Bootstrap ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  spawnBackgroundSymbols();
  ALL_ENTRIES = await loadData();
  updateStats();
  applyFilters();
  bindEvents();
});

/* ---------- Data Loading ---------- */
async function loadData() {
  try {
    const res = await fetch('./data/sellers.json');
    if (!res.ok) throw new Error('Failed to load data');
    const json = await res.json();
    return json.entries || [];
  } catch (err) {
    console.error('Error loading sellers data:', err);
    document.getElementById('tileGrid').innerHTML = emptyStateHTML('Failed to load data');
    return [];
  }
}

/* ---------- Stats ---------- */
function updateStats() {
  const genuine = ALL_ENTRIES.filter(e => e.status === 'genuine').length;
  const flagged = ALL_ENTRIES.filter(e => ['scammer', 'reported', 'resolved'].includes(e.status)).length;
  document.getElementById('statusGenuine').textContent = 'GENUINE: ' + genuine;
  document.getElementById('statusScammers').textContent = 'FLAGGED: ' + flagged;
}

/* ---------- Event Binding ---------- */
function bindEvents() {
  // Category tabs
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      applyFilters();
    });
  });

  // Search input
  const searchInput = document.getElementById('searchInput');
  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFilters(), 150);
  });

  // D-pad buttons
  document.getElementById('dpadUp').addEventListener('click', () => dpadScroll(-1));
  document.getElementById('dpadDown').addEventListener('click', () => dpadScroll(1));

  // A button = click focused tile (enter detail)
  document.getElementById('btnA').addEventListener('click', () => {
    const panel = document.getElementById('detailPanel');
    if (panel.classList.contains('open')) return;
    const focused = document.querySelector('.tile.tile-focused');
    if (focused) focused.click();
  });

  // B button = back (close detail)
  document.getElementById('btnB').addEventListener('click', () => {
    closeDetail();
  });
}

/* ---------- D-pad Scroll & Focus ---------- */
let focusedIndex = -1;

function dpadScroll(direction) {
  const tiles = document.querySelectorAll('#tileGrid .tile');
  if (!tiles.length) return;

  // Remove old focus
  tiles.forEach(t => t.classList.remove('tile-focused'));

  focusedIndex += direction;
  if (focusedIndex < 0) focusedIndex = 0;
  if (focusedIndex >= tiles.length) focusedIndex = tiles.length - 1;

  const tile = tiles[focusedIndex];
  tile.classList.add('tile-focused');
  tile.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ---------- Filtering ---------- */
function getFiltered(entries, filter, query) {
  const q = query.toLowerCase().replace('@', '');

  return entries.filter(e => {
    const catMatch =
      filter === 'all' ||
      (filter === 'sellers' && e.status === 'genuine' && e.seller_type === 'Seller') ||
      (filter === 'individuals' && e.status === 'genuine' && e.seller_type === 'Individual') ||
      (filter === 'rocket' && ['scammer', 'reported', 'resolved'].includes(e.status));

    const searchMatch = !q ||
      e.name.toLowerCase().includes(q) ||
      e.instagram.handle.toLowerCase().replace('@', '').includes(q);

    return catMatch && searchMatch;
  });
}

function applyFilters() {
  focusedIndex = -1;
  const query = document.getElementById('searchInput').value;
  const filtered = getFiltered(ALL_ENTRIES, activeFilter, query);
  document.getElementById('resultCount').textContent = filtered.length + ' FOUND';
  renderTiles(filtered);
}

/* ---------- Rendering — Tiles ---------- */
function renderTiles(filtered) {
  const sellers = filtered.filter(e => e.status === 'genuine' && e.seller_type === 'Seller');
  const indivs = filtered.filter(e => e.status === 'genuine' && e.seller_type === 'Individual');
  const scammers = filtered.filter(e => ['scammer', 'reported', 'resolved'].includes(e.status));

  let html = '';
  if (sellers.length) html += sectionHTML('\u2713 GENUINE SELLERS', 'trusted', sellers, false);
  if (indivs.length) html += sectionHTML('\u25C8 GENUINE INDIVIDUALS', 'indiv', indivs, false);
  if (scammers.length) html += sectionHTML('\u2620 TEAM ROCKET', 'rocket', scammers, true);

  document.getElementById('tileGrid').innerHTML = html || emptyStateHTML();
}

function sectionHTML(title, cls, entries, isScammer) {
  let html = '<div class="section-header ' + cls + '">' + escapeHTML(title) + '</div>';
  entries.forEach(e => {
    html += tileHTML(e, isScammer);
  });
  return html;
}

function tileHTML(entry, isScammer) {
  const tileClass = getTileClass(entry);
  const iconClass = getIconClass(entry);
  const icon = getIcon(entry);
  const badgeClass = 'badge-' + entry.trust_level;
  const badgeText = entry.trust_level.toUpperCase();

  return '<div class="tile ' + tileClass + '" onclick="showDetail(\'' + entry.id + '\')">'
    + '<div class="tile-icon ' + iconClass + '">' + icon + '</div>'
    + '<div class="tile-info">'
    + '<div class="tile-name">' + escapeHTML(entry.name) + '</div>'
    + '<div class="tile-handle">' + escapeHTML(entry.instagram.handle) + '</div>'
    + '</div>'
    + '<span class="tile-badge ' + badgeClass + '">' + escapeHTML(badgeText) + '</span>'
    + '</div>';
}

function getTileClass(entry) {
  if (entry.status === 'genuine' && entry.seller_type === 'Individual') return 'tile-indiv';
  if (entry.status === 'genuine') return 'tile-' + entry.trust_level;
  if (entry.severity === 'critical') return 'tile-critical';
  if (entry.severity === 'caution') return 'tile-caution';
  if (entry.severity === 'reported') return 'tile-reported';
  if (entry.severity === 'resolved') return 'tile-resolved';
  return 'tile-reported';
}

function getIconClass(entry) {
  if (entry.status === 'genuine' && entry.seller_type === 'Individual') return 'indiv';
  if (entry.status === 'genuine') return 'trusted';
  if (entry.severity === 'critical') return 'critical';
  if (entry.severity === 'caution') return 'caution';
  if (entry.severity === 'reported') return 'reported';
  if (entry.severity === 'resolved') return 'resolved';
  return 'reported';
}

function getIcon(entry) {
  if (entry.status === 'genuine' && entry.seller_type === 'Individual') return '\uD83D\uDC64';
  if (entry.status === 'genuine') return '\u2705';
  if (entry.severity === 'critical') return '\uD83D\uDEA8';
  if (entry.severity === 'caution') return '\u26A0\uFE0F';
  if (entry.severity === 'resolved') return '\u2705';
  return '\u2753';
}

function emptyStateHTML(msg) {
  return '<div class="empty-state">'
    + '<div class="empty-icon">\uD83D\uDD0D</div>'
    + '<div class="empty-text">' + escapeHTML(msg || 'No entries found') + '</div>'
    + '</div>';
}

/* ---------- Rendering — Detail Panel ---------- */
function showDetail(id) {
  const entry = ALL_ENTRIES.find(e => e.id === id);
  if (!entry) return;

  const panel = document.getElementById('detailPanel');
  document.getElementById('detailContent').innerHTML = buildDetailHTML(entry);
  panel.className = 'detail-panel ' + getPanelClass(entry);
  requestAnimationFrame(() => panel.classList.add('open'));
}

function closeDetail() {
  document.getElementById('detailPanel').classList.remove('open');
}

function getPanelClass(entry) {
  if (entry.status === 'genuine') return 'panel-genuine';
  return 'panel-' + (entry.severity || 'reported');
}

function buildDetailHTML(entry) {
  const isScammer = ['scammer', 'reported', 'resolved'].includes(entry.status);
  const avatarClass = entry.status === 'genuine' ? 'genuine' : (entry.severity || 'reported');
  const avatarIcon = getIcon(entry);

  let html = '';

  // Header
  html += '<div class="detail-header">';
  html += '<div class="detail-avatar ' + avatarClass + '">' + avatarIcon + '</div>';
  html += '<div class="detail-name">' + escapeHTML(entry.name) + '</div>';

  if (entry.instagram.url) {
    html += '<div class="detail-handle"><a href="' + escapeAttr(entry.instagram.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(entry.instagram.handle) + '</a></div>';
  } else {
    html += '<div class="detail-handle">' + escapeHTML(entry.instagram.handle) + '</div>';
  }
  html += '</div>';

  // Severity banner for scammers
  if (isScammer && entry.reason) {
    const sev = entry.severity || 'reported';
    const sevLabels = { critical: '\uD83D\uDEA8 CRITICAL', caution: '\u26A0\uFE0F CAUTION', reported: '\uD83D\uDCCB REPORTED', resolved: '\u2705 RESOLVED' };
    html += '<div class="severity-banner ' + sev + '">';
    html += '<span class="severity-label">' + (sevLabels[sev] || sev.toUpperCase()) + '</span>';
    html += escapeHTML(entry.reason);
    html += '</div>';
  }

  // Info rows
  html += '<div class="detail-rows">';

  html += detailRow('STATUS', statusDisplay(entry));
  html += detailRow('TYPE', escapeHTML(entry.seller_type));
  html += detailRow('TRUST', escapeHTML(entry.trust_level.toUpperCase()));
  html += detailRow('TCG', escapeHTML(entry.tcg_type));

  // ID verified
  if (entry.id_verified) {
    html += detailRow('ID CHECK', '<span class="id-badge">\u2713 VERIFIED</span>');
  } else {
    html += detailRow('ID CHECK', '<span class="id-badge not-verified">\u2717 NOT VERIFIED</span>');
  }

  // Products
  if (entry.products && entry.products.length > 0) {
    const chips = entry.products.map(p => '<span class="product-chip">' + escapeHTML(p) + '</span>').join('');
    html += detailRow('PRODUCTS', '<div class="product-chips">' + chips + '</div>');
  }

  // Tags
  if (entry.tags && entry.tags.length > 0) {
    const tags = entry.tags.map(t => '<span class="detail-tag">' + escapeHTML(t) + '</span>').join('');
    html += detailRow('TAGS', '<div class="detail-tags">' + tags + '</div>');
  }

  html += '</div>';

  return html;
}

function detailRow(label, valueHTML) {
  return '<div class="detail-row">'
    + '<div class="detail-label">' + label + '</div>'
    + '<div class="detail-value">' + valueHTML + '</div>'
    + '</div>';
}

function statusDisplay(entry) {
  const colors = {
    genuine: '#00C853',
    scammer: '#FF1744',
    reported: '#FF6D00',
    resolved: '#448AFF'
  };
  const color = colors[entry.status] || '#999';
  return '<span style="color:' + color + '; font-weight:600;">' + escapeHTML(entry.status.toUpperCase()) + '</span>';
}

/* ---------- Background Symbols ---------- */
function spawnBackgroundSymbols() {
  const container = document.querySelector('.bg-symbols');
  if (!container) return;

  const symbols = ['\u2728', '\u2B50', '\uD83C\uDF1F', '\u26A1', '\uD83D\uDD25', '\u2744\uFE0F', '\uD83C\uDF40', '\uD83D\uDCA0', '\u2660\uFE0F', '\u2666\uFE0F', '\u2663\uFE0F', '\u2665\uFE0F'];
  const count = 20;

  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.className = 'bg-symbol';
    span.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    span.style.left = Math.random() * 100 + '%';
    span.style.animationDuration = (12 + Math.random() * 18) + 's';
    span.style.animationDelay = (Math.random() * 20) + 's';
    span.style.fontSize = (1 + Math.random() * 1.2) + 'rem';
    container.appendChild(span);
  }
}

/* ---------- Utilities ---------- */
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
