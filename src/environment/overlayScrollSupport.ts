import {CHROMIUM_VERSION, IS_CHROMIUM, IS_MOBILE} from './userAgent';

export const USE_NATIVE_SCROLL = /* IS_APPLE ||  */IS_MOBILE;
export const IS_OVERLAY_SCROLL_SUPPORTED = /* IS_APPLE ||  */IS_MOBILE || !IS_CHROMIUM || CHROMIUM_VERSION < 113;