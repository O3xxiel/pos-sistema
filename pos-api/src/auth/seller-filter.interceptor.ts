import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class SellerFilterInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user: { id: number; username: string; roles: string[] } = request.user;

    return next.handle().pipe(
      map((data) => {
        // Si el usuario es vendedor, filtrar solo sus ventas
        if (user && user.roles && user.roles.includes('SELLER')) {
          return this.filterSellerData(data, user.id);
        }

        // Si es admin, devolver todos los datos
        return data;
      }),
    );
  }

  private filterSellerData(data: unknown, sellerId: number): unknown {
    if (Array.isArray(data)) {
      // Si es un array de ventas, filtrar por sellerId
      return data.filter((item: { sellerId: number }) => item.sellerId === sellerId);
    }

    if (data && typeof data === 'object') {
      // Si es un objeto con ventas, filtrar el array
      if ('sales' in data && Array.isArray(data.sales)) {
        const salesData = data as { sales: { sellerId: number }[] };
        return {
          ...data,
          sales: salesData.sales.filter((sale) => sale.sellerId === sellerId),
        };
      }

      // Si es una venta individual, verificar que pertenezca al vendedor
      if ('sellerId' in data) {
        const sellerData = data as { sellerId: number };
        if (sellerData.sellerId !== sellerId) {
          return null; // No permitir acceso a ventas de otros vendedores
        }
      }
    }

    return data;
  }
}
