export * as types from './types/core';
export * from './config';
export * from './apiClient';
export * from './endpoints';
export * from './utils/tenant';

import * as core from './services/core';
import * as extended from './services/extended';

export const api = {
	...core,
	...extended,
};

