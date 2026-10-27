import {getHashParams} from './util';

const hashParams = getHashParams();
const portParam = hashParams.get('port');
// static locks a native overlay/cached screen to its route; it is not a browser preview.
export const isStatic = hashParams.has('static');
export const isPreview = hashParams.has('preview');

export const REST_BASE = portParam
    ? `http://localhost:${portParam}`
    : window.location.origin;

export const WS_BASE = portParam
    ? `ws://localhost:${portParam}`
    : `ws://${window.location.host}`;
