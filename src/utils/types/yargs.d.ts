// Type declaration for yargs to work with ESM imports
declare module 'yargs' {
  import * as yargs from '@types/yargs';
  export = yargs;
}

