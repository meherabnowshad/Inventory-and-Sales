import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { AuthUserResponse } from '../auth/auth.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/constants/roles';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

// Routes under /api/products (IMS-10, FR-PRD-01 to FR-PRD-05). No DELETE route on purpose (BR-14)
// Read = all roles, write = Administrator + Store Staff
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post() // 201 by default; req.user is set by the global AuthGuard
  @Roles(UserRole.Administrator, UserRole.StoreStaff)
  create(@Body() dto: CreateProductDto, @Req() req: { user: AuthUserResponse }) {
    return this.productsService.create(dto, BigInt(req.user.id));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.Administrator, UserRole.StoreStaff)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
    @Req() req: { user: AuthUserResponse },
  ) {
    return this.productsService.update(id, dto, BigInt(req.user.id));
  }
}
