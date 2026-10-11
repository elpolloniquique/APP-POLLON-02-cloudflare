import handler from '../../api/fleet-admin.js';
import { asPagesFunction } from '../_lib/vercelAdapter.js';

export const onRequest = asPagesFunction(handler);
