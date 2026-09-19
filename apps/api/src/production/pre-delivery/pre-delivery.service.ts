import type { Prisma } from '../../generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PreDeliveryQueryDto } from './dto/pre-delivery-query.dto';
import { ShoppingService } from '../shopping/shopping.service';
import {
  assertLabelReady,
  isShoppingComplete,
} from '../../common/helpers/production-flow.helper';

@Injectable()
export class PreDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shoppingService: ShoppingService,
  ) {}

  /**
   * Check if shopping is complete (100%) for a forecast
   */
  private async isShoppingComplete(forecastId: string): Promise<boolean> {
    try {
      const requirements =
        await this.shoppingService.checkRequirement(forecastId);
      return isShoppingComplete(requirements);
    } catch {
      // If forecast not found in shopping records, consider it incomplete
      return false;
    }
  }

  /**
   * Get all Forecast IDs that have at least one Shopping record
   */
  private async getAllForecastIdsWithShopping(): Promise<string[]> {
    const shoppings = await this.prisma.shopping.findMany({
      where: { ForecastId: { not: null } },
      select: { ForecastId: true },
    });

    const uniqueForecastIds = [
      ...new Set(
        shoppings
          .map((s) => s.ForecastId)
          .filter((id): id is string => id !== null),
      ),
    ];

    return uniqueForecastIds;
  }

  async findAll(query: PreDeliveryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;

    // Get forecast IDs to filter - depends on whether productionReleaseId is provided
    let forecastIds: string[] | undefined;

    if (query.productionReleaseId) {
      // Get all PoId from the ProductionRelease's Forecasts
      const forecasts = await this.prisma.forecast.findMany({
        where: { ProductionReleaseId: query.productionReleaseId },
        select: { PoId: true },
      });
      forecastIds = forecasts.map((f) => f.PoId);

      // If no forecasts found, return empty result
      if (forecastIds.length === 0) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
    } else {
      // No productionReleaseId filter - get ALL forecasts that have Shopping records
      forecastIds = await this.getAllForecastIdsWithShopping();
    }

    // If no forecasts with shopping found, return empty
    if (forecastIds.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    // Filter forecasts where shopping is COMPLETE
    const shoppingCompleteForecastIds =
      await this.filterShoppingCompleteForecastIds(forecastIds);

    // If no forecasts with complete shopping, return empty
    if (shoppingCompleteForecastIds.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    // Build where conditions
    const where: Prisma.LabelDataWhereInput = {
      OR: [
        { RequiresAssembly: false },
        { RequiresAssembly: null },
        {
          RequiresAssembly: true,
          AssemblySessions: { some: { Status: 'COMPLETED' } },
        },
      ],
    };

    // Apply filtered forecastIds (only with complete shopping)
    where.ForecastId = { in: shoppingCompleteForecastIds };

    if (query.forecastId) {
      // Also filter by specific forecastId if provided (must also have complete shopping)
      const requestedForecastComplete = await this.isShoppingComplete(
        query.forecastId,
      );
      if (!requestedForecastComplete) {
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
      if (!shoppingCompleteForecastIds.includes(query.forecastId))
        return { data: [], total: 0, page, limit, totalPages: 0 };
      where.ForecastId = query.forecastId;
    }

    // Apply FinishGoodId filter
    if (query.finishGoodId) {
      where.FinishGoodId = query.finishGoodId;
    }

    // Apply LabelNumber filter (partial match)
    if (query.labelNumber) {
      where.LabelNumber = {
        contains: query.labelNumber,
        mode: 'insensitive',
      };
    }

    // Apply Scanned filter
    if (query.scanned !== undefined) {
      where.Scanned = query.scanned;
    }

    // If direct ProductionReleaseId filter on LabelData (not via Forecasts)
    if (query.productionReleaseId) {
      where.ProductionReleaseId = query.productionReleaseId;
    }

    const [total, data] = await Promise.all([
      this.prisma.labelData.count({ where }),
      this.prisma.labelData.findMany({
        where,
        include: {
          PartData: {
            select: {
              PartNumber: true,
              PartName: true,
            },
          },
          POData: {
            select: {
              PoId: true,
              VendorName: true,
              DeliveryDate: true,
            },
          },
          ProductionRelease: {
            select: {
              Id: true,
              ReleaseNumber: true,
            },
          },
        },
        orderBy: { Id: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      data: data.map((item) => ({
        id: item.Id,
        labelNumber: item.LabelNumber,
        finishGoodId: item.FinishGoodId,
        finishGoodName: item.PartData?.PartName ?? null,
        forecastId: item.ForecastId,
        vendorName: item.POData?.VendorName ?? null,
        scanned: item.Scanned,
        qtyThisBox: item.QtyThisBox,
        productionReleaseId: item.ProductionReleaseId,
        productionReleaseNumber: item.ProductionRelease?.ReleaseNumber ?? null,
        deliveryDate: item.POData?.DeliveryDate ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Filter forecast IDs to only include those with complete shopping
   */
  private async filterShoppingCompleteForecastIds(
    forecastIds?: string[],
  ): Promise<string[]> {
    if (!forecastIds || forecastIds.length === 0) {
      return [];
    }

    // Get all unique forecast IDs that have shopping records (filter out null)
    const forecastsWithShopping = await this.prisma.shopping.findMany({
      where: { ForecastId: { in: forecastIds, not: null } },
      select: { ForecastId: true },
    });

    const uniqueForecastIdsWithShopping = [
      ...new Set(
        forecastsWithShopping
          .map((s) => s.ForecastId)
          .filter((id): id is string => id !== null),
      ),
    ];

    // Check which forecasts have complete shopping (100%)
    const completeForecastIds: string[] = [];

    for (const forecastId of uniqueForecastIdsWithShopping) {
      if (!forecastId) continue;
      const isComplete = await this.isShoppingComplete(forecastId);
      if (isComplete) {
        completeForecastIds.push(forecastId);
      }
    }

    return completeForecastIds;
  }

  async findOne(id: string) {
    const result = await this.prisma.labelData.findUnique({
      where: { LabelNumber: id },
      include: {
        PartData: {
          select: {
            PartNumber: true,
            PartName: true,
          },
        },
        POData: {
          select: {
            PoId: true,
            VendorName: true,
            DeliveryDate: true,
            Qty: true,
          },
        },
        ProductionRelease: {
          select: {
            Id: true,
            ReleaseNumber: true,
            PlanDate: true,
          },
        },
      },
    });

    if (!result) {
      return null;
    }

    await assertLabelReady(this.prisma, result.Id, false);
    return {
      id: result.Id,
      labelNumber: result.LabelNumber,
      finishGoodId: result.FinishGoodId,
      finishGoodName: result.PartData?.PartName ?? null,
      forecastId: result.ForecastId,
      vendorName: result.POData?.VendorName ?? null,
      scanned: result.Scanned,
      qtyThisBox: result.QtyThisBox,
      productionReleaseId: result.ProductionReleaseId,
      productionReleaseNumber: result.ProductionRelease?.ReleaseNumber ?? null,
      deliveryDate: result.POData?.DeliveryDate ?? null,
    };
  }

  /**
   * Get summary statistics for pre-delivery dashboard
   */
  async getSummary(productionReleaseId?: string) {
    let forecastIds: string[] | undefined;

    if (productionReleaseId) {
      const forecasts = await this.prisma.forecast.findMany({
        where: { ProductionReleaseId: productionReleaseId },
        select: { PoId: true },
      });
      forecastIds = forecasts.map((f) => f.PoId);
    }

    const where: Prisma.LabelDataWhereInput = {
      OR: [
        { RequiresAssembly: false },
        { RequiresAssembly: null },
        {
          RequiresAssembly: true,
          AssemblySessions: { some: { Status: 'COMPLETED' } },
        },
      ],
    };
    const completeIds = await this.filterShoppingCompleteForecastIds(
      forecastIds ?? (await this.getAllForecastIdsWithShopping()),
    );
    where.ForecastId = { in: completeIds };

    const [total, scanned, notScanned] = await Promise.all([
      this.prisma.labelData.count({ where }),
      this.prisma.labelData.count({ where: { ...where, Scanned: true } }),
      this.prisma.labelData.count({ where: { ...where, Scanned: false } }),
    ]);

    return {
      total,
      scanned,
      notScanned,
      percentage: total > 0 ? Math.round((scanned / total) * 100) : 0,
    };
  }
}
