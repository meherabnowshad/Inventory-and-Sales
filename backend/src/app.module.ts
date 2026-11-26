import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/guards/auth.guard';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { RolesGuard } from './auth/guards/roles.guard';
import { UsersModule } from './users/users.module';
import { SuppliersModule } from './suppliers/suppliers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    InventoryModule,
    SalesModule,
    CategoriesModule,
    ProductsModule,
    UsersModule,
    SuppliersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
