// ============================================================
//  CONFIGURACIÓN
// ============================================================
const ADMIN_PASSWORD = 'Abaco222';

// ============================================================
//  ELEMENTOS DEL DOM
// ============================================================
const pantallaLogin = document.getElementById('pantalla-login');
const panelPrincipal = document.getElementById('panel-principal');
const inputPassword = document.getElementById('input-password');
const btnLogin = document.getElementById('btn-login');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');

const tabInventario = document.getElementById('tab-inventario');
const tabPedidos = document.getElementById('tab-pedidos');
const tabHistorial = document.getElementById('tab-historial');
const tabReporte = document.getElementById('tab-reporte');
const vistaInventario = document.getElementById('vista-inventario');
const vistaPedidos = document.getElementById('vista-pedidos');
const vistaHistorial = document.getElementById('vista-historial');
const vistaReporteMensual = document.getElementById('vista-reporte-mensual');

const listaProductos = document.getElementById('lista-productos');
const listaPedidos = document.getElementById('lista-pedidos');
const tablaHistorial = document.getElementById('tabla-historial');

const modalNuevo = document.getElementById('modal-nuevo');
const modalStock = document.getElementById('modal-stock');
const modalReporte = document.getElementById('modal-reporte');
const modalEntrega = document.getElementById('modal-entrega');
const formNuevoProducto = document.getElementById('form-nuevo-producto');

// Variables temporales
let productoSeleccionadoId = null;
let tipoAjuste = null;
let productoEditandoId = null;
let pedidoParaEntregar = null;

// ============================================================
//  LOGIN
// ============================================================
function verificarSesion() {
    const sesion = sessionStorage.getItem('admin_sesion');
    if (sesion === 'ok') {
        mostrarPanel();
    } else {
        pantallaLogin.classList.remove('oculto');
        panelPrincipal.classList.add('oculto');
        setTimeout(() => inputPassword.focus(), 100);
    }
}

function mostrarPanel() {
    pantallaLogin.classList.add('oculto');
    panelPrincipal.classList.remove('oculto');
    iniciarListeners();
}

btnLogin.addEventListener('click', () => {
    if (inputPassword.value === ADMIN_PASSWORD) {
        sessionStorage.setItem('admin_sesion', 'ok');
        loginError.style.display = 'none';
        inputPassword.value = '';
        mostrarPanel();
    } else {
        loginError.style.display = 'block';
        inputPassword.value = '';
        inputPassword.focus();
    }
});

inputPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnLogin.click();
});

btnLogout.addEventListener('click', () => {
    sessionStorage.removeItem('admin_sesion');
    verificarSesion();
});

// ============================================================
//  LISTENERS EN TIEMPO REAL (Firebase onSnapshot)
// ============================================================
let unsubInv = null, unsubPed = null, unsubHist = null;
let pedidosIds = new Set();

function iniciarListeners() {
    if (unsubInv) unsubInv();
    if (unsubPed) unsubPed();
    if (unsubHist) unsubHist();

    unsubInv = db.collection('inventario').onSnapshot(snap => {
        inventario = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const filtro = document.getElementById('buscador-inventario').value;
        renderizarInventario(filtro);
        actualizarDashboard();
    });

    unsubPed = db.collection('pedidos').onSnapshot(snap => {
        const nuevos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        nuevos.filter(p => p.estado === 'pendiente' && !pedidosIds.has(p.id)).forEach(p => {
            if (pedidosIds.size > 0) mostrarToast(`¡Nuevo pedido de ${p.cliente}!`);
        });
        pedidosIds = new Set(nuevos.map(p => p.id));
        pedidos = nuevos;
        if (!vistaPedidos.classList.contains('oculto')) renderizarPedidos();
        actualizarDashboard();
    });

    unsubHist = db.collection('historial').onSnapshot(snap => {
        historial = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        if (!vistaHistorial.classList.contains('oculto')) renderizarHistorial();
    });
}

// ============================================================
//  DASHBOARD
// ============================================================
function actualizarDashboard() {
    const faltantesInv = inventario.filter(p => p.cantidad <= p.minimo).length;
    document.getElementById('dash-alerta').textContent = faltantesInv;

    let pedidosListos = 0;
    let pedidosFaltantes = 0;
    let pendientes = 0;

    pedidos.forEach(pedido => {
        // Solo contar los que realmente están pendientes
        if (pedido.estado !== 'pendiente') return;
        pendientes++;
        const listo = pedido.items.every(item => {
            const prod = inventario.find(p => p.id === item.productoId);
            return prod && prod.cantidad >= item.cantidad;
        });
        if (listo) pedidosListos++;
        else pedidosFaltantes++;
    });

    document.getElementById('dash-listos').textContent = pedidosListos;
    document.getElementById('dash-faltantes').textContent = pedidosFaltantes;

    // Actualizar badge de pedidos pendientes
    const badge = document.getElementById('badge-pedidos');
    if (pendientes > 0) {
        badge.textContent = pendientes;
        badge.classList.remove('oculto');
    } else {
        badge.classList.add('oculto');
    }
}

// ============================================================
//  NAVEGACIÓN TABS
// ============================================================
function cambiarTab(tabActivo, vistaActiva) {
    [tabInventario, tabPedidos, tabHistorial, tabReporte].forEach(t => t.classList.remove('activo'));
    [vistaInventario, vistaPedidos, vistaHistorial, vistaReporteMensual].forEach(v => v.classList.add('oculto'));
    tabActivo.classList.add('activo');
    vistaActiva.classList.remove('oculto');
}

tabInventario.addEventListener('click', () => cambiarTab(tabInventario, vistaInventario));
tabPedidos.addEventListener('click', () => {
    renderizarPedidos();
    actualizarDashboard();
    cambiarTab(tabPedidos, vistaPedidos);
});
tabHistorial.addEventListener('click', () => {
    renderizarHistorial();
    cambiarTab(tabHistorial, vistaHistorial);
});
tabReporte.addEventListener('click', () => {
    renderizarReporteMensual();
    cambiarTab(tabReporte, vistaReporteMensual);
});

// ============================================================
//  INVENTARIO
// ============================================================
// Normaliza texto: minúsculas y sin acentos para búsqueda flexible
function normalizar(texto) {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function renderizarInventario(filtro = '') {
    listaProductos.innerHTML = '';

    const filtroNorm = normalizar(filtro);
    const productosFiltrados = inventario.filter(p =>
        normalizar(p.nombre).includes(filtroNorm)
    );

    if (productosFiltrados.length === 0) {
        listaProductos.innerHTML = `<div class="mensaje-vacio">${filtro ? `Sin resultados para "${filtro}"` : 'No hay productos. Haz clic en "Nuevo Producto".'}</div>`;
        actualizarDashboard();
        return;
    }

    productosFiltrados.forEach(producto => {
        const estaBajo = producto.cantidad <= producto.minimo;
        const card = document.createElement('div');
        card.className = `card ${estaBajo ? 'alerta-stock' : ''}`;
        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${producto.nombre}</div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-editar" onclick="abrirEditar('${producto.id}')" title="Editar">✏️</button>
                    <button class="btn-eliminar" onclick="eliminarProducto('${producto.id}')" title="Eliminar">🗑️</button>
                </div>
            </div>
            <div class="card-stock">${producto.cantidad}</div>
            <div class="card-status">${estaBajo ? `⚠️ Queda poco (Mín: ${producto.minimo})` : ''}</div>
            <div style="text-align:center; font-weight:bold; margin-bottom:10px; color:var(--success-color);">
                ${formatoMoneda(producto.precio)}
            </div>
            <div class="card-actions">
                <button class="btn-salida" onclick="abrirAjuste('${producto.id}', 'salida')">➖ Salida</button>
                <button class="btn-entrada" onclick="abrirAjuste('${producto.id}', 'entrada')">➕ Entrada</button>
            </div>
        `;
        listaProductos.appendChild(card);
    });
    actualizarDashboard();
}

function generarReporte() {
    const listaReporte = document.getElementById('lista-reporte');
    listaReporte.innerHTML = '';
    const faltantes = inventario.filter(p => p.cantidad <= p.minimo);
    if (faltantes.length === 0) {
        listaReporte.innerHTML = '<div class="item-reporte">✅ Todo está bien.</div>';
    } else {
        faltantes.forEach(p => {
            const item = document.createElement('div');
            item.className = 'item-reporte';
            item.innerHTML = `<span>${p.nombre} (Tienes ${p.cantidad})</span><span class="falta">¡Comprar al menos ${p.minimo - p.cantidad + 1}!</span>`;
            listaReporte.appendChild(item);
        });
    }
}

// ============================================================
//  PEDIDOS
// ============================================================
function renderizarPedidos() {
    listaPedidos.innerHTML = '';
    const pendientes  = pedidos.filter(p => p.estado === 'pendiente').reverse();
    const cerrados    = pedidos.filter(p => p.estado !== 'pendiente').reverse();
    const ordenados   = [...pendientes, ...cerrados];

    if (ordenados.length === 0) {
        listaPedidos.innerHTML = '<div class="mensaje-vacio">No hay pedidos registrados.</div>';
        return;
    }

    ordenados.forEach(pedido => {
        const card = document.createElement('div');
        let estadoHtml = '', botonHtml = '', faltantesHtml = '', colorBorde = '';

        if (pedido.estado === 'cancelado') {
            colorBorde = '#94a3b8';
            card.style.opacity = '0.55';
            estadoHtml = `<span style="color:#64748b; font-weight:bold;">❌ Cancelado</span>`;

        } else if (pedido.estado === 'completado') {
            colorBorde = 'var(--success-color)';
            estadoHtml = `<span style="color:var(--success-color); font-weight:bold;">✅ Entregado</span>`;

        } else {
            // Pendiente — evaluar stock
            let listo = true;
            let listaFaltantes = '';
            pedido.items.forEach(item => {
                const prod = inventario.find(p => p.id === item.productoId);
                const stock = prod ? prod.cantidad : 0;
                if (stock < item.cantidad) {
                    listo = false;
                    listaFaltantes += `<li>❌ Faltan ${item.cantidad - stock} de <b>${item.nombre}</b></li>`;
                }
            });

            if (listo) {
                colorBorde = 'var(--primary-color)';
                estadoHtml = `<span style="color:var(--primary-color); font-weight:bold;">📦 Listo para Entregar</span>`;
                botonHtml  = `<button class="btn-primary" onclick="abrirModalEntrega('${pedido.id}')" style="width:100%; margin-top:15px;">🚀 Entregar Pedido</button>`;
            } else {
                colorBorde = 'var(--danger-color)';
                estadoHtml = `<span style="color:var(--danger-color); font-weight:bold;">⚠️ Faltan Materiales</span>`;
                faltantesHtml = `
                    <div style="background:var(--warning-bg); padding:12px; border-radius:8px; margin-bottom:15px; border:1px solid var(--warning-color);">
                        <strong style="color:var(--danger-color); display:block; margin-bottom:6px;">Necesitas comprar/producir:</strong>
                        <ul style="list-style:none; padding:0; color:var(--danger-hover); font-size:0.95rem;">${listaFaltantes}</ul>
                    </div>`;
                botonHtml = `<button class="btn-secondary" style="width:100%; margin-top:15px; opacity:0.6;" disabled>⛔ Sin Stock Suficiente</button>`;
            }

            // Botón cancelar (solo pendientes)
            botonHtml += `<button class="btn-cancelar-pedido" onclick="cancelarPedido('${pedido.id}')">❌ Cancelar Pedido</button>`;
        }

        const entregadorHtml = pedido.entregadoPor
            ? `<div style="margin-top:10px; font-size:0.9rem; color:var(--text-muted);">👤 Entregado por: <strong>${pedido.entregadoPor}</strong></div>`
            : '';

        card.className = 'card-pedido';
        card.style.borderLeftColor = colorBorde;
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
                <h3 style="font-size:1.4rem;">${pedido.cliente}</h3>
                <div>${estadoHtml}</div>
            </div>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:10px;">${pedido.fecha}</p>
            <ul style="list-style:none; padding:0; margin-bottom:15px; font-size:1.1rem; line-height:1.8;">
                ${pedido.items.map(i => `<li>${i.cantidad}x ${i.nombre}</li>`).join('')}
            </ul>
            ${faltantesHtml}
            <div style="font-size:1.3rem; font-weight:bold; text-align:right;">Total: ${formatoMoneda(pedido.total)}</div>
            ${entregadorHtml}
            ${botonHtml}
        `;
        listaPedidos.appendChild(card);
    });
    actualizarDashboard();
}

// ============================================================
//  HISTORIAL
// ============================================================
function renderizarHistorial() {
    tablaHistorial.innerHTML = '';
    if (historial.length === 0) {
        tablaHistorial.innerHTML = '<div class="mensaje-vacio">No hay movimientos registrados aún.</div>';
        return;
    }

    const tabla = document.createElement('table');
    tabla.className = 'tabla-historial';
    tabla.innerHTML = `
        <thead>
            <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Motivo</th>
            </tr>
        </thead>
        <tbody>
            ${historial.map(mov => `
                <tr>
                    <td>${mov.fecha}</td>
                    <td>${mov.producto}</td>
                    <td class="${mov.tipo === 'entrada' ? 'tipo-entrada' : 'tipo-salida'}">
                        ${mov.tipo === 'entrada' ? '➕ Entrada' : '➖ Salida'}
                    </td>
                    <td style="text-align:center; font-weight:bold;">${mov.cantidad}</td>
                    <td style="color:var(--text-muted);">${mov.motivo || '—'}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    tablaHistorial.appendChild(tabla);
}

// ============================================================
//  REPORTE MENSUAL
// ============================================================
function renderizarReporteMensual() {
    const selectMes = document.getElementById('select-mes');
    const contenido = document.getElementById('contenido-reporte-mensual');

    function getMesKey(p) {
        if (p.fechaISO) {
            const d = new Date(p.fechaISO);
            if (!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        }
        return null;
    }

    const mesesUnicos = [...new Set(
        pedidos
            .filter(p => p.estado === 'completado')
            .map(getMesKey)
            .filter(Boolean)
    )].sort().reverse();

    // Si no se pudo parsear, mostrar todos los completados
    const pedidosCompletados = pedidos.filter(p => p.estado === 'completado');

    selectMes.innerHTML = '';
    if (mesesUnicos.length === 0) {
        // Fallback: no hay mes real, mostrar opción única
        const opt = document.createElement('option');
        opt.value = 'todos';
        opt.textContent = 'Todos los Pedidos';
        selectMes.appendChild(opt);
    } else {
        mesesUnicos.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            const [anio, mes] = m.split('-');
            const nombre = new Date(anio, parseInt(mes)-1).toLocaleString('es-MX', { month: 'long', year: 'numeric' });
            opt.textContent = nombre.charAt(0).toUpperCase() + nombre.slice(1);
            selectMes.appendChild(opt);
        });
    }

    function mostrarReporte(filtroMes) {
        const filtrados = pedidosCompletados.filter(p => {
            if (filtroMes === 'todos') return true;
            return getMesKey(p) === filtroMes;
        });

        const totalVentas = filtrados.reduce((s, p) => s + p.total, 0);
        const totalPedidos = filtrados.length;

        // Calcular productos más pedidos
        const conteoProductos = {};
        filtrados.forEach(p => {
            p.items.forEach(item => {
                conteoProductos[item.nombre] = (conteoProductos[item.nombre] || 0) + item.cantidad;
            });
        });
        const productosOrdenados = Object.entries(conteoProductos).sort((a,b) => b[1]-a[1]);

        contenido.innerHTML = `
            <div class="reporte-resumen">
                <div class="reporte-stat">
                    <div class="reporte-stat-label">📦 Pedidos Entregados</div>
                    <div class="reporte-stat-val" style="color:var(--primary-color);">${totalPedidos}</div>
                </div>
                <div class="reporte-stat">
                    <div class="reporte-stat-label">💰 Total Ventas</div>
                    <div class="reporte-stat-val" style="color:var(--success-color);">${formatoMoneda(totalVentas)}</div>
                </div>
                <div class="reporte-stat">
                    <div class="reporte-stat-label">📈 Promedio por Pedido</div>
                    <div class="reporte-stat-val" style="color:var(--warning-color);">${totalPedidos > 0 ? formatoMoneda(totalVentas/totalPedidos) : '$0.00'}</div>
                </div>
            </div>

            <h3 style="margin-bottom:15px; font-size:1.3rem;">Productos más solicitados:</h3>
            <table class="tabla-historial">
                <thead>
                    <tr><th>Producto</th><th style="text-align:right;">Unidades Vendidas</th></tr>
                </thead>
                <tbody>
                    ${productosOrdenados.length > 0
                        ? productosOrdenados.map(([nombre, qty]) => `
                            <tr>
                                <td>${nombre}</td>
                                <td style="text-align:right; font-weight:bold;">${qty}</td>
                            </tr>`).join('')
                        : '<tr><td colspan="2" style="text-align:center; color:var(--text-muted);">Sin datos este mes.</td></tr>'
                    }
                </tbody>
            </table>
        `;
    }

    mostrarReporte(selectMes.value);
    selectMes.onchange = () => mostrarReporte(selectMes.value);

    // Exportar reporte
    document.getElementById('btn-exportar-reporte').onclick = () => {
        const filtroMes = selectMes.value;
        const filtrados = pedidosCompletados.filter(p => {
            if (filtroMes === 'todos') return true;
            try {
                const d = new Date(p.fecha);
                if (!isNaN(d)) {
                    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                    return key === filtroMes;
                }
            } catch(e) {}
            return true;
        });
        exportarCSV(
            filtrados.map(p => ({
                cliente: p.cliente,
                fecha: p.fecha,
                entregadoPor: p.entregadoPor || '',
                total: p.total,
                productos: p.items.map(i => `${i.cantidad}x ${i.nombre}`).join(' | ')
            })),
            [
                { key: 'cliente', label: 'Cliente' },
                { key: 'fecha', label: 'Fecha' },
                { key: 'entregadoPor', label: 'Entregado Por' },
                { key: 'total', label: 'Total ($)' },
                { key: 'productos', label: 'Productos' }
            ],
            'reporte_mensual_' + filtroMes
        );
    };
}

// ============================================================
//  EVENTOS DE FORMULARIOS
// ============================================================
function configurarEventosAdmin() {
    // Ver/ocultar contraseña
    document.getElementById('btn-ver-password').addEventListener('click', () => {
        const tipo = inputPassword.type === 'password' ? 'text' : 'password';
        inputPassword.type = tipo;
        document.getElementById('btn-ver-password').textContent = tipo === 'password' ? '👁️' : '🙈';
    });

    // Buscador de inventario (filtrado en tiempo real)
    document.getElementById('buscador-inventario').addEventListener('input', (e) => {
        renderizarInventario(e.target.value);
    });

    // Nuevo producto
    document.getElementById('btn-nuevo-producto').addEventListener('click', () => {
        productoEditandoId = null;
        document.getElementById('titulo-modal-nuevo').textContent = 'Agregar Nuevo Producto';
        formNuevoProducto.reset();
        modalNuevo.classList.remove('oculto');
        document.getElementById('nombre-prod').focus();
    });

    document.getElementById('btn-cancelar-nuevo').addEventListener('click', () => {
        modalNuevo.classList.add('oculto');
    });

    formNuevoProducto.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre   = document.getElementById('nombre-prod').value;
        const cantidad = parseInt(document.getElementById('cantidad-prod').value) || 0;
        const minimo   = parseInt(document.getElementById('minimo-prod').value) || 1;
        const precio   = parseFloat(document.getElementById('precio-prod').value) || 0;
        try {
            if (productoEditandoId !== null) {
                await actualizarProducto(productoEditandoId, { nombre, cantidad, minimo, precio });
            } else {
                await guardarProducto({ nombre, cantidad, minimo, precio });
            }
            modalNuevo.classList.add('oculto');
            productoEditandoId = null;
        } catch(err) { alert('Error al guardar: ' + err.message); }
    });

    // Reporte
    document.getElementById('btn-reporte').addEventListener('click', () => {
        generarReporte();
        modalReporte.classList.remove('oculto');
    });
    document.getElementById('btn-cerrar-reporte').addEventListener('click', () => modalReporte.classList.add('oculto'));

    // Ajuste stock
    document.getElementById('btn-cancelar-ajuste').addEventListener('click', () => modalStock.classList.add('oculto'));
    document.getElementById('btn-confirmar-ajuste').addEventListener('click', async () => {
        const cantidad = parseInt(document.getElementById('cantidad-ajuste').value);
        const motivo   = document.getElementById('motivo-ajuste').value;
        if (isNaN(cantidad) || cantidad <= 0) return alert('Ingresa un número válido.');
        const prod = inventario.find(p => p.id === productoSeleccionadoId);
        if (!prod) return;
        const nueva = tipoAjuste === 'entrada' ? prod.cantidad + cantidad : prod.cantidad - cantidad;
        if (nueva < 0) return alert('Stock insuficiente.');
        try {
            await actualizarProducto(productoSeleccionadoId, { cantidad: nueva });
            await registrarMovimiento(prod.nombre, tipoAjuste, cantidad, motivo);
            modalStock.classList.add('oculto');
        } catch(err) { alert('Error: ' + err.message); }
    });

    // Entrega
    document.getElementById('btn-cancelar-entrega').addEventListener('click', () => {
        modalEntrega.classList.add('oculto');
        pedidoParaEntregar = null;
    });

    document.getElementById('btn-confirmar-entrega').addEventListener('click', async () => {
        const entregador = document.getElementById('nombre-entregador').value.trim();
        if (!entregador) {
            document.getElementById('nombre-entregador').focus();
            return alert('Por favor, escribe el nombre de quien entrega.');
        }
        await completarEntrega(pedidoParaEntregar, entregador);
        modalEntrega.classList.add('oculto');
        document.getElementById('nombre-entregador').value = '';
        pedidoParaEntregar = null;
    });

    // Exportar pedidos
    document.getElementById('btn-exportar-pedidos').addEventListener('click', () => {
        exportarCSV(
            pedidos.map(p => ({
                cliente: p.cliente,
                fecha: p.fecha,
                estado: p.estado,
                entregadoPor: p.entregadoPor || '',
                total: p.total,
                productos: p.items.map(i => `${i.cantidad}x ${i.nombre}`).join(' | ')
            })),
            [
                { key: 'cliente', label: 'Cliente' },
                { key: 'fecha', label: 'Fecha' },
                { key: 'estado', label: 'Estado' },
                { key: 'entregadoPor', label: 'Entregado Por' },
                { key: 'total', label: 'Total ($)' },
                { key: 'productos', label: 'Productos' }
            ],
            'pedidos_' + new Date().toLocaleDateString('es-MX').replace(/\//g, '-')
        );
    });

    // Exportar historial
    document.getElementById('btn-exportar-historial').addEventListener('click', () => {
        exportarCSV(
            historial,
            [
                { key: 'fecha', label: 'Fecha' },
                { key: 'producto', label: 'Producto' },
                { key: 'tipo', label: 'Tipo' },
                { key: 'cantidad', label: 'Cantidad' },
                { key: 'motivo', label: 'Motivo' }
            ],
            'historial_' + new Date().toLocaleDateString('es-MX').replace(/\//g, '-')
        );
    });
}

// ============================================================
//  FUNCIONES GLOBALES (llamadas desde onclick del HTML)
// ============================================================
// Eliminar producto
window.eliminarProducto = async function(id) {
    const producto = inventario.find(p => p.id === id);
    if (!producto) return;
    if (!confirm(`¿Seguro que quieres eliminar "${producto.nombre}"?\n\nEsta acción no se puede deshacer.`)) return;
    try { await eliminarProductoDb(id); } catch(err) { alert('Error: ' + err.message); }
};

// Cancelar pedido
window.cancelarPedido = async function(pedidoId) {
    if (!confirm('¿Seguro que quieres cancelar este pedido?\n\nEl inventario no se verá afectado.')) return;
    try { await actualizarPedido(pedidoId, { estado: 'cancelado' }); } catch(err) { alert('Error: ' + err.message); }
};

window.abrirAjuste = function(id, tipo) {
    const producto = inventario.find(p => p.id === id);
    if (!producto) return;
    productoSeleccionadoId = id;
    tipoAjuste = tipo;
    document.getElementById('nombre-producto-ajuste').textContent = producto.nombre;
    document.getElementById('titulo-ajuste').textContent = tipo === 'entrada' ? '➕ Entrada de Stock' : '➖ Salida de Stock';
    document.getElementById('label-ajuste').textContent = tipo === 'entrada' ? '¿Cuántos vas a sumar?' : '¿Cuántos vas a quitar?';
    document.getElementById('cantidad-ajuste').value = '1';
    document.getElementById('motivo-ajuste').value = '';
    modalStock.classList.remove('oculto');
    document.getElementById('cantidad-ajuste').focus();
};

window.abrirEditar = function(id) {
    const producto = inventario.find(p => p.id === id);
    if (!producto) return;
    productoEditandoId = id;
    document.getElementById('titulo-modal-nuevo').textContent = 'Editar Producto';
    document.getElementById('nombre-prod').value = producto.nombre;
    document.getElementById('cantidad-prod').value = producto.cantidad;
    document.getElementById('minimo-prod').value = producto.minimo;
    document.getElementById('precio-prod').value = producto.precio || 0;
    modalNuevo.classList.remove('oculto');
};

window.abrirModalEntrega = function(pedidoId) {
    pedidoParaEntregar = pedidoId;
    document.getElementById('nombre-entregador').value = '';
    modalEntrega.classList.remove('oculto');
    document.getElementById('nombre-entregador').focus();
};

async function completarEntrega(pedidoId, entregador) {
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (!pedido) return;

    let faltanMsg = '';
    pedido.items.forEach(item => {
        const prod = inventario.find(p => p.id === item.productoId);
        if (!prod || prod.cantidad < item.cantidad)
            faltanMsg += `• Faltan ${item.cantidad - (prod ? prod.cantidad : 0)} de ${item.nombre}\n`;
    });
    if (faltanMsg) { alert('No se puede entregar. Faltan materiales:\n\n' + faltanMsg); return; }

    try {
        for (const item of pedido.items) {
            const prod = inventario.find(p => p.id === item.productoId);
            await actualizarProducto(item.productoId, { cantidad: prod.cantidad - item.cantidad });
            await registrarMovimiento(item.nombre, 'salida', item.cantidad, `Pedido de ${pedido.cliente}`);
        }
        await actualizarPedido(pedidoId, { estado: 'completado', entregadoPor: entregador });
        alert(`✅ Pedido entregado correctamente.\n👤 Entregado por: ${entregador}`);
    } catch(err) { alert('Error al completar entrega: ' + err.message); }
}

// ============================================================
//  NOTIFICACIONES DE NUEVO PEDIDO
// ============================================================
function mostrarToast(mensaje) {
    let toast = document.getElementById('toast-notif');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notif';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `🔔 ${mensaje}`;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 5000);
}

// ============================================================
//  INICIO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    configurarEventosAdmin();
    verificarSesion();
});
