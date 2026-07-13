// The shared contract. All three tracks code against these types.
// Any change here after T02 merges invalidates parallel work — flag it loudly.
export type * from './geometry'
export type * from './vehicle'
export type * from './cargo'
export type * from './shop'
export type * from './scenario'
export type * from './optimization'
export type * from './worker'
