import { IsIn, IsOptional } from 'class-validator';

// Query string of GET /api/categories (FR-CAT-04); used by CategoriesController.findAll()
export class ListCategoriesQueryDto {
  // ?status=active | inactive | all. Left out means all. Any other value gives 400
  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status?: 'active' | 'inactive' | 'all';
}
