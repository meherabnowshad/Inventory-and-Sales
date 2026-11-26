import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AuthUserResponse } from '../auth/auth.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/constants/roles';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { ListSuppliersQueryDto } from './dto/list-suppliers-query.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Roles(UserRole.Administrator, UserRole.StoreStaff)
  create(@Body() dto: CreateSupplierDto, @Req() req: { user: AuthUserResponse }) {
    return this.suppliersService.create(dto, BigInt(req.user.id));
  }

  @Get()
  @Roles(UserRole.Administrator, UserRole.StoreStaff)
  findAll(@Query() query: ListSuppliersQueryDto) {
    return this.suppliersService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.Administrator, UserRole.StoreStaff)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.Administrator, UserRole.StoreStaff)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }
}
