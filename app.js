(() => {
  'use strict';

  const STORAGE_KEY = 'almaprint:costes:products:v1';
  const $ = (id) => document.getElementById(id);
  const form = $('productForm');
  const listEl = $('productList');
  const tpl = $('productItemTemplate');
  const searchInput = $('searchInput');

  const installBtn = $('installBtn');
  let deferredPrompt = null;

  const fields = {
    productId: $('productId'),
    name: $('name'),
    category: $('category'),
    supplierPrice: $('supplierPrice'),
    supplierDiscount: $('supplierDiscount'),
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
    notes: $('notes')
  };

  const previews = {
    base: $('baseCostPreview'),
    ink: $('inkCostPreview'),
    paper: $('paperCostPreview'),
    labor: $('laborCostPreview'),
    total: $('totalCostPreview'),
    sale: $('salePricePreview')
  };

  const stats = {
    count: $('statsCount'),
    avg: $('statsAvg'),
    saleAvg: $('statsSaleAvg')
  };

  const state = {
    products: loadProducts(),
    filter: ''
  };

  function n(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  function money(value) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n(value));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function loadProducts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveProducts() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.products));
  }

  function calculateFromForm() {
    const supplierPrice = n(fields.supplierPrice.value);
    const supplierDiscount = n(fields.supplierDiscount.value);
    const unitsPerPack = Math.max(1, n(fields.unitsPerPack.value));
    const inkCostPerMl = n(fields.inkCostPerMl.value);
    const inkMlUsed = n(fields.inkMlUsed.value);
    const paperCostPerSheet = n(fields.paperCostPerSheet.value);
    const paperSheetsUsed = n(fields.paperSheetsUsed.value);
    const electricityCost = n(fields.electricityCost.value);
    const laborMinutes = n(fields.laborMinutes.value);
    const laborRateHour = n(fields.laborRateHour.value);
    const extraCost = n(fields.extraCost.value);
    const marginPercent = n(fields.marginPercent.value);

    const discountedPackPrice = supplierPrice * (1 - supplierDiscount / 100);
    const baseCostUnit = discountedPackPrice / unitsPerPack;
    const inkCost = inkCostPerMl * inkMlUsed;
    const paperCost = paperCostPerSheet * paperSheetsUsed;
    const laborCost = (laborMinutes / 60) * laborRateHour;
    const totalCost = baseCostUnit + inkCost + paperCost + electricityCost + laborCost + extraCost;
    const suggestedSalePrice = totalCost * (1 + marginPercent / 100);

    return {
      discountedPackPrice,
      baseCostUnit,
      inkCost,
      paperCost,
      laborCost,
      electricityCost,
      extraCost,
      totalCost,
      suggestedSalePrice
    };
  }

  function updatePreview() {
    const calc = calculateFromForm();
    previews.base.textContent = money(calc.baseCostUnit);
    previews.ink.textContent = money(calc.inkCost);
    previews.paper.textContent = money(calc.paperCost);
    previews.labor.textContent = money(calc.laborCost);
    previews.total.textContent = money(calc.totalCost);
    previews.sale.textContent = money(calc.suggestedSalePrice);
  }

  function resetForm() {
    form.reset();
    fields.productId.value = '';
    fields.supplierPrice.value = '0';
    fields.supplierDiscount.value = '5';
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
    updatePreview();
    fields.name.focus();
  }

  function buildProductFromForm() {
    const calc = calculateFromForm();
    return {
      id: fields.productId.value || uid(),
      name: fields.name.value.trim(),
      category: fields.category.value.trim(),
      supplierPrice: n(fields.supplierPrice.value),
      supplierDiscount: n(fields.supplierDiscount.value),
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
      notes: fields.notes.value.trim(),
      createdAt: new Date().toISOString(),
      calc
    };
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
    fields.supplierPrice.value = product.supplierPrice ?? 0;
    fields.supplierDiscount.value = product.supplierDiscount ?? 5;
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
    fields.notes.value = product.notes || '';
    updatePreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function removeProduct(id) {
    state.products = state.products.filter((p) => p.id !== id);
    saveProducts();
    render();
  }

  function filteredProducts() {
    const q = state.filter.trim().toLowerCase();
    if (!q) return state.products;
    return state.products.filter((p) =>
      [p.name, p.category, p.notes].join(' ').toLowerCase().includes(q)
    );
  }

  function updateStats(products) {
    stats.count.textContent = String(products.length);
    const avg = products.length ? products.reduce((a, p) => a + n(p.calc?.totalCost), 0) / products.length : 0;
    const saleAvg = products.length ? products.reduce((a, p) => a + n(p.calc?.suggestedSalePrice), 0) / products.length : 0;
    stats.avg.textContent = money(avg);
    stats.saleAvg.textContent = money(saleAvg);
  }

  function render() {
    const products = filteredProducts();
    listEl.innerHTML = '';
    updateStats(products);

    if (!products.length) {
      listEl.innerHTML = `<div class="empty">Todavía no hay productos guardados. Aquí irá tu pequeño imperio de costes.</div>`;
      return;
    }

    for (const product of products) {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.querySelector('.item-name').textContent = product.name || 'Sin nombre';
      node.querySelector('.item-category').textContent = product.category || 'Sin categoría';
      node.querySelector('.item-total').textContent = money(product.calc?.totalCost);
      node.querySelector('.item-base').textContent = money(product.calc?.baseCostUnit);
      node.querySelector('.item-consumables').textContent = money((product.calc?.inkCost || 0) + (product.calc?.paperCost || 0));
      node.querySelector('.item-labor').textContent = money(product.calc?.laborCost);
      node.querySelector('.item-sale').textContent = money(product.calc?.suggestedSalePrice);
      node.querySelector('.item-notes').textContent = product.notes || 'Sin notas.';
      node.querySelector('.edit-btn').addEventListener('click', () => fillForm(product));
      node.querySelector('.delete-btn').addEventListener('click', () => {
        if (confirm(`¿Borrar "${product.name}"?`)) removeProduct(product.id);
      });
      listEl.appendChild(node);
    }
  }

  function exportData() {
    const payload = {
      app: 'AlmaPrint Costes',
      exportedAt: new Date().toISOString(),
      products: state.products
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `almaprint-costes-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const products = Array.isArray(parsed) ? parsed : parsed.products;
        if (!Array.isArray(products)) throw new Error('Formato no válido');
        state.products = products;
        saveProducts();
        render();
        alert('Importación completada. Tus productos han vuelto a casa.');
      } catch {
        alert('No pude importar ese archivo. Revisa que sea un JSON exportado por la app.');
      }
    };
    reader.readAsText(file);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!fields.name.value.trim()) {
      fields.name.focus();
      return;
    }
    upsertProduct(buildProductFromForm());
    resetForm();
  });

  form.addEventListener('input', updatePreview);
  $('resetBtn').addEventListener('click', resetForm);
  $('exportBtn').addEventListener('click', exportData);
  $('importInput').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importData(file);
    e.target.value = '';
  });
  searchInput.addEventListener('input', (e) => {
    state.filter = e.target.value || '';
    render();
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.classList.remove('hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add('hidden');
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
  }

  updatePreview();
  render();
})();
