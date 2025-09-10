declare module '@garmin/fitsdk' {
  export class Decoder {
    constructor(stream: Stream);
    read(): { messages: any; errors: any[] };
  }
  
  export class Stream {
    static fromByteArray(byteArray: Uint8Array): Stream;
  }
  
  export const Profile: any;
  export const Utils: any;
}