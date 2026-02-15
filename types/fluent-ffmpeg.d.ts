declare module 'fluent-ffmpeg' {
  namespace ffmpeg {
    interface FfprobeData {
      streams: any[];
      format: {
        filename?: string;
        nb_streams?: number;
        format_name?: string;
        format_long_name?: string;
        start_time?: number;
        duration?: number;
        size?: number;
        bit_rate?: number;
        [key: string]: any;
      };
      chapters: any[];
    }
  }
  const ffmpeg: any;
  export default ffmpeg;
}

declare module '@ffmpeg-installer/ffmpeg' {
  export const path: string;
}

declare module '@ffprobe-installer/ffprobe' {
  export const path: string;
}
