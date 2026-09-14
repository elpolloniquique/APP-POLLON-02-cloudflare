import handler from '../../api/bot-order-hook.js';
import { asPagesFunction } from '../_lib/vercelAdapter.js';

export const onRequest = asPagesFunction(handler);
