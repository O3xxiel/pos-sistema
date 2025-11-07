// pos-api/src/reports/reports.service.ts - getDailyReport function change

```diff
- const topProducts = Array.from(productSales.values())
-   .sort((a, b) => b.amount - a.amount)
-   .slice(0, 10);
+ const topProducts = Array.from(productSales.values())
+   .sort((a, b) => b.quantity - a.quantity); // Ordenar por cantidad y retornar todos
```

Modificación para hacer que el reporte diario muestre todos los productos vendidos ordenados por cantidad, igual que el resumen diario.

No hay impacto en el frontend ya que el campo sigue llamándose `topProducts` aunque ahora contenga todos los productos.

Los cambios son seguros porque:
1. No modifica la estructura de los datos
2. El frontend ya maneja este formato
3. Solo cambia el número de productos devueltos