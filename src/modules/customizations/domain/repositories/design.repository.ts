import { Design } from '../entities/design.entity';

export const DESIGN_REPOSITORY = Symbol('DESIGN_REPOSITORY');

export interface DesignRepository {
  create(design: Design): Promise<Design>;
}
