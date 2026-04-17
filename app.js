
let data = JSON.parse(localStorage.getItem('productos')||'[]');

function calcularBeneficio(p){
  const bruto = p.venta - p.coste;
  const neto = bruto - (bruto * (p.gastos||0)/100);
  return {bruto, neto};
}

function guardar(){
  const nombre = document.getElementById('nombre').value;
  const proveedor = document.getElementById('proveedor').value;
  const categoria = document.getElementById('categoria').value;
  const coste = parseFloat(document.getElementById('coste').value)||0;
  const venta = parseFloat(document.getElementById('venta').value)||0;
  const gastos = parseFloat(document.getElementById('gastos').value)||0;

  const {bruto, neto} = calcularBeneficio({coste, venta, gastos});

  data.push({nombre, proveedor, categoria, coste, venta, gastos, bruto, neto});
  localStorage.setItem('productos', JSON.stringify(data));
  render();
}

function duplicar(i){
  const nuevo = {...data[i]};
  nuevo.nombre = nuevo.nombre + " (copia)";
  data.push(nuevo);
  localStorage.setItem('productos', JSON.stringify(data));
  render();
}

function eliminar(i){
  data.splice(i,1);
  localStorage.setItem('productos', JSON.stringify(data));
  render();
}

function render(){
  const ul = document.getElementById('lista');
  if(!ul) return;
  ul.innerHTML = '';
  data.forEach((p,i)=>{
    const li = document.createElement('li');
    li.innerHTML = `
      <b>${p.nombre}</b><br>
      ${p.proveedor} - ${p.categoria}<br>
      Coste: ${p.coste}€ | Venta: ${p.venta}€<br>
      Beneficio: ${p.bruto.toFixed(2)}€ | Neto: ${p.neto.toFixed(2)}€<br>
      <button onclick="duplicar(${i})">Duplicar</button>
      <button onclick="eliminar(${i})">Eliminar</button>
    `;
    ul.appendChild(li);
  });
}

render();
