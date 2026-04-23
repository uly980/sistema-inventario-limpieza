// --- Datos y LocalStorage ---
const LOCAL_STORAGE_KEY = 'inventario_limpieza_v2';
let inventario = [];

function cargarDatos() {
    const datosGuardados = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (datosGuardados) {
        inventario = JSON.parse(datosGuardados);
    } else {
        // Datos de ejemplo para la primera vez
        inventario = [
            { id: 1, nombre: 'Cloro (Garrafas)', cantidad: 15, minimo: 5 },
            { id: 2, nombre: 'Escobas', cantidad: 3, minimo: 5 },
            { id: 3, nombre: 'Detergente Líquido (Garrafas)', cantidad: 20, minimo: 10 }
        ];
        guardarDatos();
    }
}

function guardarDatos() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(inventario));
}

// --- Elementos del DOM ---
const listaProductos = document.getElementById('lista-productos');

// Modales
const modalNuevo = document.getElementById('modal-nuevo');
const modalStock = document.getElementById('modal-stock');
const modalReporte = document.getElementById('modal-reporte');

// Botones de abrir modales
const btnNuevoProducto = document.getElementById('btn-nuevo-producto');
const btnReporte = document.getElementById('btn-reporte');

// Botones de cerrar modales
const btnCancelarNuevo = document.getElementById('btn-cancelar-nuevo');
const btnCancelarAjuste = document.getElementById('btn-cancelar-ajuste');
const btnCerrarReporte = document.getElementById('btn-cerrar-reporte');

// Formularios
const formNuevoProducto = document.getElementById('form-nuevo-producto');

// Variables para el estado temporal
let productoSeleccionadoId = null;
let tipoAjuste = null; // 'entrada' o 'salida'
let productoEditandoId = null;

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    cargarDatos();
    renderizarInventario();
    configurarEventos();
});

// --- Funciones de Renderizado ---
function renderizarInventario() {
    listaProductos.innerHTML = '';
    
    if (inventario.length === 0) {
        listaProductos.innerHTML = '<div class="mensaje-vacio">No hay productos. Haz clic en "Nuevo Producto" para empezar.</div>';
        return;
    }

    inventario.forEach(producto => {
        const estaBajo = producto.cantidad <= producto.minimo;
        
        const card = document.createElement('div');
        card.className = `card ${estaBajo ? 'alerta-stock' : ''}`;
        
        let statusHtml = '';
        if (estaBajo) {
            statusHtml = `⚠️ Queda poco (Mínimo: ${producto.minimo})`;
        }

        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${producto.nombre}</div>
                <button class="btn-editar" onclick="abrirEditar(${producto.id})" title="Editar Producto">✏️</button>
            </div>
            <div class="card-stock">${producto.cantidad}</div>
            <div class="card-status">${statusHtml}</div>
            <div class="card-actions">
                <button class="btn-salida" onclick="abrirAjuste(${producto.id}, 'salida')">➖ Salida</button>
                <button class="btn-entrada" onclick="abrirAjuste(${producto.id}, 'entrada')">➕ Entrada</button>
            </div>
        `;
        
        listaProductos.appendChild(card);
    });
}

function generarReporte() {
    const listaReporte = document.getElementById('lista-reporte');
    listaReporte.innerHTML = '';

    const faltantes = inventario.filter(p => p.cantidad <= p.minimo);

    if (faltantes.length === 0) {
        listaReporte.innerHTML = '<div class="item-reporte">✅ Todo está bien. No hay productos que necesiten reabastecimiento urgente.</div>';
    } else {
        faltantes.forEach(p => {
            const cantidadFaltante = p.minimo - p.cantidad + 1; // Sugerencia de compra para superar el mínimo
            const item = document.createElement('div');
            item.className = 'item-reporte';
            item.innerHTML = `
                <span>${p.nombre} (Tienes ${p.cantidad})</span>
                <span class="falta">¡Faltan o comprar al menos ${cantidadFaltante}!</span>
            `;
            listaReporte.appendChild(item);
        });
    }
}

// --- Lógica de la Aplicación ---
function configurarEventos() {
    // Abrir Nuevo Producto
    btnNuevoProducto.addEventListener('click', () => {
        productoEditandoId = null;
        document.getElementById('titulo-modal-nuevo').textContent = 'Agregar Nuevo Producto';
        formNuevoProducto.reset();
        modalNuevo.classList.remove('oculto');
        document.getElementById('nombre-prod').focus();
    });

    // Cerrar Nuevo Producto/Editar
    btnCancelarNuevo.addEventListener('click', () => {
        modalNuevo.classList.add('oculto');
        formNuevoProducto.reset();
        productoEditandoId = null;
    });

    // Guardar Nuevo Producto o Guardar Edición
    formNuevoProducto.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const nombre = document.getElementById('nombre-prod').value;
        const cantidad = parseInt(document.getElementById('cantidad-prod').value) || 0;
        const minimo = parseInt(document.getElementById('minimo-prod').value) || 1;

        if (productoEditandoId !== null) {
            // Modo Edición
            const index = inventario.findIndex(p => p.id === productoEditandoId);
            if (index !== -1) {
                inventario[index].nombre = nombre;
                inventario[index].cantidad = cantidad;
                inventario[index].minimo = minimo;
            }
        } else {
            // Modo Nuevo
            const nuevoId = inventario.length > 0 ? Math.max(...inventario.map(p => p.id)) + 1 : 1;
            inventario.push({
                id: nuevoId,
                nombre: nombre,
                cantidad: cantidad,
                minimo: minimo
            });
        }

        guardarDatos();
        renderizarInventario();
        modalNuevo.classList.add('oculto');
        formNuevoProducto.reset();
        productoEditandoId = null;
    });

    // Abrir Reporte
    btnReporte.addEventListener('click', () => {
        generarReporte();
        modalReporte.classList.remove('oculto');
    });

    // Cerrar Reporte
    btnCerrarReporte.addEventListener('click', () => {
        modalReporte.classList.add('oculto');
    });

    // Cerrar Ajuste de Stock
    btnCancelarAjuste.addEventListener('click', () => {
        modalStock.classList.add('oculto');
        productoSeleccionadoId = null;
        tipoAjuste = null;
    });

    // Confirmar Ajuste de Stock
    document.getElementById('btn-confirmar-ajuste').addEventListener('click', () => {
        const inputAjuste = document.getElementById('cantidad-ajuste');
        const cantidadAjuste = parseInt(inputAjuste.value);

        if (isNaN(cantidadAjuste) || cantidadAjuste <= 0) {
            alert("Por favor, ingresa un número válido mayor a 0.");
            return;
        }

        const index = inventario.findIndex(p => p.id === productoSeleccionadoId);
        if (index !== -1) {
            if (tipoAjuste === 'entrada') {
                inventario[index].cantidad += cantidadAjuste;
            } else if (tipoAjuste === 'salida') {
                if (inventario[index].cantidad - cantidadAjuste < 0) {
                    alert("No puedes sacar más cantidad de la que tienes en stock.");
                    return;
                }
                inventario[index].cantidad -= cantidadAjuste;
            }
            guardarDatos();
            renderizarInventario();
        }

        modalStock.classList.add('oculto');
        productoSeleccionadoId = null;
        tipoAjuste = null;
    });
}

// Función expuesta globalmente para los botones onclick del HTML
window.abrirAjuste = function(id, tipo) {
    const producto = inventario.find(p => p.id === id);
    if (!producto) return;

    productoSeleccionadoId = id;
    tipoAjuste = tipo;

    document.getElementById('nombre-producto-ajuste').textContent = producto.nombre;
    
    const titulo = document.getElementById('titulo-ajuste');
    const label = document.getElementById('label-ajuste');
    const input = document.getElementById('cantidad-ajuste');

    if (tipo === 'entrada') {
        titulo.textContent = '➕ Entrada de Stock';
        label.textContent = '¿Cuántos vas a sumar al inventario?';
    } else {
        titulo.textContent = '➖ Salida de Stock';
        label.textContent = '¿Cuántos vas a quitar del inventario?';
    }

    input.value = '1';
    modalStock.classList.remove('oculto');
    input.focus();
    input.select();
};

window.abrirEditar = function(id) {
    const producto = inventario.find(p => p.id === id);
    if (!producto) return;

    productoEditandoId = id;
    
    // Cambiar título del modal
    document.getElementById('titulo-modal-nuevo').textContent = 'Editar Producto';

    // Rellenar formulario
    document.getElementById('nombre-prod').value = producto.nombre;
    document.getElementById('cantidad-prod').value = producto.cantidad;
    document.getElementById('minimo-prod').value = producto.minimo;

    // Mostrar modal
    modalNuevo.classList.remove('oculto');
    document.getElementById('nombre-prod').focus();
};
