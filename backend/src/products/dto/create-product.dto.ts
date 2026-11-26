import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';

// Largest values the database accepts (products_*_price_check, Int4 columns in schema.prisma)
export const MAX_PRICE = 9999999.99;
export const MAX_INT = 2147483647;

// Rules for the JSON body of POST /products (IMS-10, FR-PRD-01, FR-PRD-03)
// All six fields are required. stockQty is not accepted: stock only changes through stock movements
export class CreateProductDto {
  // Trim first, so "   " becomes "" and fails @IsNotEmpty (needs transform: true in main.ts)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(40) // products.sku is VarChar(40) in schema.prisma
  sku: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120) // products.name is VarChar(120) in schema.prisma
  name: string;

  @IsInt()
  @Min(1)
  @Max(MAX_INT)
  categoryId: number;

  // FR-PRD-03: a number >= 0 with at most 2 decimals. 950.555 and -1 give 400 naming the field
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_PRICE)
  purchasePrice: number;

  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_PRICE)
  sellingPrice: number;

  // FR-PRD-03: whole number >= 0. 2.5 gives 400
  @IsInt()
  @Min(0)
  @Max(MAX_INT)
  minStock: number;
}
