import { Type, applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';

export class ApiPaginationMetaDto {
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 50 }) limit: number;
  @ApiProperty({ example: 125 }) totalItems: number;
  @ApiProperty({ example: 3 }) totalPages: number;
}

export class ApiSuccessEnvelopeDto {
  @ApiProperty({ example: true }) success: true;
  @ApiProperty({ example: 200 }) statusCode: number;
  @ApiProperty({ example: 'Request successful' }) message: string;
  @ApiProperty({ nullable: true }) data: unknown;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  meta?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) timestamp: string;
  @ApiProperty({ example: '/v1/system-log' }) path: string;
}

export function ApiSuccessEnvelope(options: {
  status: number;
  type: Type<unknown>;
  isArray?: boolean;
  paginated?: boolean;
  description?: string;
}): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(ApiSuccessEnvelopeDto, ApiPaginationMetaDto, options.type),
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessEnvelopeDto) },
          {
            properties: {
              data: options.isArray
                ? {
                    type: 'array',
                    items: { $ref: getSchemaPath(options.type) },
                  }
                : { $ref: getSchemaPath(options.type) },
              ...(options.paginated
                ? { meta: { $ref: getSchemaPath(ApiPaginationMetaDto) } }
                : {}),
            },
          },
        ],
      },
    }),
  );
}
