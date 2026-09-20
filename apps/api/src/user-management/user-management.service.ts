import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import type { Prisma } from '../generated/prisma/client';
import { SearchPaginationQueryDto } from '../common/dto/search-pagination-query.dto';

@Injectable()
export class UserManagementService {
  constructor(private prisma: PrismaService) {}

  async findAllUsers(query: SearchPaginationQueryDto) {
    const where: Prisma.MTCUserManagementWhereInput = query.search
      ? {
          OR: [
            { UserId: { contains: query.search, mode: 'insensitive' } },
            { Name: { contains: query.search, mode: 'insensitive' } },
            { Email: { contains: query.search, mode: 'insensitive' } },
            { PhoneNumber: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [totalItems, data] = await Promise.all([
      this.prisma.mTCUserManagement.count({ where }),
      this.prisma.mTCUserManagement.findMany({
        where,
        include: {
          Role: {
            select: {
              Id: true,
              RoleName: true,
              Description: true,
            },
          },
        },
        orderBy: { Name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }

  async createUser(createUserDto: CreateUserDto, createdBy: string) {
    try {
      const { DeptPermission, ...rest } = createUserDto;

      const existingUser = await this.prisma.mTCUserManagement.findFirst({
        where: {
          OR: [{ Email: rest.Email }, { UserId: rest.UserId }],
        },
      });

      if (existingUser) {
        throw new ConflictException('User already exists');
      }

      const newUser = await this.prisma.mTCUserManagement.create({
        data: { ...rest, CreatedBy: createdBy, UpdatedBy: createdBy } as never,
      });

      return newUser;
    } catch (e) {
      console.log(e);
      if (e.code === 'P2002')
        throw new ConflictException('User already exists');
      throw new InternalServerErrorException(
        'Create user failed: ' + e.message,
      );
    }
  }

  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
    updatedBy: string,
  ) {
    try {
      const isUserExist = await this.prisma.mTCUserManagement.findUnique({
        where: { UserId: id },
      });
      if (!isUserExist) throw new NotFoundException('User not found');

      const { DeptPermission, ...rest } = updateUserDto;

      const dataToUpdate: Record<string, unknown> = {};

      if (rest.Name !== undefined) dataToUpdate.Name = rest.Name;
      if (rest.Email !== undefined) dataToUpdate.Email = rest.Email;
      if (rest.IsActive !== undefined) dataToUpdate.IsActive = rest.IsActive;
      if (rest.RoleId !== undefined) dataToUpdate.RoleId = rest.RoleId;
      if (rest.PhoneNumber !== undefined)
        dataToUpdate.PhoneNumber = rest.PhoneNumber;
      dataToUpdate.UpdatedBy = updatedBy;

      // Update main user record
      if (Object.keys(dataToUpdate).length > 0) {
        await this.prisma.mTCUserManagement.update({
          where: { UserId: id },
          data: dataToUpdate as never,
        });
      }

      return { message: 'User updated successfully' };
    } catch (e) {
      throw (
        e || new InternalServerErrorException('Update failed: ' + e.message)
      );
    }
  }

  async deleteUser(id: string, deletedBy: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.mTCUserSession.deleteMany({ where: { UserId: id } });
        await tx.mTCUserManagement.update({
          where: { UserId: id },
          data: { UpdatedBy: deletedBy } as never,
        });
        await tx.mTCUserManagement.delete({
          where: { UserId: id },
        });
      });

      return { message: 'User deleted successfully' };
    } catch (e) {
      if (e.code === 'P2025') {
        // Prisma Record not found
        throw new ConflictException('User not found');
      }
      throw new InternalServerErrorException('Delete failed: ' + e.message);
    }
  }

  async assignRole(userId: string, roleId: number, updatedBy: string) {
    try {
      // Check if user exists
      const user = await this.prisma.mTCUserManagement.findUnique({
        where: { UserId: userId },
      });
      if (!user) throw new NotFoundException('User not found');

      await this.prisma.mTCUserManagement.update({
        where: { UserId: userId },
        data: { RoleId: roleId, UpdatedBy: updatedBy } as never,
      });

      return { message: 'Role assigned successfully' };
    } catch (e) {
      if (e instanceof NotFoundException || e instanceof ConflictException)
        throw e;
      throw new InternalServerErrorException(
        'Assign role failed: ' + e.message,
      );
    }
  }

  async removeRole(userId: string, roleId: number, updatedBy: string) {
    try {
      await this.prisma.mTCUserManagement.update({
        where: { UserId: userId },
        data: { RoleId: null, UpdatedBy: updatedBy } as never,
      });

      return { message: 'Role removed successfully' };
    } catch (e) {
      if (e.code === 'P2025') throw new NotFoundException('User not found');
      throw new InternalServerErrorException(
        'Remove role failed: ' + e.message,
      );
    }
  }

  // --- Roles CRUD ---
  async findAllRoles() {
    return this.prisma.mTCRole.findMany({
      include: {
        Permission: true,
      },
    });
  }

  async createRole(createRoleDto: CreateRoleDto, createdBy: string) {
    try {
      return await this.prisma.mTCRole.create({
        data: {
          ...createRoleDto,
          CreatedBy: createdBy,
          UpdatedBy: createdBy,
        } as never,
      });
    } catch (e) {
      if (e.code === 'P2002')
        throw new ConflictException('Role already exists');
      throw new InternalServerErrorException(e.message);
    }
  }

  async updateRole(
    id: number,
    updateRoleDto: UpdateRoleDto,
    updatedBy: string,
  ) {
    try {
      return await this.prisma.mTCRole.update({
        where: { Id: id },
        data: { ...updateRoleDto, UpdatedBy: updatedBy } as never,
      });
    } catch (e) {
      if (e.code === 'P2025') throw new NotFoundException('Role not found');
      throw new InternalServerErrorException(e.message);
    }
  }

  async deleteRole(id: number, deletedBy: string) {
    try {
      // Cleanup relations
      // Role assignment is implicit or single relationship so no strict need to deleteMany for Permission table usually unless cascade is off? We can try avoiding manual join table cleanup if it's implicit, or disconnect explicit. But prisma schema uses MTCPermission[] so it's implicit
      // We should ensure users are disconnected

      await this.prisma.$transaction(async (tx) => {
        await tx.mTCUserManagement.updateMany({
          where: { RoleId: id },
          data: { RoleId: null, UpdatedBy: deletedBy } as never,
        });
        await tx.mTCRole.update({
          where: { Id: id },
          data: { UpdatedBy: deletedBy } as never,
        });
        await tx.mTCRole.delete({ where: { Id: id } });
      });
      return { message: 'Role deleted successfully' };
    } catch (e) {
      if (e.code === 'P2025') throw new NotFoundException('Role not found');
      throw new InternalServerErrorException(e.message);
    }
  }

  // --- Permissions CRUD ---
  async findAllPermissions() {
    return this.prisma.mTCPermission.findMany();
  }

  async createPermission(
    createPermissionDto: CreatePermissionDto,
    createdBy: string,
  ) {
    try {
      return await this.prisma.mTCPermission.create({
        data: {
          ...createPermissionDto,
          CreatedBy: createdBy,
          UpdatedBy: createdBy,
        } as never,
      });
    } catch (e) {
      if (e.code === 'P2002')
        throw new ConflictException('Permission already exists');
      throw new InternalServerErrorException(e.message);
    }
  }

  async updatePermission(
    id: number,
    updatePermissionDto: UpdatePermissionDto,
    updatedBy: string,
  ) {
    try {
      return await this.prisma.mTCPermission.update({
        where: { Id: id },
        data: { ...updatePermissionDto, UpdatedBy: updatedBy } as never,
      });
    } catch (e) {
      if (e.code === 'P2025')
        throw new NotFoundException('Permission not found');
      throw e;
    }
  }

  async deletePermission(id: number, deletedBy: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.mTCPermission.update({
          where: { Id: id },
          data: { UpdatedBy: deletedBy } as never,
        });
        await tx.mTCPermission.delete({ where: { Id: id } });
      });
      return { message: 'Permission deleted successfully' };
    } catch (e) {
      if (e.code === 'P2025')
        throw new NotFoundException('Permission not found');
      throw e;
    }
  }

  // --- Role-Permission Assignment ---
  async assignPermissionToRole(
    roleId: number,
    permissionId: number,
    updatedBy: string,
  ) {
    try {
      await this.prisma.mTCRole.update({
        where: { Id: roleId },
        data: {
          Permission: {
            connect: { Id: permissionId },
          },
          UpdatedBy: updatedBy,
        } as never,
      });
      return { message: 'Permission assigned to role' };
    } catch (e) {
      if (e.code === 'P2016' || e.code === 'P2025')
        throw new NotFoundException('Role or Permission not found');
      throw new InternalServerErrorException(e.message);
    }
  }

  async removePermissionFromRole(
    roleId: number,
    permissionId: number,
    updatedBy: string,
  ) {
    try {
      await this.prisma.mTCRole.update({
        where: { Id: roleId },
        data: {
          Permission: {
            disconnect: { Id: permissionId },
          },
          UpdatedBy: updatedBy,
        } as never,
      });
      return { message: 'Permission removed from role' };
    } catch (e) {
      if (e.code === 'P2025')
        throw new NotFoundException('Assignment not found');
      throw e;
    }
  }
}
