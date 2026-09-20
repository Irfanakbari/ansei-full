import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserManagementService } from './user-management.service';
import { Permission } from 'src/auth/decorators/permission.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { SearchPaginationQueryDto } from '../common/dto/search-pagination-query.dto';
import {
  UserManagementEntity,
  RoleEntity,
  PermissionEntity,
} from './entities/user-management.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../auth/interfaces/current-user.interface';

// LIST PERMISSION
// 1. USER_MANAGEMENT

@ApiTags('User Management')
@Controller()
export class UserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, type: [UserManagementEntity] })
  @Get('users')
  @Permission('IPCS.USER_MANAGEMENT')
  async getUsers(@Query() query: SearchPaginationQueryDto) {
    return this.userManagementService.findAllUsers(query);
  }

  @ApiOperation({ summary: 'Create user' })
  @ApiResponse({ status: 201, type: UserManagementEntity })
  @Post('users')
  @Permission('IPCS.USER_MANAGEMENT')
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.userManagementService.createUser(createUserDto, user.username);
  }

  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, type: UserManagementEntity })
  @Patch('users/:id')
  @Permission('IPCS.USER_MANAGEMENT')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.userManagementService.updateUser(
      id,
      updateUserDto,
      user.username,
    );
  }

  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, type: UserManagementEntity })
  @Delete('users/:id')
  @Permission('IPCS.USER_MANAGEMENT')
  async deleteUser(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.userManagementService.deleteUser(id, user.username);
  }

  @ApiOperation({ summary: 'Assign role to user' })
  @ApiResponse({ status: 201, type: UserManagementEntity })
  @Post('users/:id/roles')
  @Permission('IPCS.USER_MANAGEMENT')
  async assignRole(
    @Param('id') id: string,
    @Body('roleId') roleId: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.userManagementService.assignRole(
      id,
      Number(roleId),
      user.username,
    );
  }

  @ApiOperation({ summary: 'Remove role from user' })
  @ApiResponse({ status: 200, type: UserManagementEntity })
  @Delete('users/:id/roles/:roleId')
  @Permission('IPCS.USER_MANAGEMENT')
  async removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.userManagementService.removeRole(
      id,
      Number(roleId),
      user.username,
    );
  }

  // --- Roles ---
  @ApiOperation({ summary: 'Get all roles' })
  @ApiResponse({ status: 200, type: [RoleEntity] })
  @Get('roles')
  @Permission('IPCS.USER_MANAGEMENT')
  async getRoles() {
    return this.userManagementService.findAllRoles();
  }

  @ApiOperation({ summary: 'Create role' })
  @ApiResponse({ status: 201, type: RoleEntity })
  @Post('roles')
  @Permission('IPCS.USER_MANAGEMENT')
  async createRole(
    @Body() createRoleDto: CreateRoleDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.userManagementService.createRole(createRoleDto, user.username);
  }

  @ApiOperation({ summary: 'Update role' })
  @ApiResponse({ status: 200, type: RoleEntity })
  @Patch('roles/:id')
  @Permission('IPCS.USER_MANAGEMENT')
  async updateRole(
    @Param('id') id: number,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.userManagementService.updateRole(
      Number(id),
      updateRoleDto,
      user.username,
    );
  }

  @ApiOperation({ summary: 'Delete role' })
  @ApiResponse({ status: 200, type: RoleEntity })
  @Delete('roles/:id')
  @Permission('IPCS.USER_MANAGEMENT')
  async deleteRole(@Param('id') id: number, @CurrentUser() user: ICurrentUser) {
    return this.userManagementService.deleteRole(Number(id), user.username);
  }

  // --- Permissions ---
  @ApiOperation({ summary: 'Get all permissions' })
  @ApiResponse({ status: 200, type: [PermissionEntity] })
  @Get('permissions')
  @Permission('IPCS.USER_MANAGEMENT')
  async getPermissions() {
    return this.userManagementService.findAllPermissions();
  }

  @ApiOperation({ summary: 'Create permission' })
  @ApiResponse({ status: 201, type: PermissionEntity })
  @Post('permissions')
  @Permission('IPCS.USER_MANAGEMENT')
  async createPermission(
    @Body() createPermissionDto: CreatePermissionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.userManagementService.createPermission(
      createPermissionDto,
      user.username,
    );
  }

  @ApiOperation({ summary: 'Update permission' })
  @ApiResponse({ status: 200, type: PermissionEntity })
  @Patch('permissions/:id')
  @Permission('IPCS.USER_MANAGEMENT')
  async updatePermission(
    @Param('id') id: number,
    @Body() updatePermissionDto: UpdatePermissionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.userManagementService.updatePermission(
      Number(id),
      updatePermissionDto,
      user.username,
    );
  }

  @ApiOperation({ summary: 'Delete permission' })
  @ApiResponse({ status: 200, type: PermissionEntity })
  @Delete('permissions/:id')
  @Permission('IPCS.USER_MANAGEMENT')
  async deletePermission(
    @Param('id') id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.userManagementService.deletePermission(
      Number(id),
      user.username,
    );
  }

  // --- Role-Permission Assignment ---
  @ApiOperation({ summary: 'Assign permission to role' })
  @ApiResponse({ status: 201, type: RoleEntity })
  @Post('roles/:roleId/permissions')
  @Permission('IPCS.USER_MANAGEMENT')
  async assignPermissionToRole(
    @Param('roleId') roleId: number,
    @Body('permissionId') permissionId: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.userManagementService.assignPermissionToRole(
      Number(roleId),
      Number(permissionId),
      user.username,
    );
  }

  @ApiOperation({ summary: 'Remove permission from role' })
  @ApiResponse({ status: 200, type: RoleEntity })
  @Delete('roles/:roleId/permissions/:permissionId')
  @Permission('IPCS.USER_MANAGEMENT')
  async removePermissionFromRole(
    @Param('roleId') roleId: number,
    @Param('permissionId') permissionId: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.userManagementService.removePermissionFromRole(
      Number(roleId),
      Number(permissionId),
      user.username,
    );
  }
}
