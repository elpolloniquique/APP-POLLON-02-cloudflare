import handler from '../../api/notify-cashier-orders.js';
import { asPagesFunction } from '../_lib/vercelAdapter.js';

export const onRequest = asPagesFunction(handler);
