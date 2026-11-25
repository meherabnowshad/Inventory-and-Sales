import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { AuthUserResponse } from '../auth/auth.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

// Routes under /api/products (IMS-10, FR-PRD-01 to FR-PRD-05). No DELETE route on purpose (BR-14)
// TODO(IMS-07): add role guard. Read = all roles, write = Administrator + Store Staff
// TODO: audit row for a price change (FR-AUD-01), after IMS-07 and the BA confirm; GET list if the BA wants it in IMS-10 (search is IMS-12)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post() // 201 by default; req.user is set by the global AuthGuard
  create(@Body() dto: CreateProductDto, @Req() req: { user: AuthUserResponse }) {
    return this.productsService.create(dto, BigInt(req.user.id));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }
}
