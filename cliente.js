// =============================================
// ESTADO DEL CARRITO
// =============================================
let carrito = [];

// =============================================
// ELEMENTOS DEL DOM
// =============================================
const listaProductos       = document.getElementById('lista-productos');
const carritoItemsContainer = document.getElementById('carrito-items');
const carritoTotalEl       = document.getElementById('carrito-total');
const inputNombre          = document.getElementById('nombre-cliente');
const btnEnviar            = document.getElementById('btn-enviar-pedido');

// =============================================
// INICIALIZACIÓN — escucha inventario en tiempo real
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    // Escuchar cambios en el inventario de Firebase en tiempo real
    db.collection('inventario').onSnapshot(snapshot => {
        inventario = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filtro = document.getElementById('buscador-cliente').value;
        renderizarProductos(filtro);
    }, error => {
        console.error('Error al cargar inventario:', error);
        listaProductos.innerHTML = '<div class="mensaje-vacio">Error al conectar con el servidor. Recarga la página.</div>';
    });

    renderizarCarrito();
    configurarEventos();

    // Buscador en tiempo real
    document.getElementById('buscador-cliente').addEventListener('input', e => {
        renderizarProductos(e.target.value);
    });
});

// =============================================
// RENDERIZADO DE PRODUCTOS
// =============================================
function normalizar(texto) {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function renderizarProductos(filtro = '') {
    listaProductos.innerHTML = '';
    const filtroNorm = normalizar(filtro);
    const lista = inventario.filter(p => normalizar(p.nombre).includes(filtroNorm));

    if (lista.length === 0) {
        listaProductos.innerHTML = `<div class="mensaje-vacio">${filtro ? `Sin resultados para "${filtro}"` : 'No hay productos disponibles por el momento.'}</div>`;
        return;
    }

    lista.forEach(producto => {

        const card = document.createElement('div');
        card.className = 'card';

        const itemCarrito  = carrito.find(item => item.productoId === producto.id);
        const cantidadActual = itemCarrito ? itemCarrito.cantidad : 0;

        card.innerHTML = `
            <div class="card-header" style="justify-content: center;">
                <div class="card-title" style="text-align: center;">${producto.nombre}</div>
            </div>
            <div style="text-align: center; font-size: 1.8rem; font-weight: bold; color: var(--success-color); margin: 10px 0;">
                ${formatoMoneda(producto.precio)}
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
                <label style="font-weight: bold; font-size: 1.1rem; text-align: center;">¿Cuántos quieres?</label>
                <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                    <button class="btn-cancelar" onclick="cambiarCantidadCarrito('${producto.id}', -1)" style="padding: 10px 20px; font-size: 1.4rem;">➖</button>
                    <input
                        type="number"
                        id="qty-${producto.id}"
                        value="${cantidadActual}"
                        min="0"
                        style="width: 80px; text-align: center; font-size: 1.5rem; font-weight: bold; padding: 8px; border: 2px solid var(--border-color); border-radius: 10px; outline: none;"
                        onchange="establecerCantidadCarrito('${producto.id}', this.value)"
                        onfocus="this.select()"
                    >
                    <button class="btn-entrada" onclick="cambiarCantidadCarrito('${producto.id}', 1)" style="padding: 10px 20px; font-size: 1.4rem;">➕</button>
                </div>
            </div>
        `;
        listaProductos.appendChild(card);
    });
}

// =============================================
// CARRITO — FUNCIONES GLOBALES (usadas desde onclick)
// =============================================
window.cambiarCantidadCarrito = function(productoId, cambio) {
    const producto = inventario.find(p => p.id === productoId);
    if (!producto) return;

    const item = carrito.find(i => i.productoId === productoId);
    let nuevaCantidad = (item ? item.cantidad : 0) + cambio;
    if (nuevaCantidad < 0) nuevaCantidad = 0;

    _actualizarCarrito(producto, nuevaCantidad);

    const input = document.getElementById(`qty-${productoId}`);
    if (input) input.value = nuevaCantidad;
};

window.establecerCantidadCarrito = function(productoId, valor) {
    const producto = inventario.find(p => p.id === productoId);
    if (!producto) return;

    let nuevaCantidad = parseInt(valor);
    if (isNaN(nuevaCantidad) || nuevaCantidad < 0) nuevaCantidad = 0;

    _actualizarCarrito(producto, nuevaCantidad);

    const input = document.getElementById(`qty-${productoId}`);
    if (input) input.value = nuevaCantidad;
};

function _actualizarCarrito(producto, nuevaCantidad) {
    let item = carrito.find(i => i.productoId === producto.id);

    if (nuevaCantidad === 0) {
        carrito = carrito.filter(i => i.productoId !== producto.id);
    } else if (item) {
        item.cantidad = nuevaCantidad;
    } else {
        carrito.push({
            productoId: producto.id,
            nombre:     producto.nombre,
            precio:     producto.precio,
            cantidad:   nuevaCantidad
        });
    }
    renderizarCarrito();
}

// =============================================
// RENDERIZADO DEL CARRITO
// =============================================
function renderizarCarrito() {
    carritoItemsContainer.innerHTML = '';
    let total = 0;

    if (carrito.length === 0) {
        carritoItemsContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center;">Agrega productos usando los botones ➕...</div>';
    } else {
        carrito.forEach(item => {
            const subtotal = item.cantidad * item.precio;
            total += subtotal;
            const div = document.createElement('div');
            div.className = 'carrito-item';
            div.innerHTML = `
                <span>${item.cantidad}x <b>${item.nombre}</b></span>
                <span>${formatoMoneda(subtotal)}</span>
            `;
            carritoItemsContainer.appendChild(div);
        });
    }

    carritoTotalEl.textContent = formatoMoneda(total);
}

// =============================================
// ENVÍO DEL PEDIDO A FIREBASE
// =============================================
function configurarEventos() {
    btnEnviar.addEventListener('click', async () => {
        const cliente = inputNombre.value.trim();

        if (carrito.length === 0) {
            alert('No has agregado ningún producto a tu pedido.');
            return;
        }
        if (cliente === '') {
            alert('Por favor, ingresa tu nombre para saber de quién es el pedido.');
            inputNombre.focus();
            return;
        }

        // Deshabilitar botón para evitar doble envío
        btnEnviar.disabled = true;
        btnEnviar.textContent = '⏳ Enviando...';

        try {
            const total = carrito.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
            const ahora  = new Date();
            const fecha  = ahora.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
            const fechaISO = ahora.toISOString();

            await crearPedido({
                cliente:  cliente,
                fecha:    fecha,
                fechaISO: fechaISO,
                items:    [...carrito],
                total:    total,
                estado:   'pendiente'
            });

            alert('¡Pedido enviado con éxito!\n\nEl administrador revisará el inventario para entregarlo.');

            // Limpiar carrito
            carrito = [];
            inputNombre.value = '';
            renderizarCarrito();
            renderizarProductos();

        } catch (error) {
            console.error('Error al enviar pedido:', error);
            alert('Hubo un error al enviar tu pedido. Por favor intenta de nuevo.');
        } finally {
            btnEnviar.disabled = false;
            btnEnviar.textContent = '🚀 Enviar Pedido';
        }
    });
}
