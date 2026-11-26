import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MAX_INT, MAX_PRICE } from './create-product.dto';

// A field that is not sent (undefined) is skipped; a field sent as null is still validated and fails.
// @IsOptional would also skip null, and the null would reach Prisma and end as a 500
const OptionalNotNull = () => ValidateIf((_object, value) => value !== undefined);

// Rules for the JSON body of PATCH /products/:id (IMS-10, FR-PRD-02, FR-PRD-03, FR-PRD-04)
// Every field is optional: the client sends only what it wants to change; a field that is sent
// follows the same rules as in CreateProductDto
export class UpdateProductDto {
  @OptionalNotNull()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  sku?: string;

  @OptionalNotNull()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @OptionalNotNull()
  @IsInt()
  @Min(1)
  @Max(MAX_INT)
  categoryId?: number;

  @OptionalNotNull()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_PRICE)
  purchasePrice?: number;

  @OptionalNotNull()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_PRICE)
  sellingPrice?: number;

  @OptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(MAX_INT)
  minStock?: number;

  // Deactivate (false) or reactivate (true), FR-PRD-05. Only true/false allowed.
  // Always allowed, also for a product with stock or history: such a product is never deleted (BR-14)
  @OptionalNotNull()
  @IsBoolean()
  isActive?: boolean;
}
