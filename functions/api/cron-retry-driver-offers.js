import handler from '../../api/cron-retry-driver-offers.js';
import { asPagesFunction } from '../_lib/vercelAdapter.js';

export const onRequest = asPagesFunction(handler);
