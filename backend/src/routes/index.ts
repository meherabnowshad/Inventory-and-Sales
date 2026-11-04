import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { inventoryRouter } from './inventory.routes.js';
import { salesRouter } from './sales.routes.js';

export const apiRouter = Router();

apiRouter.use('/', healthRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/sales', salesRouter);
