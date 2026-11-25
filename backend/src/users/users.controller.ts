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
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.Administrator)
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.Administrator)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Get(':id/audit')
  @Roles(UserRole.Administrator)
  findAudit(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findAudit(id);
  }

  @Post()
  @Roles(UserRole.Administrator)
  create(@Body() dto: CreateUserDto, @Req() req: { user: AuthUserResponse }) {
    return this.usersService.create(dto, BigInt(req.user.id));
  }

  @Patch(':id')
  @Roles(UserRole.Administrator)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Req() req: { user: AuthUserResponse },
  ) {
    return this.usersService.update(id, dto, BigInt(req.user.id));
  }
}
