import { Controller, Get } from '@nestjs/common';
import { SalesService } from './sales.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/constants/roles';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @Roles(UserRole.Administrator, UserRole.SalesStaff)
  async getSales() {
    return this.salesService.getSales();
  }
}
