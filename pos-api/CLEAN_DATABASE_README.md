# 🧹 Scripts de Limpieza de Base de Datos

Este directorio contiene scripts para limpiar la base de datos del sistema POS, eliminando solo los datos de prueba pero preservando la estructura y datos esenciales del sistema.

## 📋 Scripts Disponibles

### 1. `clean-database.ts` - Limpieza Directa
```bash
pnpm run clean:db
```
- **Uso:** Limpieza rápida sin confirmación
- **Elimina:** Ventas, productos, clientes, stock, compras, proveedores, logs
- **Preserva:** Usuarios, roles, unidades, almacenes

### 2. `clean-database-safe.ts` - Limpieza Segura (Recomendado)
```bash
pnpm run clean:db:safe
```
- **Uso:** Limpieza con confirmación previa
- **Muestra:** Resumen de datos a eliminar
- **Requiere:** Confirmación del usuario
- **Elimina:** Ventas, productos, clientes, stock, compras, proveedores, logs
- **Preserva:** Usuarios, roles, unidades, almacenes

## 🔒 Datos que se Preservan

- ✅ **Usuarios y roles** (admin, vendedores)
- ✅ **Unidades de medida** (UND, DOC, CAJ, KG, etc.)
- ✅ **Almacén principal**
- ✅ **Estructura de la base de datos**
- ✅ **Configuraciones del sistema**

## 🗑️ Datos que se Eliminan

- ❌ **Ventas registradas**
- ❌ **Productos de prueba**
- ❌ **Clientes de prueba**
- ❌ **Movimientos de stock**
- ❌ **Stock actual**
- ❌ **Compras registradas**
- ❌ **Proveedores**
- ❌ **Logs de auditoría**

## 📝 Proceso Recomendado

### Para Limpiar la Base de Datos:
```bash
# 1. Limpiar base de datos (modo seguro)
pnpm run clean:db:safe

# 2. Crear datos básicos del sistema
pnpm run seed

# 3. Crear productos de prueba
pnpm run seed:products
```

### Para Verificar el Estado:
```bash
# Verificar roles de admin
ts-node check-admin-roles.ts

# Debuggear resumen
ts-node debug-summary-final.ts
```

## ⚠️ Advertencias Importantes

1. **Backup:** Siempre haz backup antes de limpiar en producción
2. **Confirmación:** Usa `clean:db:safe` para evitar eliminaciones accidentales
3. **Datos Esenciales:** Los scripts preservan usuarios y configuración del sistema
4. **Re-seed:** Después de limpiar, ejecuta los scripts de seed para restaurar datos de prueba

## 🚀 Uso para Cliente

Cuando entregues el sistema al cliente:

1. **Limpiar datos de prueba:**
   ```bash
   pnpm run clean:db:safe
   ```

2. **Crear datos básicos:**
   ```bash
   pnpm run seed
   ```

3. **Verificar que todo funcione:**
   - Login con admin: `adminSk` / `SurtidoraK2025!`
   - Login con vendedor: `brayan` / `BrayanL2025!`

## 📞 Soporte

Si tienes problemas con los scripts, verifica:
- ✅ Variables de entorno configuradas
- ✅ Base de datos PostgreSQL accesible
- ✅ Dependencias instaladas (`pnpm install`)




