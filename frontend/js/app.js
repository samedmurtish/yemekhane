const ekran = document.getElementById('ekran');
const bildirim = document.getElementById('bildirim');
const ustbar = document.getElementById('ustbar');
const menuNav = document.getElementById('menu');
const cikis = document.getElementById('cikis');

let user = null;
let activeScreen = 'bugun';
let profileAllergens = { allergens: [], selectedIds: [] };

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'İşlem gerçekleştirilemedi.');
  }
  return data;
}

function showMessage(message, type = 'hata') {
  bildirim.innerHTML = message
    ? `<div class="bildirim ${type === 'basari' ? 'bildirim-basari' : 'bildirim-hata'}">${escapeHtml(message)}</div>`
    : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('tr-TR');
}

function formatMoney(value) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(value || 0));
}

async function init() {
  try {
    user = await api('/api/auth/me');
    try {
      profileAllergens = await api('/api/profile/allergens');
    } catch (error) {
      profileAllergens = { allergens: [], selectedIds: [] };
    }
    renderApp();
  } catch (error) {
    renderLogin();
  }
}

async function loginSubmit(event) {
  event.preventDefault();
  showMessage('');
  const form = new FormData(event.target);
  try {
    user = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ eposta: form.get('eposta'), sifre: form.get('sifre') })
    });
    renderApp();
  } catch (error) {
    showMessage(error.message);
  }
}

function renderLogin() {
  ustbar.hidden = true;
  menuNav.hidden = true;
  ekran.innerHTML = `
    <section class="panel giris">
      <h1>Giriş</h1>
      <form id="giris-form">
        <label for="eposta">E-posta</label>
        <input id="eposta" name="eposta" type="email" autocomplete="email" required>
        <label for="sifre">Şifre</label>
        <input id="sifre" name="sifre" type="password" autocomplete="current-password" required>
        <button class="dugme" type="submit" style="width:100%;margin-top:16px">Giriş Yap</button>
      </form>
    </section>`;
  document.getElementById('giris-form').addEventListener('submit', loginSubmit);
}

function renderApp() {
  ustbar.hidden = false;
  menuNav.hidden = false;
  const items = [
    ['bugun', 'Günün Menüsü'],
    ['haftalik', 'Haftalık Menü'],
    ['rezervasyonlar', 'Rezervasyonlarım'],
    ['bakiye', 'Bakiye'],
    ['degerlendirme', 'Değerlendirme'],
    ['profil', 'Profil']
  ];
  if (user.rol === 'yonetici') items.push(['yonetici', 'Yönetici']);
  menuNav.innerHTML = items.map(([key, label]) =>
    `<button type="button" data-ekran="${key}" class="${activeScreen === key ? 'aktif' : ''}">${label}</button>`
  ).join('');
  menuNav.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      activeScreen = button.dataset.ekran;
      menuNav.querySelectorAll('button').forEach((item) => item.classList.remove('aktif'));
      button.classList.add('aktif');
      showMessage('');
      renderScreen(activeScreen);
    });
  });
  renderScreen(activeScreen);
}

cikis.addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST', body: '{}' });
  } catch (error) {}
  user = null;
  activeScreen = 'bugun';
  showMessage('');
  renderLogin();
});

function renderScreen(name) {
  if (name === 'bugun') return renderToday();
  if (name === 'haftalik') return renderWeekly();
  if (name === 'rezervasyonlar') return renderReservations();
  if (name === 'bakiye') return renderBalance();
  if (name === 'degerlendirme') return renderEvaluation();
  if (name === 'profil') return renderProfile();
  if (name === 'yonetici') return renderAdmin();
}

async function renderToday() {
  ekran.innerHTML = '<section class="panel"><h1>Günün Menüsü</h1><p>Yükleniyor...</p></section>';
  try {
    const [canteens, data] = await Promise.all([
      api('/api/canteens'),
      api('/api/menu/today?yemekhane_id=1')
    ]);
    const canteenOptions = canteens.map((item) =>
      `<option value="${item.id}">${escapeHtml(item.ad)}</option>`
    ).join('');
    ekran.innerHTML = `
      <section class="panel">
        <h1>Günün Menüsü</h1>
        <label for="today-canteen">Yemekhane</label>
        <select id="today-canteen">${canteenOptions}</select>
        <div id="today-content" class="grid"></div>
      </section>`;
    const select = document.getElementById('today-canteen');
    const renderData = (payload) => {
      document.getElementById('today-content').innerHTML = payload.menus.map((menu) => {
        const foods = payload.foods.filter((food) => food.menu_id === menu.id);
        const calories = foods.reduce((total, food) => total + Number(food.kalori), 0);
        const price = user.rol === 'ogrenci' ? menu.ogrenci_fiyati : menu.personel_fiyati;
        return `
          <article class="kart">
            <div class="satir"><h2>${escapeHtml(menu.ogun)}</h2><strong>${formatMoney(price)}</strong></div>
            <p class="metin-soluk">Toplam kalori: ${calories} kcal · Boş yer: ${menu.bos_yer}</p>
            <div class="yemek-listesi">${foods.map((food) => `
              ${(() => {
                const ids = String(food.alerjen_idler || '').split(',').filter(Boolean).map(Number);
                const names = profileAllergens.allergens
                  .filter((allergen) => profileAllergens.selectedIds.includes(allergen.id) && ids.includes(allergen.id))
                  .map((allergen) => allergen.ad);
                return names.length
                  ? `<div class="alerjen-uyari">⚠️ Alerjen Uyarısı: ${escapeHtml(names.join(', '))}</div>`
                  : '';
              })()}
              <div class="kart-kucuk${String(food.alerjen_idler || '').split(',').filter(Boolean).map(Number).some((id) => profileAllergens.selectedIds.includes(id)) ? ' alerjenli-yemek' : ''}">
                <strong>${escapeHtml(food.yemek)}</strong>
                <div class="metin-soluk">${food.kalori} kcal · ${food.vejetaryen ? 'Vejetaryen' : 'Hayvansal'}</div>
                ${food.alerjenler ? `<div>Alerjen: ${escapeHtml(food.alerjenler)}</div>` : ''}
              </div>`).join('')}
            </div>
          </article>`;
      }).join('');
    };
    renderData(data);
    select.addEventListener('change', async () => {
      const next = await api(`/api/menu/today?yemekhane_id=${select.value}`);
      renderData(next);
    });
  } catch (error) {
    ekran.innerHTML = '<section class="panel"><h1>Günün Menüsü</h1></section>';
    showMessage(error.message);
  }
}

async function renderWeekly() {
  ekran.innerHTML = '<section class="panel"><h1>Haftalık Menü</h1><p>Yükleniyor...</p></section>';
  try {
    const canteens = await api('/api/canteens');
    const today = new Date().toISOString().slice(0, 10);
    const data = await api(`/api/menu/weekly?yemekhane_id=1&baslangic=${today}`);
    ekran.innerHTML = `
      <section class="panel">
        <h1>Haftalık Menü ve Rezervasyon</h1>
        <div class="grid">
          <div><label for="week-canteen">Yemekhane</label><select id="week-canteen">${canteens.map((item) => `<option value="${item.id}">${escapeHtml(item.ad)}</option>`).join('')}</select></div>
          <div><label for="week-start">Başlangıç</label><input id="week-start" type="date" value="${today}"></div>
        </div>
        <div id="week-content" class="grid"></div>
      </section>`;
    const canteen = document.getElementById('week-canteen');
    const start = document.getElementById('week-start');
    const renderData = (payload) => {
      document.getElementById('week-content').innerHTML = payload.menus.length
        ? payload.menus.map((menu) => {
            const foods = payload.foods.filter((food) => food.menu_id === menu.id);
            const price = user.rol === 'ogrenci' ? menu.ogrenci_fiyati : menu.personel_fiyati;
            const passed = new Date(menu.rezervasyon_son).getTime() <= Date.now();
            const portionOptions = menu.ogun_id === 1
              ? ''
              : `<label for="portion-${menu.id}">Porsiyon</label>
                 <select id="portion-${menu.id}" class="portion-select">
                   <option value="tam">Tam Porsiyon - ${formatMoney(price)}</option>
                   <option value="yarim">Yarım Porsiyon - %60 - ${formatMoney(Number(price) * 0.60)}</option>
                 </select>`;
            const warningHtml = foods.map((food) => {
              const ids = String(food.alerjen_idler || '').split(',').filter(Boolean).map(Number);
              const names = profileAllergens.allergens
                .filter((allergen) => profileAllergens.selectedIds.includes(allergen.id) && ids.includes(allergen.id))
                .map((allergen) => allergen.ad);
              return names.length
                ? `<div class="alerjen-uyari">⚠️ Alerjen Uyarısı: ${escapeHtml(names.join(', '))}</div>`
                : '';
            }).join('');
            return `
              <article class="kart">
                <div class="satir"><div><strong>${formatDate(menu.tarih)}</strong><div>${escapeHtml(menu.ogun)}</div></div><strong>${formatMoney(price)}</strong></div>
                <p class="metin-soluk">Boş yer: ${menu.bos_yer} · Son saat: ${new Date(menu.rezervasyon_son).toLocaleString('tr-TR')}</p>
                <p>${foods.map((food) => escapeHtml(food.yemek)).join(', ')}</p>
                ${warningHtml}
                ${portionOptions}
                <button class="dugme reserve-button" data-menu="${menu.id}" ${passed || menu.bos_yer <= 0 ? 'disabled' : ''}>Rezervasyon Yap</button>
              </article>`;
          }).join('')
        : '<p>Bu dönem için menü bulunamadı.</p>';
      document.querySelectorAll('.reserve-button').forEach((button) => {
        button.addEventListener('click', async () => {
          showMessage('');
          try {
            const portionSelect = document.getElementById(`portion-${button.dataset.menu}`);
            const portion = portionSelect ? portionSelect.value : 'tam';
            const result = await api('/api/reservations', {
              method: 'POST',
              body: JSON.stringify({ menu_id: Number(button.dataset.menu), porsiyon: portion })
            });
            const sourceBalance = await api('/api/balance/source');
            showMessage(`Rezervasyon oluşturuldu. Kaynak bakiye: ${formatMoney(sourceBalance.balance)}.`, 'basari');
            loadWeekly();
          } catch (error) {
            showMessage(error.message);
          }
        });
      });
    };
    const loadWeekly = async () => {
      const payload = await api(`/api/menu/weekly?yemekhane_id=${canteen.value}&baslangic=${start.value}`);
      renderData(payload);
    };
    renderData(data);
    canteen.addEventListener('change', loadWeekly);
    start.addEventListener('change', loadWeekly);
  } catch (error) {
    ekran.innerHTML = '<section class="panel"><h1>Haftalık Menü</h1></section>';
    showMessage(error.message);
  }
}

async function renderReservations() {
  ekran.innerHTML = '<section class="panel"><h1>Rezervasyonlarım</h1><p>Yükleniyor...</p></section>';
  try {
    const reservations = await api('/api/reservations');
    ekran.innerHTML = `
      <section class="panel">
        <h1>Rezervasyonlarım</h1>
        ${reservations.length ? `<div class="grid">${reservations.map((item) => {
          const passed = new Date(item.rezervasyon_son).getTime() <= Date.now();
          return `
            <article class="kart">
              <div class="satir"><strong>${escapeHtml(item.yemekhane)} · ${escapeHtml(item.ogun)}</strong><span>${escapeHtml(item.durum)}</span></div>
            <p>${formatDate(item.tarih)} · ${item.porsiyon === 'yarim' ? 'Yarım' : 'Tam'} Porsiyon · ${formatMoney(item.ucret)}</p>
              ${item.durum === 'aktif' ? `<button class="dugme cancel-button" data-id="${item.id}" ${passed ? 'disabled' : ''}>İptal Et</button>` : ''}
            </article>`;
        }).join('')}</div>` : '<p>Rezervasyon bulunamadı.</p>'}
      </section>`;
    document.querySelectorAll('.cancel-button').forEach((button) => {
      button.addEventListener('click', async () => {
        showMessage('');
        try {
          await api(`/api/reservations/${button.dataset.id}/cancel`, { method: 'POST', body: '{}' });
          showMessage('Rezervasyon iptal edildi.', 'basari');
          renderReservations();
        } catch (error) {
          showMessage(error.message);
        }
      });
    });
  } catch (error) {
    ekran.innerHTML = '<section class="panel"><h1>Rezervasyonlarım</h1></section>';
    showMessage(error.message);
  }
}

async function renderBalance() {
  ekran.innerHTML = '<section class="panel"><h1>Bakiye</h1><p>Yükleniyor...</p></section>';
  try {
    const data = await api('/api/balance');
    ekran.innerHTML = `
      <section class="panel">
        <h1>Bakiye</h1>
        <div class="kart satir">
          <span>Güncel bakiye</span>
          <strong>${formatMoney(data.balance)}</strong>
        </div>
        <form id="load-form" style="margin-top:12px">
          <label for="tutar">Bakiye Yükle</label>
          <input id="tutar" name="tutar" type="number" min="10" max="1000" step="0.01" required>
          <button class="dugme" type="submit" style="margin-top:10px">Yükle</button>
        </form>
        <h2 style="margin-top:20px">Hareket Geçmişi</h2>
        <div class="tablo-kaydir">
          <table>
            <thead><tr><th>Tarih</th><th>Tür</th><th>Tutar</th><th>Açıklama</th></tr></thead>
            <tbody>${data.history.map((item) => `
              <tr><td>${new Date(item.olusturma).toLocaleString('tr-TR')}</td><td>${escapeHtml(item.tur)}</td><td>${formatMoney(item.tutar)}</td><td>${escapeHtml(item.aciklama || '')}</td></tr>
            `).join('')}</tbody>
          </table>
        </div>
      </section>`;
    document.getElementById('load-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      showMessage('');
      const form = new FormData(event.target);
      try {
        await api('/api/balance/load', {
          method: 'POST',
          body: JSON.stringify({ tutar: Number(form.get('tutar')) })
        });
        showMessage('Bakiye yüklendi.', 'basari');
        renderBalance();
      } catch (error) {
        showMessage(error.message);
      }
    });
  } catch (error) {
    ekran.innerHTML = '<section class="panel"><h1>Bakiye</h1></section>';
    showMessage(error.message);
  }
}

async function renderEvaluation() {
  ekran.innerHTML = '<section class="panel"><h1>Değerlendirme</h1><p>Yükleniyor...</p></section>';
  try {
    const menus = await api('/api/evaluations/used-menus');
    ekran.innerHTML = `
      <section class="panel">
        <h1>Değerlendirme</h1>
        ${menus.length ? `<div class="grid">${menus.map((item) => `
          <article class="kart">
            <h2>${escapeHtml(item.yemekhane)} · ${escapeHtml(item.ogun)}</h2>
            <p>${formatDate(item.tarih)}</p>
            <form class="evaluation-form" data-menu="${item.menu_id}">
              <label>Puan</label>
              <select name="puan">
                ${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${item.puan === value ? 'selected' : ''}>${value}</option>`).join('')}
              </select>
              <label>Yorum</label>
              <textarea name="yorum">${escapeHtml(item.yorum || '')}</textarea>
              <button class="dugme" type="submit" style="margin-top:10px">Kaydet</button>
            </form>
          </article>`).join('')}</div>` : '<p>Henüz değerlendirebileceğiniz kullanılan menü bulunmuyor.</p>'}
      </section>`;
    document.querySelectorAll('.evaluation-form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        showMessage('');
        const values = new FormData(form);
        try {
          await api('/api/evaluations', {
            method: 'POST',
            body: JSON.stringify({
              menu_id: Number(form.dataset.menu),
              puan: Number(values.get('puan')),
              yorum: values.get('yorum')
            })
          });
          showMessage('Değerlendirmeniz kaydedildi.', 'basari');
        } catch (error) {
          showMessage(error.message);
        }
      });
    });
  } catch (error) {
    ekran.innerHTML = '<section class="panel"><h1>Değerlendirme</h1></section>';
    showMessage(error.message);
  }
}

async function renderProfile() {
  ekran.innerHTML = '<section class="panel"><h1>Profil</h1><p>Yükleniyor...</p></section>';
  try {
    profileAllergens = await api('/api/profile/allergens');
    ekran.innerHTML = `
      <section class="panel">
        <h1>Profil - Alerjenler</h1>
        <p>Menüde sizi ilgilendiren alerjenleri seçin.</p>
        <form id="profile-form">
          <div class="check-list">${profileAllergens.allergens.map((allergen) => `
            <label>
              <input type="checkbox" name="alerjen_ids" value="${allergen.id}" ${profileAllergens.selectedIds.includes(allergen.id) ? 'checked' : ''}>
              ${escapeHtml(allergen.ad)}
            </label>`).join('')}
          </div>
          <button class="dugme" type="submit" style="margin-top:12px">Alerjenleri Kaydet</button>
        </form>
      </section>`;
    document.getElementById('profile-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      showMessage('');
      const ids = [...event.target.querySelectorAll('input[name="alerjen_ids"]:checked')]
        .map((input) => Number(input.value));
      try {
        await api('/api/profile/allergens', {
          method: 'PUT',
          body: JSON.stringify({ alerjen_ids: ids })
        });
        profileAllergens.selectedIds = ids;
        showMessage('Alerjenler kaydedildi.', 'basari');
      } catch (error) {
        showMessage(error.message);
      }
    });
  } catch (error) {
    ekran.innerHTML = '<section class="panel"><h1>Profil</h1></section>';
    showMessage(error.message);
  }
}

async function renderAdmin() {
  ekran.innerHTML = '<section class="panel"><h1>Yönetici Paneli</h1><p>Yükleniyor...</p></section>';
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [data, canteens, meals, foods] = await Promise.all([
      api(`/api/admin/menus?baslangic=${today}`),
      api('/api/canteens'),
      api('/api/meals'),
      api('/api/foods')
    ]);
    ekran.innerHTML = `
      <section class="panel">
        <h1>Yönetici Paneli</h1>
        <h2>Yeni Menü</h2>
        <form id="admin-create" class="grid">
          <div><label>Yemekhane</label><select name="yemekhane_id">${canteens.map((item) => `<option value="${item.id}">${escapeHtml(item.ad)}</option>`).join('')}</select></div>
          <div><label>Tarih</label><input name="tarih" type="date" value="${today}" required></div>
          <div><label>Öğün</label><select name="ogun_id">${meals.map((item) => `<option value="${item.id}">${escapeHtml(item.ad)}</option>`).join('')}</select></div>
          <div><label>Öğrenci fiyatı</label><input name="ogrenci_fiyati" type="number" min="0" step="0.01" value="40" required></div>
          <div><label>Personel fiyatı</label><input name="personel_fiyati" type="number" min="0" step="0.01" value="90" required></div>
          <div><label>Yemekler</label><div class="check-list">${foods.map((item) => `<label><input type="checkbox" name="yemek_ids" value="${item.id}">${escapeHtml(item.ad)}</label>`).join('')}</div></div>
          <div><button class="dugme" type="submit">Menü Oluştur</button></div>
        </form>
        <h2 style="margin-top:24px">Menüler ve Doluluk</h2>
        <div class="tablo-kaydir">
          <table>
            <thead><tr><th>Tarih</th><th>Yemekhane</th><th>Öğün</th><th>Doluluk</th><th>Ortalama Puan</th><th>İşlem</th></tr></thead>
            <tbody>${data.menus.map((item) => `
              <tr>
                <td>${formatDate(item.tarih)}</td>
                <td>${escapeHtml(item.yemekhane)}</td>
                <td>${escapeHtml(item.ogun)}</td>
                <td>${item.rezerve}/${item.kapasite}</td>
                <td>${item.ortalama_puan ?? '-'}</td>
                <td><button class="dugme edit-menu" type="button" data-id="${item.id}" data-ogrenci="${item.ogrenci_fiyati}" data-personel="${item.personel_fiyati}">Düzenle</button></td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>
        <div id="edit-menu-panel" class="panel" hidden>
          <h2>Menüyü Düzenle</h2>
          <form id="admin-edit" class="grid">
            <input id="edit-menu-id" type="hidden" name="menu_id">
            <div><label>Öğrenci fiyatı</label><input name="ogrenci_fiyati" type="number" min="0" step="0.01" required></div>
            <div><label>Personel fiyatı</label><input name="personel_fiyati" type="number" min="0" step="0.01" required></div>
            <div><label>Yemekler</label><div class="check-list">${foods.map((item) => `<label><input type="checkbox" name="edit_yemek_ids" value="${item.id}">${escapeHtml(item.ad)}</label>`).join('')}</div></div>
            <div><button class="dugme" type="submit">Değişiklikleri Kaydet</button></div>
          </form>
        </div>
      </section>`;
    document.querySelectorAll('.edit-menu').forEach((button) => {
      button.addEventListener('click', () => {
        const panel = document.getElementById('edit-menu-panel');
        panel.hidden = false;
        document.getElementById('edit-menu-id').value = button.dataset.id;
        document.querySelector('#admin-edit [name="ogrenci_fiyati"]').value = button.dataset.ogrenci;
        document.querySelector('#admin-edit [name="personel_fiyati"]').value = button.dataset.personel;
        const selectedFoods = data.foods
          .filter((food) => food.menu_id === Number(button.dataset.id))
          .map((food) => String(food.yemek_id));
        document.querySelectorAll('input[name="edit_yemek_ids"]').forEach((input) => {
          input.checked = selectedFoods.includes(input.value);
        });
        panel.scrollIntoView({ behavior: 'smooth' });
      });
    });
    document.getElementById('admin-edit').addEventListener('submit', async (event) => {
      event.preventDefault();
      showMessage('');
      const form = new FormData(event.target);
      const menuId = Number(form.get('menu_id'));
      const yemekIds = [...event.target.querySelectorAll('input[name="edit_yemek_ids"]:checked')].map((input) => Number(input.value));
      try {
        await api(`/api/admin/menus/${menuId}`, {
          method: 'PUT',
          body: JSON.stringify({
            ogrenci_fiyati: Number(form.get('ogrenci_fiyati')),
            personel_fiyati: Number(form.get('personel_fiyati')),
            yemek_ids: yemekIds
          })
        });
        showMessage('Menü düzenlendi.', 'basari');
        renderAdmin();
      } catch (error) {
        showMessage(error.message);
      }
    });
    document.getElementById('admin-create').addEventListener('submit', async (event) => {
      event.preventDefault();
      showMessage('');
      const form = new FormData(event.target);
      const yemekIds = [...event.target.querySelectorAll('input[name="yemek_ids"]:checked')].map((input) => Number(input.value));
      try {
        await api('/api/admin/menus', {
          method: 'POST',
          body: JSON.stringify({
            yemekhane_id: Number(form.get('yemekhane_id')),
            tarih: form.get('tarih'),
            ogun_id: Number(form.get('ogun_id')),
            ogrenci_fiyati: Number(form.get('ogrenci_fiyati')),
            personel_fiyati: Number(form.get('personel_fiyati')),
            yemek_ids: yemekIds
          })
        });
        showMessage('Menü oluşturuldu.', 'basari');
        renderAdmin();
      } catch (error) {
        showMessage(error.message);
      }
    });
  } catch (error) {
    ekran.innerHTML = '<section class="panel"><h1>Yönetici Paneli</h1></section>';
    showMessage(error.message);
  }
}

init();
