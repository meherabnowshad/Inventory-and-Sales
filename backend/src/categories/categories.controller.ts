import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AuthUserResponse } from '../auth/auth.service';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/constants/roles';

// Routes under /api/categories (FR-CAT-01 to FR-CAT-04)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post() // 201 by default; req.user is set by the global AuthGuard
  @Roles(UserRole.Administrator, UserRole.StoreStaff)
  create(@Body() dto: CreateCategoryDto, @Req() req: { user: AuthUserResponse }) {
    return this.categoriesService.create(dto, BigInt(req.user.id));
  }

  @Get() // ?status=active|inactive|all, validated by ListCategoriesQueryDto
  findAll(@Query() query: ListCategoriesQueryDto) {
    return this.categoriesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.Administrator, UserRole.StoreStaff)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  // IMS-08.3: 204 when deleted, 404 when missing, 409 CATEGORY_IN_USE when any product uses it
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.Administrator, UserRole.StoreStaff)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.remove(id);
  }
}
