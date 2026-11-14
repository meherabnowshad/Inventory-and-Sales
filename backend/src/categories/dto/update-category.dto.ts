import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Rules for the JSON body of PATCH /categories/:id (IMS-08.1, FR-CAT-02)
// To be used by CategoriesController.update(), then passed to CategoriesService.update()
// Every field is optional: the client sends only what it wants to change
export class UpdateCategoryDto {
  // Rename. Skipped if not sent; if sent, same rules as CreateCategoryDto.name
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80) // categories.name is VarChar(80) in schema.prisma
  name?: string;

  // Change the description. Skipped if not sent
  @IsOptional()
  @IsString()
  @MaxLength(255) // categories.description is VarChar(255) in schema.prisma
  description?: string;

  // Deactivate (false) or reactivate (true), FR-CAT-03. Only true/false allowed
  // The "cannot deactivate while products use it" check is added later in IMS-08.3
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
