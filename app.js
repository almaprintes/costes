(() => {
  'use strict';

  const PRODUCTS_KEY = 'almaprint:costes:products:v62';
  const QUOTES_KEY = 'almaprint:quotes:v62';
  const QUOTE_SEQ_KEY = 'almaprint:quotes:seq';

  const $ = (id) => document.getElementById(id);

  const tabProducts = $('tabProducts');
  const tabQuotes = $('tabQuotes');
  const viewProducts = $('viewProducts');
  const viewQuotes = $('viewQuotes');

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

  const qf = {
    number: $('quoteNumber'),
    date: $('quoteDate'),
    clientName: $('quoteClientName'),
    clientPhone: $('quoteClientPhone'),
    notes: $('quoteNotes'),
    itemName: $('quoteItemName'),
    itemQty: $('quoteItemQty'),
    itemPrice: $('quoteItemPrice')
  };

  const quoteItemsEl = $('quoteItems');
  const quoteBase = $('quoteBase');
  const quoteIgic = $('quoteIgic');
  const quoteTotal = $('quoteTotal');
  const quoteHistory = $('quoteHistory');
  const quoteTpl = $('quoteHistoryTemplate');

  const state = {
    products: load(PRODUCTS_KEY),
    quotes: load(QUOTES_KEY),
    filter: '',
    supplierFilter: '',
    categoryFilter: '',
    currentQuote: null
  };

  function n(value) {
    const num = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(num) ? num : 0;
  }
  function money(value) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n(value));
  }
  function moneyPlain(value) {
    return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n(value)) + ' €';
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
  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function saveProducts() {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(state.products));
  }
  function saveQuotes() {
    localStorage.setItem(QUOTES_KEY, JSON.stringify(state.quotes));
  }
  function nextQuoteNumber() {
    const current = Number(localStorage.getItem(QUOTE_SEQ_KEY) || 0) + 1;
    localStorage.setItem(QUOTE_SEQ_KEY, String(current));
    return `AP-${new Date().getFullYear()}-${String(current).padStart(3, '0')}`;
  }

  function defaultProduct() {
    return {
      id: '', name: '', category: '', supplierName: '', supplierPrice: 0, supplierDiscount: 5,
      igicPercent: 3, unitsPerPack: 1, inkCostPerMl: 0.1406, inkMlUsed: 3,
      paperCostPerSheet: 0.1865, paperSheetsUsed: 1, electricityCost: 0.02,
      laborMinutes: 10, laborRateHour: 10, extraCost: 0, marginPercent: 60,
      manualSalePrice: '', notes: '', createdAt: ''
    };
  }

  function defaultQuote() {
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: uid(),
      number: nextQuoteNumber(),
      date: today,
      clientName: '',
      clientPhone: '',
      notes: '',
      items: []
    };
  }

  function recalculate(raw) {
    const p = { ...defaultProduct(), ...raw };
    const discountedPackPrice = p.supplierPrice * (1 - p.supplierDiscount / 100);
    const baseCostUnit = discountedPackPrice / Math.max(1, p.unitsPerPack);
    const igicAmount = baseCostUnit * (p.igicPercent / 100);
    const baseCostWithIgic = baseCostUnit + igicAmount;
    const inkCost = p.inkCostPerMl * p.inkMlUsed;
    const paperCost = p.paperCostPerSheet * p.paperSheetsUsed;
    const laborCost = (p.laborMinutes / 60) * p.laborRateHour;
    const totalCost = baseCostWithIgic + inkCost + paperCost + p.electricityCost + p.extraCost + laborCost;
    const suggestedSalePrice = totalCost * (1 + p.marginPercent / 100);
    const salePrice = p.manualSalePrice !== '' && n(p.manualSalePrice) > 0 ? n(p.manualSalePrice) : suggestedSalePrice;
    const profit = salePrice - totalCost;
    const profitMargin = salePrice > 0 ? (profit / salePrice) * 100 : 0;
    return { ...p, baseCostWithIgic, inkCost, paperCost, laborCost, totalCost, salePrice, profit, profitMargin };
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

  function updatePreview() {
    const calc = recalculate(readFormValues());
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
  }

  function upsertProduct(product) {
    const idx = state.products.findIndex((p) => p.id === product.id);
    if (idx >= 0) state.products[idx] = product;
    else state.products.unshift(product);
    saveProducts();
    renderProducts();
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
    switchView('products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function duplicateProduct(product) {
    const copy = { ...product, id: uid(), name: `${product.name} (copia)`, createdAt: new Date().toISOString() };
    state.products.unshift(copy);
    saveProducts();
    renderProducts();
  }

  function removeProduct(id) {
    state.products = state.products.filter((p) => p.id !== id);
    saveProducts();
    renderProducts();
  }

  function getUniqueValues(field) {
    return [...new Set(state.products.map((p) => String(p[field] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  }

  function refreshOptions() {
    const suppliers = getUniqueValues('supplierName');
    const categories = getUniqueValues('category');
    supplierSuggestions.innerHTML = suppliers.map((v) => `<option value="${escapeHtml(v)}"></option>`).join('');
    categorySuggestions.innerHTML = categories.map((v) => `<option value="${escapeHtml(v)}"></option>`).join('');
    supplierFilter.innerHTML = `<option value="">Todos los proveedores</option>` + suppliers.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    categoryFilter.innerHTML = `<option value="">Todas las categorías</option>` + categories.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    supplierFilter.value = state.supplierFilter;
    categoryFilter.value = state.categoryFilter;
  }

  function filteredProducts() {
    const q = normalize(state.filter);
    const supplier = normalize(state.supplierFilter);
    const category = normalize(state.categoryFilter);
    return state.products.filter((p) => {
      const haystack = [p.name, p.category, p.supplierName, p.notes].join(' ').toLowerCase();
      return (!q || haystack.includes(q)) &&
             (!supplier || normalize(p.supplierName) === supplier) &&
             (!category || normalize(p.category) === category);
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

  function valueClass(value) {
    if (value > 0) return 'value-ok';
    if (value === 0) return 'value-warn';
    return 'value-bad';
  }

  function marginClass(value) {
    if (value >= 40) return 'value-ok';
    if (value >= 15) return 'value-warn';
    return 'value-bad';
  }

  function renderProducts() {
    refreshOptions();
    const products = filteredProducts();
    updateStats(products);
    listEl.innerHTML = '';
    if (!products.length) {
      listEl.innerHTML = `<div class="empty">No hay productos con ese filtro. Se escondieron detrás del vinilo premium.</div>`;
      return;
    }
    for (const product of products) {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.querySelector('.item-name').textContent = product.name || 'Sin nombre';
      node.querySelector('.item-meta').textContent = [product.category || 'Sin categoría', product.supplierName || 'Proveedor sin indicar'].join(' · ');
      const pill = node.querySelector('.item-total');
      pill.textContent = money(product.totalCost);
      if (product.profit <= 0) pill.classList.add('bad');

      node.querySelector('.item-base').textContent = money(product.baseCostWithIgic);
      node.querySelector('.item-consumables').textContent = money(n(product.inkCost) + n(product.paperCost));
      node.querySelector('.item-labor').textContent = money(product.laborCost);
      node.querySelector('.item-sale').textContent = money(product.salePrice);

      const profitEl = node.querySelector('.item-profit');
      profitEl.textContent = money(product.profit);
      profitEl.classList.add(valueClass(product.profit));

      const marginEl = node.querySelector('.item-margin');
      marginEl.textContent = percent(product.profitMargin);
      marginEl.classList.add(marginClass(product.profitMargin));

      node.querySelector('.item-notes').textContent = product.notes || 'Sin notas.';
      node.querySelector('.edit-btn').addEventListener('click', () => fillForm(product));
      node.querySelector('.duplicate-btn').addEventListener('click', () => duplicateProduct(product));
      node.querySelector('.delete-btn').addEventListener('click', () => {
        if (confirm(`¿Borrar "${product.name}"?`)) removeProduct(product.id);
      });
      node.querySelector('.add-quote-btn').addEventListener('click', () => {
        addQuoteItem(product.name, 1, round2(product.salePrice));
        switchView('quotes');
      });
      listEl.appendChild(node);
    }
  }

  function exportJson() {
    const payload = { app: 'AlmaPrint Costes v6.2 PDF Pro', exportedAt: new Date().toISOString(), products: state.products, quotes: state.quotes };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `almaprint-v62-${new Date().toISOString().slice(0,10)}.json`);
  }

  function exportCsv() {
    const headers = ['nombre','categoria','proveedor','coste_total','precio_venta','beneficio','margen_real_pct','notas'];
    const rows = state.products.map((p) => [p.name, p.category, p.supplierName, round2(p.totalCost), round2(p.salePrice), round2(p.profit), round2(p.profitMargin), p.notes]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `productos-almaprint-${new Date().toISOString().slice(0,10)}.csv`);
  }

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (Array.isArray(parsed.products)) state.products = parsed.products.map(recalculate);
        if (Array.isArray(parsed.quotes)) state.quotes = parsed.quotes;
        saveProducts(); saveQuotes();
        renderProducts(); renderQuotes();
        alert('Importación completada.');
      } catch {
        alert('No pude importar ese archivo.');
      }
    };
    reader.readAsText(file);
  }

  function switchView(which) {
    const productsActive = which === 'products';
    tabProducts.classList.toggle('active', productsActive);
    tabQuotes.classList.toggle('active', !productsActive);
    viewProducts.classList.toggle('active', productsActive);
    viewQuotes.classList.toggle('active', !productsActive);
  }

  // QUOTES
  function addQuoteItem(name, qty, price) {
    state.currentQuote.items.push({ id: uid(), name: name || '', qty: Math.max(1, n(qty) || 1), price: round2(price) });
    renderQuoteItems();
  }

  function removeQuoteItem(id) {
    state.currentQuote.items = state.currentQuote.items.filter((item) => item.id !== id);
    renderQuoteItems();
  }

  function renderQuoteItems() {
    quoteItemsEl.innerHTML = '';
    if (!state.currentQuote.items.length) {
      quoteItemsEl.innerHTML = `<div class="empty">Todavía no hay líneas en este presupuesto.</div>`;
    } else {
      state.currentQuote.items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'quote-row';
        const subtotal = round2(item.qty * item.price);
        row.innerHTML = `
          <div><strong>${escapeHtml(item.name)}</strong></div>
          <div><strong>${item.qty}</strong></div>
          <div><strong>${money(item.price)}</strong></div>
          <div><strong>${money(subtotal)}</strong></div>
          <div><button type="button" class="danger">Quitar</button></div>
        `;
        row.querySelector('button').addEventListener('click', () => removeQuoteItem(item.id));
        quoteItemsEl.appendChild(row);
      });
    }
    const totals = quoteTotals(state.currentQuote);
    quoteBase.textContent = money(totals.base);
    quoteIgic.textContent = money(totals.igic);
    quoteTotal.textContent = money(totals.total);
  }

  function quoteTotals(quote) {
    const base = round2((quote.items || []).reduce((sum, item) => sum + item.qty * item.price, 0));
    const igic = round2(base * 0.03);
    const total = round2(base + igic);
    return { base, igic, total };
  }

  function syncQuoteFieldsToState() {
    state.currentQuote.number = qf.number.value.trim();
    state.currentQuote.date = qf.date.value;
    state.currentQuote.clientName = qf.clientName.value.trim();
    state.currentQuote.clientPhone = qf.clientPhone.value.trim();
    state.currentQuote.notes = qf.notes.value.trim();
  }

  function loadQuoteIntoForm(quote) {
    state.currentQuote = JSON.parse(JSON.stringify(quote));
    qf.number.value = quote.number || '';
    qf.date.value = quote.date || new Date().toISOString().slice(0,10);
    qf.clientName.value = quote.clientName || '';
    qf.clientPhone.value = quote.clientPhone || '';
    qf.notes.value = quote.notes || '';
    qf.itemName.value = '';
    qf.itemQty.value = '1';
    qf.itemPrice.value = '';
    renderQuoteItems();
    switchView('quotes');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetQuoteForm() {
    state.currentQuote = defaultQuote();
    qf.number.value = state.currentQuote.number;
    qf.date.value = state.currentQuote.date;
    qf.clientName.value = '';
    qf.clientPhone.value = '';
    qf.notes.value = '';
    qf.itemName.value = '';
    qf.itemQty.value = '1';
    qf.itemPrice.value = '';
    renderQuoteItems();
  }

  function saveCurrentQuote() {
    syncQuoteFieldsToState();
    if (!state.currentQuote.items.length) {
      alert('Añade al menos una línea antes de guardar.');
      return;
    }
    const idx = state.quotes.findIndex((q) => q.id === state.currentQuote.id);
    const copy = JSON.parse(JSON.stringify(state.currentQuote));
    if (idx >= 0) state.quotes[idx] = copy;
    else state.quotes.unshift(copy);
    saveQuotes();
    renderQuotes();
    alert('Presupuesto guardado.');
  }

  function duplicateQuote(quote) {
    const copy = JSON.parse(JSON.stringify(quote));
    copy.id = uid();
    copy.number = nextQuoteNumber();
    state.quotes.unshift(copy);
    saveQuotes();
    renderQuotes();
  }

  function deleteQuote(id) {
    state.quotes = state.quotes.filter((q) => q.id !== id);
    saveQuotes();
    renderQuotes();
  }

  function renderQuotes() {
    quoteHistory.innerHTML = '';
    if (!state.quotes.length) {
      quoteHistory.innerHTML = `<div class="empty">Aún no hay presupuestos guardados.</div>`;
      return;
    }
    state.quotes.forEach((quote) => {
      const node = quoteTpl.content.firstElementChild.cloneNode(true);
      const totals = quoteTotals(quote);
      node.querySelector('.quote-name').textContent = quote.number || 'Sin número';
      node.querySelector('.quote-meta').textContent = [quote.clientName || 'Cliente sin nombre', formatDate(quote.date) || 'Sin fecha'].join(' · ');
      node.querySelector('.quote-total-pill').textContent = money(totals.total);
      node.querySelector('.quote-lines').textContent = quote.items.map((item) => `${item.qty} x ${item.name}`).join(' · ') || 'Sin líneas.';
      node.querySelector('.quote-open-btn').addEventListener('click', () => loadQuoteIntoForm(quote));
      node.querySelector('.quote-duplicate-btn').addEventListener('click', () => duplicateQuote(quote));
      node.querySelector('.quote-delete-btn').addEventListener('click', () => {
        if (confirm(`¿Borrar presupuesto ${quote.number}?`)) deleteQuote(quote.id);
      });
      node.querySelector('.quote-pdf-btn').addEventListener('click', () => generatePdf(quote));
      quoteHistory.appendChild(node);
    });
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('es-ES').format(d);
  }

  // PRETTY PDF BUILDER
  function escPdf(text) {
    return String(text || '')
      .replaceAll('\\', '\\\\')
      .replaceAll('(', '\\(')
      .replaceAll(')', '\\)')
      .replaceAll('\n', ' ');
  }

  function buildPdfOps(quote) {
    const totals = quoteTotals(quote);
    const ops = [];
    const pageH = 842;
    let y = pageH - 55;

    const text = (x, y, size, str, color='1 1 1', font='F1') => {
      ops.push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${escPdf(str)}) Tj ET`);
    };
    const line = (x1,y1,x2,y2,width=1,color='1 1 1') => {
      ops.push(`${width} w ${color} RG ${x1} ${y1} m ${x2} ${y2} l S`);
    };
    const rectFill = (x,y,w,h,color='0 0 0') => {
      ops.push(`${color} rg ${x} ${y} ${w} ${h} re f`);
    };
    const rectStroke = (x,y,w,h,width=1,color='1 1 1') => {
      ops.push(`${width} w ${color} RG ${x} ${y} ${w} ${h} re S`);
    };

    // Background header blocks
    rectFill(0, pageH-130, 595, 130, '0.08 0.07 0.16');
    rectFill(0, pageH-8, 595, 8, '0.54 0.36 1.00');
    rectFill(330, pageH-8, 265, 8, '1.00 0.55 0.26');
    rectFill(45, pageH-94, 44, 44, '0.54 0.36 1.00');
    rectFill(89, pageH-94, 16, 44, '1.00 0.55 0.26');

    text(120, pageH-62, 28, 'AlmaPrint', '1 1 1', 'F2');
    text(121, pageH-86, 11, 'Hecho con alma', '0.84 0.85 0.94');
    text(435, pageH-58, 13, 'PRESUPUESTO', '0.84 0.85 0.94', 'F2');
    text(435, pageH-78, 11, `Fecha: ${formatDate(quote.date)}`, '0.84 0.85 0.94');
    text(435, pageH-96, 11, `Nº: ${quote.number}`, '0.84 0.85 0.94');

    // Client card
    rectFill(40, pageH-195, 515, 50, '0.13 0.14 0.27');
    rectStroke(40, pageH-195, 515, 50, 0.6, '0.23 0.24 0.40');
    text(54, pageH-168, 10, `Cliente: ${quote.clientName || 'Sin indicar'}`, '1 1 1', 'F2');
    text(54, pageH-184, 10, `Teléfono: ${quote.clientPhone || 'Sin indicar'}`, '0.84 0.85 0.94');
    y = pageH - 235;

    // Table header
    rectFill(40, y, 515, 24, '0.54 0.36 1.00');
    text(52, y+8, 10, 'Producto', '1 1 1', 'F2');
    text(352, y+8, 10, 'Cant.', '1 1 1', 'F2');
    text(415, y+8, 10, 'Precio', '1 1 1', 'F2');
    text(485, y+8, 10, 'Subtotal', '1 1 1', 'F2');
    y -= 26;

    quote.items.forEach((item, idx) => {
      const bg = idx % 2 === 0 ? '0.96 0.96 0.99' : '0.92 0.93 0.98';
      rectFill(40, y, 515, 26, bg);
      text(52, y+8, 9, truncate(item.name, 38), '0.10 0.11 0.18');
      text(360, y+8, 9, String(item.qty), '0.10 0.11 0.18');
      text(410, y+8, 9, moneyPlain(item.price), '0.10 0.11 0.18');
      text(478, y+8, 9, moneyPlain(item.qty * item.price), '0.10 0.11 0.18', 'F2');
      y -= 26;
    });

    // totals box
    const boxY = Math.max(110, y - 20);
    rectFill(320, boxY, 235, 86, '0.13 0.14 0.27');
    rectStroke(320, boxY, 235, 86, 0.8, '0.23 0.24 0.40');
    text(336, boxY+58, 10, 'Base', '0.84 0.85 0.94');
    text(490, boxY+58, 10, moneyPlain(totals.base), '1 1 1', 'F2');
    text(336, boxY+38, 10, 'IGIC 3%', '0.84 0.85 0.94');
    text(490, boxY+38, 10, moneyPlain(totals.igic), '1 1 1', 'F2');
    line(336, boxY+30, 539, boxY+30, 0.6, '0.30 0.31 0.45');
    text(336, boxY+12, 14, 'TOTAL', '1.00 0.55 0.26', 'F2');
    text(471, boxY+10, 16, moneyPlain(totals.total), '1 1 1', 'F2');

    // observations
    const obsY = boxY - 76;
    rectFill(40, obsY, 515, 56, '0.97 0.97 1.0');
    rectStroke(40, obsY, 515, 56, 0.6, '0.80 0.81 0.88');
    text(52, obsY+36, 10, 'Observaciones', '0.10 0.11 0.18', 'F2');
    text(52, obsY+18, 9, truncate(quote.notes || 'Sin observaciones.', 88), '0.25 0.27 0.39');

    // footer
    rectFill(0, 0, 595, 64, '0.08 0.07 0.16');
    line(0, 64, 595, 64, 1, '0.17 0.16 0.31');
    text(40, 40, 10, 'Entrega orientativa: 3-5 días laborables', '0.84 0.85 0.94');
    text(40, 22, 10, 'Pago: Bizum / Transferencia', '0.84 0.85 0.94');
    text(365, 31, 10, 'Gracias por confiar en AlmaPrint', '0.55 0.57 0.72', 'F2');

    return ops.join('\n');
  }

  function truncate(str, max) {
    str = String(str || '');
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  function buildSimpleStyledPdf(quote) {
    const stream = buildPdfOps(quote);
    const objects = [];
    const offsets = [];
    let pdf = '%PDF-1.4\n';

    objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n');
    objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
    objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');
    objects.push(`6 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);

    objects.forEach((obj) => {
      offsets.push(pdf.length);
      pdf += obj;
    });

    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    offsets.forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    return new Blob([new TextEncoder().encode(pdf)], { type: 'application/pdf' });
  }

  function generatePdf(quoteParam = null) {
    syncQuoteFieldsToState();
    const quote = quoteParam ? JSON.parse(JSON.stringify(quoteParam)) : JSON.parse(JSON.stringify(state.currentQuote));
    if (!quote.items.length) {
      alert('Añade al menos una línea al presupuesto.');
      return;
    }
    const pdfBlob = buildSimpleStyledPdf(quote);
    downloadBlob(pdfBlob, `${(quote.number || 'presupuesto').replaceAll(' ', '_')}.pdf`);
  }

  function escapeHtml(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function round2(value) { return Math.round(n(value) * 100) / 100; }

  // Event wiring
  tabProducts.addEventListener('click', () => switchView('products'));
  tabQuotes.addEventListener('click', () => switchView('quotes'));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!fields.name.value.trim()) {
      fields.name.focus();
      return;
    }
    upsertProduct(recalculate(readFormValues()));
    resetForm();
  });

  Object.values(fields).forEach((field) => field && field.addEventListener('input', updatePreview));
  $('resetBtn').addEventListener('click', resetForm);
  $('exportJsonBtn').addEventListener('click', exportJson);
  $('exportCsvBtn').addEventListener('click', exportCsv);
  searchInput.addEventListener('input', () => { state.filter = searchInput.value; renderProducts(); });
  supplierFilter.addEventListener('change', () => { state.supplierFilter = supplierFilter.value; renderProducts(); });
  categoryFilter.addEventListener('change', () => { state.categoryFilter = categoryFilter.value; renderProducts(); });
  importInput.addEventListener('change', () => {
    const file = importInput.files?.[0];
    if (file) importData(file);
    importInput.value = '';
  });

  $('addCustomItemBtn').addEventListener('click', () => {
    const name = qf.itemName.value.trim();
    const qty = Math.max(1, n(qf.itemQty.value) || 1);
    const price = n(qf.itemPrice.value);
    if (!name || !price) {
      alert('Pon nombre y precio unitario.');
      return;
    }
    addQuoteItem(name, qty, price);
    qf.itemName.value = '';
    qf.itemQty.value = '1';
    qf.itemPrice.value = '';
  });

  $('saveQuoteBtn').addEventListener('click', saveCurrentQuote);
  $('resetQuoteBtn').addEventListener('click', resetQuoteForm);
  $('generatePdfBtn').addEventListener('click', () => generatePdf());

  state.currentQuote = defaultQuote();
  resetForm();
  resetQuoteForm();
  renderProducts();
  renderQuotes();
})();

// compact navigation for collapsible sections
function setupCompactNav(navId){
  const nav = document.getElementById(navId);
  if(!nav) return;
  nav.querySelectorAll('.mini-tab').forEach((btn)=>{
    btn.addEventListener('click', ()=>{
      const targetId = btn.dataset.target;
      const target = document.getElementById(targetId);
      if(!target) return;
      nav.querySelectorAll('.mini-tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.form-section').forEach(sec=>{
        if(sec.id === targetId) sec.open = true;
      });
      target.scrollIntoView({behavior:'smooth', block:'start'});
    });
  });
}

setupCompactNav('productQuickNav');
setupCompactNav('quoteQuickNav');
