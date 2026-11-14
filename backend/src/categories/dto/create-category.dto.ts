import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Rules for the JSON body of POST /categories (IMS-08.1, FR-CAT-01)
// To be used by CategoriesController.create(), then passed to CategoriesService.create()
export class CreateCategoryDto {
  // Required. Rules run top to bottom: trim spaces, must be text, not empty, max 80 chars
  // Trim runs first, so "   " becomes "" and fails @IsNotEmpty (needs transform: true in main.ts)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80) // categories.name is VarChar(80) in schema.prisma
  name: string;

  // Optional: @IsOptional skips the other rules when the client does not send it
  @IsOptional()
  @IsString()
  @MaxLength(255) // categories.description is VarChar(255) in schema.prisma
  description?: string;
}
