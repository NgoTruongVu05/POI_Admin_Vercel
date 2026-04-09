import { ensureConfigured } from '../bootstrap.js';
import { requireAuth, getSession } from '../auth.js';
import { getSupabase } from '../supabaseClient.js';
import { renderLayout } from '../layout.js';
import { escapeHtml, getQueryParam, getTailwindColorFromClass, waitForGlobal } from '../ui.js';

async function translateText(text, fromLang, toLang) {
  if (!text) return text; // tránh gọi API khi rỗng

  const apiUrl = 'https://api.langbly.com/language/translate/v2';
  const apiKey = 'PkgVTFvwtPoRdYKHNgoRFN';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify({
      q: text,
      source: fromLang,
      target: toLang
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("API error:", errText);
    throw new Error('Translation failed');
  }

  const data = await response.json();

  return data?.data?.translations?.[0]?.translatedText || text;
}

if (!ensureConfigured()) {
  // config page already rendered
} else {
  const session = await requireAuth();
  if (session) {
    const main = renderLayout({ activeKey: 'pois', title: 'Thêm/Sửa POI | POI Admin', user: session.user });
    await render(main);
  }
}

async function render(main) {
  const supabase = getSupabase();
  const editId = (getQueryParam('id') ?? '').trim();
  const isEdit = editId !== '';

  const session = await getSession();
  const userId = session?.user?.id ?? null;

  let values = { id: '', name: '', description: '', lat: '', lng: '', image: '', maplink: '' };
  let suggestedId = '';
  let loadError = '';

  if (isEdit) {
    try {
      const res = await supabase.from('pois').select('id,name,description,lat,lng,image,maplink').eq('id', editId).limit(1).single();
      if (res.error) throw res.error;
      values = {
        id: res.data.id,
        name: res.data.name ?? '',
        description: res.data.description ?? '',
        lat: String(res.data.lat ?? ''),
        lng: String(res.data.lng ?? ''),
        image: res.data.image ?? '',
        maplink: res.data.maplink ?? ''
      };
    } catch {
      loadError = 'Không tìm thấy POI để sửa.';
    }
  } else {
    // Suggest next id best-effort
    try {
      const last = await supabase.from('pois').select('id').order('id', { ascending: false }).limit(1).maybeSingle();
      const lastId = (last.data?.id ?? '').toString();
      const m = /^poi_(\d+)$/i.exec(lastId);
      if (m) {
        const next = Number(m[1]) + 1;
        suggestedId = `poi_${String(next).padStart(2, '0')}`;
        values.id = suggestedId;
      }
    } catch {
      // ignore
    }
  }

  const pageHeading = isEdit ? 'Sửa POI' : 'Thêm POI mới';
  const pageSub = isEdit ? 'Cập nhật thông tin điểm tham quan.' : 'Nhập thông tin điểm tham quan để thêm vào hệ thống.';

  main.innerHTML = `
    <div class="flex items-start justify-between gap-6">
      <div>
        <h1 class="text-2xl font-semibold">${escapeHtml(pageHeading)}</h1>
        <p class="text-sm text-slate-500 mt-1">${escapeHtml(pageSub)}</p>
      </div>
      <a href="/pois" class="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition">
        <i class="bi bi-arrow-left"></i>
        <span>Quay lại</span>
      </a>
    </div>

    ${loadError ? `
      <div class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">${escapeHtml(loadError)}</div>
    ` : ''}

    <div id="flash" class="hidden px-5 py-4 text-sm"></div>
    <div id="errorBox" class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 hidden"></div>

    <form id="poiForm" class="mt-6 bg-white border border-slate-200 rounded-2xl p-6" autocomplete="off">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        ${isEdit ? '' : `
          <label class="block">
            <div class="text-sm font-semibold text-slate-700">Mã POI (ID)</div>
            <input id="id" name="id" value="${escapeHtml(values.id)}" class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="poi_04" maxlength="50" />
            <div class="mt-1 text-xs text-slate-500">Ví dụ: <span class="font-mono">poi_04</span>. Nếu để trống hệ thống sẽ tự tạo.</div>
          </label>
        `}

        <label class="block">
          <div class="text-sm font-semibold text-slate-700">Ảnh đại diện</div>
          <input id="imageFile" name="imageFile" type="file" accept="image/*" class="mt-2 w-full" />
          <div class="mt-2">
            <img id="imagePreview" src="${escapeHtml(values.image)}" class="${values.image ? '' : 'hidden'} rounded-lg max-h-48" alt="Preview" />
          </div>
          <div class="mt-1 text-xs text-slate-500">Tải lên ảnh đại diện cho POI. Nếu sửa mà không chọn ảnh mới, ảnh cũ sẽ được giữ.</div>
        </label>

        <label class="block ${isEdit ? 'md:col-span-2' : 'md:col-span-2'}">
          <div class="text-sm font-semibold text-slate-700">Tên POI <span class="text-rose-600">*</span></div>
          <input id="name" name="name" value="${escapeHtml(values.name)}" class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="Nhập tên địa điểm..." required maxlength="200" />
        </label>

        <label class="block md:col-span-2">
          <div class="text-sm font-semibold text-slate-700">Mô tả <span class="text-rose-600">*</span></div>
          <textarea id="description" name="description" rows="5" class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="Mô tả địa điểm..." required>${escapeHtml(values.description)}</textarea>
        </label>

        <label class="block">
          <div class="text-sm font-semibold text-slate-700">Latitude <span class="text-rose-600">*</span></div>
          <input id="lat" name="lat" value="${escapeHtml(values.lat)}" class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="10.762622" required />
        </label>

        <label class="block">
          <div class="text-sm font-semibold text-slate-700">Longitude <span class="text-rose-600">*</span></div>
          <input id="lng" name="lng" value="${escapeHtml(values.lng)}" class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="106.660172" required />
        </label>

        <label class="block md:col-span-2">
          <div class="text-sm font-semibold text-slate-700">Maplink</div>
          <input id="maplink" name="maplink" value="${escapeHtml(values.maplink)}" class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="https://maps.google.com/?q=..." maxlength="1000" />
          <div class="mt-1 text-xs text-slate-500">Tùy chọn: nhập đường dẫn bản đồ (map link) nếu có.</div>
        </label>

        <div class="md:col-span-2">
          <div class="text-sm font-semibold text-slate-700">Chọn vị trí trên bản đồ</div>
          <div class="mt-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div id="pickMap" class="h-[420px] w-full"></div>
          </div>
          <div class="text-[11px] text-slate-400 mt-2">Click lên bản đồ để tự điền Latitude/Longitude.</div>
        </div>
        
        
      </div>

      <div class="mt-6 flex items-center justify-end gap-3">
        <button id="submitBtn" type="submit" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-3 text-sm font-semibold hover:bg-blue-700 transition">
          <i class="bi bi-check2"></i>
          <span>${escapeHtml(isEdit ? 'Cập nhật' : 'Thêm')}</span>
        </button>
      </div>
    </form>
  `;

  if (loadError) return;

  const form = document.getElementById('poiForm');
  const errorBox = document.getElementById('errorBox');
  const submitBtn = document.getElementById('submitBtn');
  const idInput = isEdit ? null : document.getElementById('id');

  const imageFileInput = document.getElementById('imageFile');
  const imagePreview = document.getElementById('imagePreview');
  const flash = document.getElementById('flash');

  function showFlash(message, type) {
    if (!flash) return;
    flash.classList.remove('hidden');
    // render message with close button so user can inspect at leisure
    const closeHtml = '<button id="flashClose" class="ml-3 text-sm font-semibold underline">Đóng</button>';
    if (type === 'error') {
      flash.className = 'px-5 py-4 text-sm text-rose-700 bg-rose-50 border-b border-rose-100';
      flash.innerHTML = `<div>${escapeHtml(message)}</div>${closeHtml}`;
      const btn = document.getElementById('flashClose');
      if (btn) btn.addEventListener('click', () => flash.classList.add('hidden'));
    } else {
      flash.className = 'px-5 py-4 text-sm text-emerald-700 bg-emerald-50 border-b border-emerald-100';
      flash.innerHTML = `<div>${escapeHtml(message)}</div>${closeHtml}`;
      const btn = document.getElementById('flashClose');
      if (btn) btn.addEventListener('click', () => flash.classList.add('hidden'));
      // auto-hide success messages after short delay
      setTimeout(() => { flash.classList.add('hidden'); }, 4000);
    }
  }
  if (imageFileInput) {
    imageFileInput.addEventListener('change', () => {
      const f = imageFileInput.files?.[0];
      if (f) {
        imagePreview.src = URL.createObjectURL(f);
        imagePreview.classList.remove('hidden');
      } else {
        if (values.image) {
          imagePreview.src = values.image;
          imagePreview.classList.remove('hidden');
        } else {
          imagePreview.classList.add('hidden');
        }
      }
    });
  }

  // Map picker
  const L = await waitForGlobal('L', 5000);
  if (L) {
    await setupMapPicker(L);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');

    const rawId = isEdit ? editId : (idInput?.value ?? '').toString().trim();
    const name = document.getElementById('name').value.trim();
    const description = document.getElementById('description').value.trim();
    const latRaw = document.getElementById('lat').value.trim();
    const lngRaw = document.getElementById('lng').value.trim();

    const id = isEdit ? editId : (rawId || suggestedId || generatePoiId());
    if (!isEdit && idInput && !rawId) idInput.value = id;

    const errors = validate({ id: rawId, name, description, latRaw, lngRaw, isEdit });
    if (errors.length) {
      errorBox.innerHTML = `
        <div class="font-semibold mb-1">Không thể lưu POI</div>
        <ul class="list-disc pl-5 space-y-0.5">${errors.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
      `;
      errorBox.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-70');

    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    const maplink = document.getElementById('maplink')?.value.trim();
    const file = imageFileInput?.files?.[0] ?? null;

    try {
        // upload image if a new file was chosen
        let imageUrl = values.image || null;
        if (file) {
          const bucket = 'poi-images';

          // Helper: parse bucket and path from a Supabase public storage URL
          function parseStorageUrl(u) {
            if (!u) return null;
            try {
              const s = String(u);
              // primary pattern: https://<host>/storage/v1/object/public/{bucket}/{path}
              let m = s.match(/\/storage\/v1\/object\/public\/(.*?)\/(.*)$/);
              if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
              // fallback: contains /object/public/{bucket}/{path}
              m = s.match(/object\/public\/(.*?)\/(.*)$/);
              if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
              // fallback: look for known bucket segment
              const idx = s.indexOf(`${bucket}/`);
              if (idx !== -1) {
                return { bucket, path: s.substring(idx + bucket.length + 1).split('?')[0] };
              }
              return null;
            } catch (e) { return null; }
          }

          const oldImage = values.image || null;

          const filePath = `${id}/${Date.now()}_${file.name}`;
          const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);
          if (uploadError) throw uploadError;
          const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
          imageUrl = publicData?.publicUrl ?? publicData?.publicURL ?? null;

          // If upload succeeded and there was a previous image, ask server to remove it (server uses service_role)
          if (oldImage && oldImage !== imageUrl) {
            try {
              const token = (session?.access_token ?? '') || '';
              const resp = await fetch('/api/storage/remove', {
                method: 'POST',
                headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: `Bearer ${token}` } : {}),
                body: JSON.stringify({ url: oldImage, poiId: id })
              });
              const j = await resp.json().catch(() => ({}));
              if (!resp.ok) {
                const m = j?.error || j?.message || 'Failed to remove old image';
                console.warn('Server failed to remove old image:', m);
                showFlash(`Xoá ảnh cũ thất bại: ${m}`, 'error');
              }
            } catch (e) {
              console.warn('Failed to request server to remove old image:', e);
              showFlash('Không thể kết nối server để xóa ảnh cũ.', 'error');
            }
          }
        }

      if (isEdit) {
        const res = await supabase
          .from('pois')
          .update({ name, description: description || null, lat, lng, image: imageUrl, maplink: maplink || null })
          .eq('id', id);
        if (res.error) throw res.error;
      } else {
        const res = await supabase
          .from('pois')
          .insert({ id, name, description: description || null, lat, lng, user_id: userId, image: imageUrl, maplink: maplink || null });
        if (res.error) throw res.error;
      }

      const { data: activeLanguages, error: langError } = await supabase
        .from('languages')
        .select('code')
        .eq('is_active', true);

      if (langError) {
        console.error('Lỗi lấy ngôn ngữ:', langError);
        throw langError;
      }

      // Only translate when adding a new POI, or when editing and
      // the description was actually changed by the user.
      const needTranslate = !isEdit || (isEdit && description !== values.description);

      if (needTranslate) {
        // Translate description to active languages and save to poitranslations
        await Promise.all(
          activeLanguages.map(async (lang) => {
            try {
              let translatedDesc = description;

              if (description && lang.code !== 'vi') {
                translatedDesc = await translateText(description, 'vi', lang.code);
              }

              await supabase.from('poitranslations').upsert({
                poi_id: id,
                lang_code: lang.code,
                description: translatedDesc || null
              }, { onConflict: 'poi_id,lang_code' });

            } catch (e) {
              console.error(`Lỗi ngôn ngữ ${lang.code}`, e);
            }
          })
        );
      }

      window.location.href = '/pois';
    } catch (err) {
      const msg = (err?.message ?? 'Không thể lưu POI. Vui lòng thử lại.').toString();
      errorBox.textContent = msg;
      errorBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-70');
    }
  });

  async function setupMapPicker(L) {
    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');

    const map = L.map('pickMap');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // TP.HCM (District 1 area)
    const defaultCenter = [10.776889, 106.700806];

    let marker = null;
    
    function parseLatLng() {
      const latRaw = (latInput.value ?? '').toString().trim();
      const lngRaw = (lngInput.value ?? '').toString().trim();
      if (latRaw === '' || lngRaw === '') return null;

      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (lat < -90 || lat > 90) return null;
      if (lng < -180 || lng > 180) return null;
      return [lat, lng];
    }

    function setLatLng(lat, lng) {
      latInput.value = String(lat);
      lngInput.value = String(lng);
      updateMarker([lat, lng], true);
    }

    function updateMarker(ll, pan = false) {
      if (!marker) {
        marker = L.marker(ll, { draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const p = marker.getLatLng();
          setLatLng(p.lat, p.lng);
        });
      } else {
        marker.setLatLng(ll);
      }

      if (pan) {
        map.setView(ll, Math.max(map.getZoom(), 16));
      }
    }

    // Init view
    const initial = parseLatLng();
    if (initial) {
      // Edit mode (or user already typed coords): focus on that point
      map.setView(initial, 16);
      updateMarker(initial, false);
    } else {
      // Add mode: always focus TP.HCM
      map.setView(defaultCenter, 14);
    }

    // Leaflet sometimes renders partially until it knows the final container size.
    // Force a reflow to avoid the gray area.
    requestAnimationFrame(() => map.invalidateSize());
    setTimeout(() => map.invalidateSize(), 100);

    // Click to set
    map.on('click', (e) => {
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));
      setLatLng(lat, lng);
    });

    // Typing into inputs updates marker (best-effort)
    const onInputs = () => {
      const ll = parseLatLng();
      if (ll) updateMarker(ll, false);
    };
    latInput.addEventListener('input', onInputs);
    lngInput.addEventListener('input', onInputs);
  }
}

function validate({ id, name, description, latRaw, lngRaw, isEdit }) {
  const errors = [];

  if (!isEdit) {
    if (id) {
      if (id.length > 50) errors.push('Mã POI (ID) tối đa 50 ký tự.');
      else if (!/^[A-Za-z0-9_-]+$/.test(id)) errors.push('Mã POI (ID) chỉ nên gồm chữ, số, dấu gạch dưới (_) hoặc gạch ngang (-).');
    }
  }

  if (!name) errors.push('Vui lòng nhập Tên POI.');
  else if (name.length > 200) errors.push('Tên POI tối đa 200 ký tự.');

  if (!description) errors.push('Vui lòng nhập Mô tả.');
  else if (description.length > 500) errors.push('Mô tả tối đa 500 ký tự.'); // Assuming a reasonable limit

  if (!latRaw || Number.isNaN(Number(latRaw))) errors.push('Vui lòng nhập Latitude hợp lệ.');
  if (!lngRaw || Number.isNaN(Number(lngRaw))) errors.push('Vui lòng nhập Longitude hợp lệ.');

  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (Number.isFinite(lat) && (lat < -90 || lat > 90)) errors.push('Latitude phải nằm trong [-90, 90].');
  if (Number.isFinite(lng) && (lng < -180 || lng > 180)) errors.push('Longitude phải nằm trong [-180, 180].');

  return errors;
}

function generatePoiId() {
  // Must match validation: letters/numbers/_/- only
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `poi_${now}${rand}`;
}
