import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard],
  exports: [AuthService, AuthGuard, RolesGuard],
})
export class AuthModule {}
