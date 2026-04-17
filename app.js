(() => {
  'use strict';

  const STORAGE_KEY = 'almaprint:costes:products:v5';
  const LEGACY_KEYS = [
    'almaprint:costes:products:v4',
    'almaprint:costes:products:v3',
    'almaprint:costes:products:v2',
    'almaprint:costes:products:v1',
    'productos'
  ];

  const $ = (id) => document.getElementById(id);
  const form = $('productForm');
  const listEl = $('productList');
  const tpl = $('productItemTemplate');
  const searchInput = $('searchInput');
  const supplierFilter = $('supplierFilter');
  const categoryFilter = $('categoryFilter');
  const supplierSuggestions = $('supplierSuggestions');
  const categorySuggestions = $('categorySuggestions');
  const importInput = $('importInput');
  const saveBtn = $('saveBtn');

  const installBtn = $('installBtn');
  let deferredPrompt = null;

  const fields = {
    productId: $('productId'),
    name: $('name'),
    category: $('category'),
    supplierName: $('supplierName'),
    supplierPrice: $('supplierPrice'),
    supplierDiscount: $('supplierDiscount'),
    igicPercent: $('igicPercent'),
    unitsPerPack: $('unitsPerPack'),
    inkCostPerMl: $('inkCostPerMl'),
    inkMlUsed: $('inkMlUsed'),
    paperCostPerSheet: $('paperCostPerSheet'),
    paperSheetsUsed: $('paperSheetsUsed'),
    electricityCost: $('electricityCost'),
    laborMinutes: $('laborMinutes'),
    laborRateHour: $('laborRateHour'),
    extraCost: $('extraCost'),
    marginPercent: $('marginPercent'),
    manualSalePrice: $('manualSalePrice'),
    notes: $('notes')
  };

  const previews = {
    base: $('baseCostPreview'),
    ink: $('inkCostPreview'),
    paper: $('paperCostPreview'),
    labor: $('laborCostPreview'),
    total: $('totalCostPreview'),
    sale: $('salePricePreview'),
    profit: $('profitPreview'),
    margin: $('profitMarginPreview')
  };

  const stats = {
    count: $('statsCount'),
    avg: $('statsAvg'),
    saleAvg: $('statsSaleAvg'),
    profitAvg: $('statsProfitAvg')
  };

  const state = {
    products: loadProducts(),
    filter: '',
    supplierFilter: '',
    categoryFilter: ''
  };

  function n(value) {
    const num = Number(String(value).replace(',', '.'));
    return Number.isFinite(num) ? num : 0;
  }

  function money(value) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n(value));
  }

  function percent(value) {
    return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(n(value))}%`;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function normalize(text) {
    return String(text || '').trim().toLowerCase();
  }

  function loadProducts() {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current) {
        const parsed = JSON.parse(current);
        return Array.isArray(parsed) ? parsed.map(migrateProduct) : [];
      }
      for (const key of LEGACY_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const products = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.products) ? parsed.products : []);
        if (products.length) return products.map(migrateProduct);
      }
    } catch {}
    return [];
  }

  function saveProducts() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.products));
  }

  function migrateProduct(product) {
    if (!product || typeof product !== 'object') return defaultProduct();
    const p = { ...defaultProduct(), ...product };
    if (product.calc && typeof product.calc === 'object') {
      // legacy shape
      p.baseCostWithIgic = n(product.calc.baseCostUnit || product.baseCostWithIgic);
      p.inkCost = n(product.calc.inkCost || product.inkCost);
      p.paperCost = n(product.calc.paperCost || product.paperCost);
      p.laborCost = n(product.calc.laborCost || product.laborCost);
      p.totalCost = n(product.calc.totalCost || product.totalCost);
      p.salePrice = n(product.calc.suggestedSalePrice || product.salePrice);
      p.profit = n(product.profit || (p.salePrice - p.totalCost));
      p.profitMargin = p.salePrice > 0 ? (p.profit / p.salePrice) * 100 : 0;
    } else {
      const recalc = recalculate(p);
      Object.assign(p, recalc);
    }
    p.id = p.id || uid();
    return p;
  }

  function defaultProduct() {
    return {
      id: '',
      name: '',
      category: '',
      supplierName: '',
      supplierPrice: 0,
      supplierDiscount: 5,
      igicPercent: 3,
      unitsPerPack: 1,
      inkCostPerMl: 0.1406,
      inkMlUsed: 3,
      paperCostPerSheet: 0.1865,
      paperSheetsUsed: 1,
      electricityCost: 0.02,
      laborMinutes: 10,
      laborRateHour: 10,
      extraCost: 0,
      marginPercent: 60,
      manualSalePrice: '',
      notes: '',
      createdAt: '',
      baseCostWithIgic: 0,
      inkCost: 0,
      paperCost: 0,
      laborCost: 0,
      totalCost: 0,
      salePrice: 0,
      profit: 0,
      profitMargin: 0
    };
  }

  function calculateFromForm() {
    return recalculate(readFormValues());
  }

  function readFormValues() {
    return {
      id: fields.productId.value || uid(),
      name: fields.name.value.trim(),
      category: fields.category.value.trim(),
      supplierName: fields.supplierName.value.trim(),
      supplierPrice: n(fields.supplierPrice.value),
      supplierDiscount: n(fields.supplierDiscount.value),
      igicPercent: n(fields.igicPercent.value || 3),
      unitsPerPack: Math.max(1, n(fields.unitsPerPack.value)),
      inkCostPerMl: n(fields.inkCostPerMl.value),
      inkMlUsed: n(fields.inkMlUsed.value),
      paperCostPerSheet: n(fields.paperCostPerSheet.value),
      paperSheetsUsed: n(fields.paperSheetsUsed.value),
      electricityCost: n(fields.electricityCost.value),
      laborMinutes: n(fields.laborMinutes.value),
      laborRateHour: n(fields.laborRateHour.value),
      extraCost: n(fields.extraCost.value),
      marginPercent: n(fields.marginPercent.value),
      manualSalePrice: fields.manualSalePrice.value === '' ? '' : n(fields.manualSalePrice.value),
      notes: fields.notes.value.trim(),
      createdAt: new Date().toISOString()
    };
  }

  function recalculate(raw) {
    const product = { ...defaultProduct(), ...raw };
    const discountedPackPrice = product.supplierPrice * (1 - product.supplierDiscount / 100);
    const baseCostUnit = discountedPackPrice / Math.max(1, product.unitsPerPack);
    const igicAmount = baseCostUnit * (product.igicPercent / 100);
    const baseCostWithIgic = baseCostUnit + igicAmount;
    const inkCost = product.inkCostPerMl * product.inkMlUsed;
    const paperCost = product.paperCostPerSheet * product.paperSheetsUsed;
    const laborCost = (product.laborMinutes / 60) * product.laborRateHour;
    const totalCost = baseCostWithIgic + inkCost + paperCost + product.electricityCost + laborCost + product.extraCost;
    const suggestedSalePrice = totalCost * (1 + product.marginPercent / 100);
    const salePrice = product.manualSalePrice !== '' && n(product.manualSalePrice) > 0
      ? n(product.manualSalePrice)
      : suggestedSalePrice;
    const profit = salePrice - totalCost;
    const profitMargin = salePrice > 0 ? (profit / salePrice) * 100 : 0;

    return {
      ...product,
      baseCostWithIgic,
      inkCost,
      paperCost,
      laborCost,
      totalCost,
      salePrice,
      profit,
      profitMargin
    };
  }

  function updatePreview() {
    const calc = calculateFromForm();
    previews.base.textContent = money(calc.baseCostWithIgic);
    previews.ink.textContent = money(calc.inkCost);
    previews.paper.textContent = money(calc.paperCost);
    previews.labor.textContent = money(calc.laborCost);
    previews.total.textContent = money(calc.totalCost);
    previews.sale.textContent = money(calc.salePrice);
    previews.profit.textContent = money(calc.profit);
    previews.margin.textContent = percent(calc.profitMargin);

    setValueTone(previews.profit, calc.profit);
    setMarginTone(previews.margin, calc.profitMargin);
  }

  function setValueTone(el, value) {
    el.classList.remove('ok', 'warn', 'bad');
    if (value > 0) el.classList.add('ok');
    else if (value === 0) el.classList.add('warn');
    else el.classList.add('bad');
  }

  function setMarginTone(el, margin) {
    el.classList.remove('ok', 'warn', 'bad');
    if (margin >= 40) el.classList.add('ok');
    else if (margin >= 15) el.classList.add('warn');
    else el.classList.add('bad');
  }

  function resetForm() {
    form.reset();
    fields.productId.value = '';
    fields.supplierPrice.value = '0';
    fields.supplierDiscount.value = '5';
    fields.igicPercent.value = '3';
    fields.unitsPerPack.value = '1';
    fields.inkCostPerMl.value = '0.1406';
    fields.inkMlUsed.value = '3';
    fields.paperCostPerSheet.value = '0.1865';
    fields.paperSheetsUsed.value = '1';
    fields.electricityCost.value = '0.02';
    fields.laborMinutes.value = '10';
    fields.laborRateHour.value = '10';
    fields.extraCost.value = '0';
    fields.marginPercent.value = '60';
    fields.manualSalePrice.value = '';
    saveBtn.textContent = 'Guardar producto';
    updatePreview();
    fields.name.focus();
  }

  function upsertProduct(product) {
    const idx = state.products.findIndex((p) => p.id === product.id);
    if (idx >= 0) state.products[idx] = product;
    else state.products.unshift(product);
    saveProducts();
    render();
  }

  function fillForm(product) {
    fields.productId.value = product.id;
    fields.name.value = product.name || '';
    fields.category.value = product.category || '';
    fields.supplierName.value = product.supplierName || '';
    fields.supplierPrice.value = product.supplierPrice ?? 0;
    fields.supplierDiscount.value = product.supplierDiscount ?? 5;
    fields.igicPercent.value = product.igicPercent ?? 3;
    fields.unitsPerPack.value = product.unitsPerPack ?? 1;
    fields.inkCostPerMl.value = product.inkCostPerMl ?? 0.1406;
    fields.inkMlUsed.value = product.inkMlUsed ?? 3;
    fields.paperCostPerSheet.value = product.paperCostPerSheet ?? 0.1865;
    fields.paperSheetsUsed.value = product.paperSheetsUsed ?? 1;
    fields.electricityCost.value = product.electricityCost ?? 0.02;
    fields.laborMinutes.value = product.laborMinutes ?? 10;
    fields.laborRateHour.value = product.laborRateHour ?? 10;
    fields.extraCost.value = product.extraCost ?? 0;
    fields.marginPercent.value = product.marginPercent ?? 60;
    fields.manualSalePrice.value = product.manualSalePrice ?? '';
    fields.notes.value = product.notes || '';
    saveBtn.textContent = 'Actualizar producto';
    updatePreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function duplicateProduct(product) {
    const copy = {
      ...product,
      id: uid(),
      name: `${product.name || 'Producto'} (copia)`,
      createdAt: new Date().toISOString()
    };
    state.products.unshift(copy);
    saveProducts();
    render();
  }

  function removeProduct(id) {
    state.products = state.products.filter((p) => p.id !== id);
    saveProducts();
    render();
  }

  function getUniqueValues(field, products = state.products) {
    return [...new Set(products
      .map((p) => String(p[field] || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es'))
    )];
  }

  function refreshOptions() {
    const suppliers = getUniqueValues('supplierName');
    const categories = getUniqueValues('category');

    supplierSuggestions.innerHTML = suppliers.map((name) => `<option value="${escapeHtml(name)}"></option>`).join('');
    categorySuggestions.innerHTML = categories.map((name) => `<option value="${escapeHtml(name)}"></option>`).join('');

    refreshSelect(supplierFilter, suppliers, 'Todos los proveedores', state.supplierFilter, (v) => { state.supplierFilter = v; });
    refreshSelect(categoryFilter, categories, 'Todas las categorías', state.categoryFilter, (v) => { state.categoryFilter = v; });
  }

  function refreshSelect(selectEl, values, defaultLabel, currentValue, onReset) {
    selectEl.innerHTML = `<option value="">${defaultLabel}</option>` +
      values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    if (values.includes(currentValue)) {
      selectEl.value = currentValue;
    } else {
      selectEl.value = '';
      onReset('');
    }
  }

  function filteredProducts() {
    const q = normalize(state.filter);
    const supplier = normalize(state.supplierFilter);
    const category = normalize(state.categoryFilter);

    return state.products.filter((p) => {
      const haystack = [p.name, p.category, p.notes, p.supplierName].join(' ').toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      const matchesSupplier = !supplier || normalize(p.supplierName) === supplier;
      const matchesCategory = !category || normalize(p.category) === category;
      return matchesSearch && matchesSupplier && matchesCategory;
    });
  }

  function updateStats(products) {
    stats.count.textContent = String(products.length);
    const avg = products.length ? products.reduce((a, p) => a + n(p.totalCost), 0) / products.length : 0;
    const saleAvg = products.length ? products.reduce((a, p) => a + n(p.salePrice), 0) / products.length : 0;
    const profitAvg = products.length ? products.reduce((a, p) => a + n(p.profit), 0) / products.length : 0;
    stats.avg.textContent = money(avg);
    stats.saleAvg.textContent = money(saleAvg);
    stats.profitAvg.textContent = money(profitAvg);
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function profitClass(value) {
    if (value > 0) return 'value-ok';
    if (value === 0) return 'value-warn';
    return 'value-bad';
  }

  function marginClass(value) {
    if (value >= 40) return 'value-ok';
    if (value >= 15) return 'value-warn';
    return 'value-bad';
  }

  function render() {
    refreshOptions();
    const products = filteredProducts();
    listEl.innerHTML = '';
    updateStats(products);

    if (!products.length) {
      listEl.innerHTML = `<div class="empty">No hay productos con ese filtro. Se escondieron detrás de la taza de muestra.</div>`;
      return;
    }

    for (const product of products) {
      const node = tpl.content.firstElementChild.cloneNode(true);
      const meta = [product.category || 'Sin categoría', product.supplierName || 'Proveedor sin indicar'].join(' · ');
      node.querySelector('.item-name').textContent = product.name || 'Sin nombre';
      node.querySelector('.item-meta').textContent = meta;

      const pill = node.querySelector('.item-total');
      pill.textContent = money(product.totalCost);
      if (product.profit <= 0) pill.classList.add('bad');

      node.querySelector('.item-base').textContent = money(product.baseCostWithIgic);
      node.querySelector('.item-consumables').textContent = money(product.inkCost + product.paperCost);
      node.querySelector('.item-labor').textContent = money(product.laborCost);
      node.querySelector('.item-sale').textContent = money(product.salePrice);

      const profitEl = node.querySelector('.item-profit');
      profitEl.textContent = money(product.profit);
      profitEl.classList.add(profitClass(product.profit));

      const marginEl = node.querySelector('.item-margin');
      marginEl.textContent = percent(product.profitMargin);
      marginEl.classList.add(marginClass(product.profitMargin));

      node.querySelector('.item-notes').textContent = product.notes || 'Sin notas.';
      node.querySelector('.edit-btn').addEventListener('click', () => fillForm(product));
      node.querySelector('.duplicate-btn').addEventListener('click', () => duplicateProduct(product));
      node.querySelector('.delete-btn').addEventListener('click', () => {
        if (confirm(`¿Borrar "${product.name}"?`)) removeProduct(product.id);
      });

      listEl.appendChild(node);
    }
  }

  function exportJson() {
    const payload = {
      app: 'AlmaPrint Costes v5 Pro',
      exportedAt: new Date().toISOString(),
      products: state.products
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `almaprint-costes-${new Date().toISOString().slice(0,10)}.json`);
  }

  function exportCsv() {
    const headers = [
      'nombre','categoria','proveedor','precio_original','descuento_pct','igic_pct','unidades_pack',
      'base_con_igic','tinta','papel','electricidad','mano_obra','otros_costes',
      'coste_total','margen_deseado_pct','precio_venta','beneficio','margen_real_pct','notas'
    ];
    const rows = state.products.map((p) => [
      p.name, p.category, p.supplierName, p.supplierPrice, p.supplierDiscount, p.igicPercent, p.unitsPerPack,
      round2(p.baseCostWithIgic), round2(p.inkCost), round2(p.paperCost), round2(p.electricityCost),
      round2(p.laborCost), round2(p.extraCost), round2(p.totalCost), p.marginPercent,
      round2(p.salePrice), round2(p.profit), round2(p.profitMargin), p.notes
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `almaprint-costes-${new Date().toISOString().slice(0,10)}.csv`);
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return `"${text.replaceAll('"', '""')}"`;
  }

  function round2(value) {
    return Math.round(n(value) * 100) / 100;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const products = Array.isArray(parsed) ? parsed : parsed.products;
        if (!Array.isArray(products)) throw new Error('Formato no válido');
        state.products = products.map(migrateProduct);
        saveProducts();
        render();
        alert('Importación completada. Tus productos han vuelto a casa.');
      } catch {
        alert('No pude importar ese archivo. Revisa que sea un JSON exportado por la app.');
      }
    };
    reader.readAsText(file);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPrompt = event;
      installBtn.classList.remove('hidden');
    });

    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.classList.add('hidden');
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!fields.name.value.trim()) {
      fields.name.focus();
      return;
    }
    const product = recalculate(readFormValues());
    upsertProduct(product);
    resetForm();
  });

  Object.values(fields).forEach((field) => {
    if (!field) return;
    field.addEventListener('input', updatePreview);
  });

  $('resetBtn').addEventListener('click', resetForm);
  $('exportJsonBtn').addEventListener('click', exportJson);
  $('exportCsvBtn').addEventListener('click', exportCsv);

  searchInput.addEventListener('input', () => {
    state.filter = searchInput.value;
    render();
  });

  supplierFilter.addEventListener('change', () => {
    state.supplierFilter = supplierFilter.value;
    render();
  });

  categoryFilter.addEventListener('change', () => {
    state.categoryFilter = categoryFilter.value;
    render();
  });

  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (file) importData(file);
    importInput.value = '';
  });

  updatePreview();
  render();
  registerServiceWorker();
  setupInstallPrompt();
})();