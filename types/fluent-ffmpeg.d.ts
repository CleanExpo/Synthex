declare module 'fluent-ffmpeg' {
  const ffmpeg: any;
  export default ffmpeg;
}

declare module '@ffmpeg-installer/ffmpeg' {
  export const path: string;
}

declare module '@ffprobe-installer/ffprobe' {
  export const path: string;
}
