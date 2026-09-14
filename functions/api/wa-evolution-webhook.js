import handler from '../../api/wa-evolution-webhook.js';
import { asPagesFunction } from '../_lib/vercelAdapter.js';

export const onRequest = asPagesFunction(handler);
