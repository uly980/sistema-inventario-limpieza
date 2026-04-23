// =============================================
// FIREBASE - CONFIGURACIÓN E INICIALIZACIÓN
// =============================================
const firebaseConfig = {
    apiKey: "AIzaSyBN148S3FSmNfCuqYJNfOQPXvM4FoSJnK0",
    authDomain: "inventario-limpieza-bfea1.firebaseapp.com",
    projectId: "inventario-limpieza-bfea1",
    storageBucket: "inventario-limpieza-bfea1.firebasestorage.app",
    messagingSenderId: "377892432282",
    appId: "1:377892432282:web:485dacf8d64167c8437223"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// =============================================
// ARRAYS EN MEMORIA (se sincronizan con Firestore via onSnapshot)
// =============================================
let inventario = [];
let pedidos    = [];
let historial  = [];

// =============================================
// ESCRITURA A FIRESTORE
// =============================================

/** Crea o sobreescribe un producto. Si no tiene id, lo crea y asigna el id generado. */
async function guardarProducto(producto) {
    if (producto.id) {
        const { id, ...datos } = producto;
        await db.collection('inventario').doc(id).set(datos);
    } else {
        const ref = await db.collection('inventario').add(producto);
        producto.id = ref.id;
    }
}

/** Actualiza campos específicos de un producto existente. */
async function actualizarProducto(id, datos) {
    await db.collection('inventario').doc(id).update(datos);
}

/** Elimina un producto por su id. */
async function eliminarProductoDb(id) {
    await db.collection('inventario').doc(id).delete();
}

/** Crea un pedido nuevo en Firestore. Devuelve el id generado. */
async function crearPedido(pedido) {
    const ref = await db.collection('pedidos').add(pedido);
    return ref.id;
}

/** Actualiza campos de un pedido existente. */
async function actualizarPedido(id, datos) {
    await db.collection('pedidos').doc(id).update(datos);
}

/** Registra un movimiento en el historial. */
async function registrarMovimiento(productoNombre, tipo, cantidad, motivo) {
    await db.collection('historial').add({
        producto: productoNombre,
        tipo:     tipo,
        cantidad: cantidad,
        motivo:   motivo || '',
        fecha:    new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
    });
}

// =============================================
// UTILIDADES (sin cambios respecto a la versión anterior)
// =============================================
function formatoMoneda(valor) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valor);
}

function exportarCSV(datos, columnas, nombreArchivo) {
    const encabezado = columnas.map(c => c.label).join(',');
    const filas = datos.map(fila =>
        columnas.map(c => {
            const val = fila[c.key] ?? '';
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',')
    );
    const csv  = [encabezado, ...filas].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = nombreArchivo + '.csv';
    a.click();
    URL.revokeObjectURL(url);
}
